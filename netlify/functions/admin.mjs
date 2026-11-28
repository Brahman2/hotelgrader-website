// POST /api/admin  { action, ... }
// The monthly report card admin (see docs/monthly-report-card.md). Sign-in is an emailed 6-digit code,
// only for addresses in ADMIN_EMAILS: five tries per code, each code works once. Every other action needs
// the session that sign-in returns.

import { randomBytes, randomInt } from 'node:crypto';
import { CODE_TTL_MS, EMAIL_RE, clean, json, matches, sendMail, sign } from '../lib/verify.mjs';
import { codeEmail, TEMPLATE_VERSION } from '../lib/email.mjs';
import { TIPS } from '../lib/tips.mjs';
import { eligibilityReason, eligible, listContacts } from '../lib/contacts.mjs';
import { scanFor, scanKey } from '../lib/scan.mjs';
import {
  buildEmail, getSettings, issueDate, issueMonth, MAX_SEARCHES_PER_HOTEL, previousFor, readiness, runRecord, saveSettings,
  sendMonthlyMail, snapshotOf, trigger,
} from '../lib/monthly.mjs';

const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_TRIES = 5;
const admins = () => String(process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const sessionFor = (secret, email, exp) => `${exp}.${Buffer.from(email).toString('base64url')}.${sign(secret, 'admin-session', email, exp)}`;
function readSession(secret, s) {
  const [exp, who, sig] = String(s || '').split('.');
  const email = who ? Buffer.from(who, 'base64url').toString() : '';
  if (!exp || !email || Date.now() > Number(exp) || !admins().includes(email)) return null;
  return matches(sig ?? '', sign(secret, 'admin-session', email, Number(exp))) ? email : null;
}

async function attempts() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'admin-attempts', consistency: 'strong' });
}

/** The sample: a real hotel's current, cached scan in the monthly template. Never spends a search. */
async function sample(target) {
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const snap = snapshotOf(target, scan);
  if (!snap) return { error: 'No graded scan cached for that hotel. Open its report on the site first, then try again.' };
  const label = issueMonth();
  const key = scanKey(target);
  const { snap: prev, since } = await previousFor({ key, addedAt: null }, label);
  const testTo = process.env.MONTHLY_TEST_TO || '';
  const contact = { email: 'a contact who unlocked this hotel', name: target.name || 'there', hotels: [{ ...target, key }] };
  const { mail, unsubscribe } = buildEmail({ contact, snap, prev, since, sendDate: issueDate(label), test: true, testTo });
  return { snap, prev, mail, unsubscribe };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  const secret = process.env.VERIFY_SECRET;
  if (!secret) return json(503, { error: 'VERIFY_SECRET is not set.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const action = clean(body.action);

  // ----- sign-in -----
  if (action === 'send-code') {
    const email = clean(body.email).toLowerCase();
    const exp = Date.now() + CODE_TTL_MS;
    // Same shape of answer either way, so the page doesn't reveal who is an admin.
    if (!EMAIL_RE.test(email) || !admins().includes(email)) return json(200, { token: `${exp}.${randomBytes(32).toString('hex')}` });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await sendMail({ to: email, ...codeEmail({ theme: 'light', name: 'admin', code, hotel: '' }) }).catch(() => false);
    return json(200, { token: `${exp}.${sign(secret, 'admin-code', email, code, exp)}` });
  }
  if (action === 'verify') {
    const email = clean(body.email).toLowerCase();
    const [exp, sig] = clean(body.token).split('.');
    const code = clean(body.code).replace(/\D/g, '');
    if (!admins().includes(email) || !exp || !sig || Date.now() > Number(exp)) return json(401, { error: 'That code isn’t right, or it expired.' });
    const s = await attempts();
    const key = sig.slice(0, 40);
    const used = (await s.get(key, { type: 'json' })) ?? { tries: 0, done: false };
    if (used.done || used.tries >= MAX_TRIES) return json(401, { error: 'That code can’t be used again. Request a new one.' });
    if (!matches(sig, sign(secret, 'admin-code', email, code, Number(exp)))) {
      await s.setJSON(key, { ...used, tries: used.tries + 1 });
      return json(401, { error: `That code isn’t right. ${MAX_TRIES - used.tries - 1} tries left.` });
    }
    await s.setJSON(key, { ...used, done: true });
    return json(200, { session: sessionFor(secret, email, Date.now() + SESSION_MS) });
  }

  const who = readSession(secret, req.headers.get('x-admin-session'));
  if (!who) return json(401, { error: 'Sign in again.' });
  const settings = await getSettings();
  const label = issueMonth();

  if (action === 'status') {
    let contacts = [];
    let contactsError = '';
    try { contacts = await listContacts(); } catch (err) { contactsError = String(err?.message || err).slice(0, 120); }
    const byReason = {};
    for (const c of contacts) { const r = eligibilityReason(c); byReason[r] = (byReason[r] ?? 0) + 1; }
    const hotels = new Set(contacts.flatMap((c) => (c.hotels ?? []).map((h) => h.key)));
    const [y, m] = label.split('-').map(Number);
    const lastLabel = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    const [rescan, rescanPrev, send, sendTest] = await Promise.all([runRecord(`rescan-${label}`), runRecord(`rescan-${lastLabel}`), runRecord(`send-${label}`), runRecord(`send-${label}-test`)]);
    const summarizeRun = (r) => r && { month: r.month, startedAt: r.startedAt, finishedAt: r.finishedAt, total: r.total ?? null, done: Object.values(r.hotels ?? {}).filter((h) => h.status === 'done').length, skippedForCap: Object.values(r.hotels ?? {}).filter((h) => h.status === 'skipped-cap').length, searches: r.searches, usd: r.usd, stoppedForCap: r.stoppedForCap, paused: !!r.paused };
    return json(200, {
      you: who, templateVersion: TEMPLATE_VERSION, issue: label, settings, readiness: readiness(settings),
      env: { testTo: !!process.env.MONTHLY_TEST_TO, postal: !!process.env.MAIL_POSTAL_ADDRESS, admins: admins().length },
      contacts: { total: contacts.length, eligible: contacts.filter(eligible).length, byReason, hotels: hotels.size, error: contactsError },
      estimate: { hotels: hotels.size, maxSearches: hotels.size * MAX_SEARCHES_PER_HOTEL, maxUsd: Math.round(hotels.size * MAX_SEARCHES_PER_HOTEL * settings.costPerSearch * 100) / 100 },
      runs: { rescan: summarizeRun(rescan), rescanLastMonth: summarizeRun(rescanPrev), send: send && { count: send.count, finishedAt: send.finishedAt }, sendTest: sendTest && { count: sendTest.count, finishedAt: sendTest.finishedAt, skipped: sendTest.skipped } },
    });
  }

  if (action === 'settings') {
    const capUsd = Number(body.capUsd);
    const costPerSearch = Number(body.costPerSearch);
    const patch = {};
    if (Number.isFinite(capUsd) && capUsd >= 0 && capUsd <= 1000) patch.capUsd = Math.round(capUsd * 100) / 100;
    if (Number.isFinite(costPerSearch) && costPerSearch > 0 && costPerSearch <= 1) patch.costPerSearch = costPerSearch;
    return json(200, { settings: await saveSettings(patch) });
  }

  if (action === 'preview' || action === 'sample') {
    const target = { hotel: clean(body.hotel).slice(0, 120), city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80), name: clean(body.name).slice(0, 60) };
    if (!target.hotel) return json(400, { error: 'Pick a hotel.' });
    const got = await sample(target);
    if (got.error) return json(409, { error: got.error });
    // Approving the template approves every tip in the rotation too, so the preview lists them all.
    if (action === 'preview') return json(200, { subject: got.mail.subject, html: got.mail.html, firstReport: !got.prev, tips: TIPS });
    // The sample goes to MONTHLY_TEST_TO and nowhere else.
    const to = process.env.MONTHLY_TEST_TO;
    if (!to) return json(409, { error: 'Set MONTHLY_TEST_TO in Netlify first.' });
    const ok = await sendMonthlyMail({ to, mail: got.mail, unsubscribe: got.unsubscribe });
    if (!ok) return json(502, { error: 'Resend didn’t accept the sample.' });
    await saveSettings({ sampleSentAt: new Date().toISOString(), sampleSentVersion: TEMPLATE_VERSION, sampleApprovedAt: null, sampleHotel: target.hotel });
    return json(200, { ok: true, to, subject: got.mail.subject });
  }

  if (action === 'approve-template') {
    return json(200, { settings: await saveSettings({ templateApprovedVersion: TEMPLATE_VERSION, templateApprovedAt: new Date().toISOString(), templateApprovedBy: who }) });
  }
  if (action === 'approve-sample') {
    if (settings.templateApprovedVersion !== TEMPLATE_VERSION) return json(409, { error: 'Approve the template first.' });
    if (!settings.sampleSentAt || settings.sampleSentVersion !== TEMPLATE_VERSION) return json(409, { error: 'Send yourself a sample of the current template first.' });
    if (settings.sampleSentAt < settings.templateApprovedAt) return json(409, { error: 'Send a new sample after approving the template.' });
    return json(200, { settings: await saveSettings({ sampleApprovedAt: new Date().toISOString(), sampleApprovedBy: who }) });
  }
  if (action === 'enable') {
    return json(200, { settings: await saveSettings({ enabled: !!body.on }) });
  }
  if (action === 'mode') {
    if (body.mode === 'live') {
      const r = readiness(settings);
      if (!r.ready) return json(409, { error: `Not ready for live: ${r.missing.join('; ')}.` });
      return json(200, { settings: await saveSettings({ mode: 'live', liveSince: new Date().toISOString(), liveBy: who }) });
    }
    return json(200, { settings: await saveSettings({ mode: 'test' }) });
  }
  if (action === 'rescan-now') {
    await trigger('monthly-rescan-background');
    return json(202, { ok: true });
  }
  if (action === 'send-test-now') {
    await trigger('monthly-send-background', { forceTest: true });
    return json(202, { ok: true });
  }
  return json(400, { error: 'Unknown action.' });
};

export const config = {
  path: '/api/admin',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
