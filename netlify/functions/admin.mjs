// POST /api/admin  { action, ... }
// The monthly report card admin (see docs/monthly-report-card.md). Sign-in is an emailed 6-digit code,
// only for addresses in ADMIN_EMAILS. Every other action needs the session that sign-in returns.

import { randomInt } from 'node:crypto';
import { CODE_TTL_MS, EMAIL_RE, clean, json, matches, sendMail, sign } from '../lib/verify.mjs';
import { codeEmail, TEMPLATE_VERSION } from '../lib/email.mjs';
import { eligibilityReason, eligible, listContacts } from '../lib/contacts.mjs';
import { scanFor, scanKey } from '../lib/scan.mjs';
import {
  buildEmail, getSettings, monthOf, previousSnapshot, readiness, runRecord, saveSettings, sendMonthlyMail, snapshotOf, trigger,
} from '../lib/monthly.mjs';

const SESSION_MS = 12 * 60 * 60 * 1000;
const admins = () => String(process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const sessionFor = (secret, email, exp) => `${exp}.${Buffer.from(email).toString('base64url')}.${sign(secret, 'admin', email, exp)}`;
function readSession(secret, s) {
  const [exp, who, sig] = String(s || '').split('.');
  const email = who ? Buffer.from(who, 'base64url').toString() : '';
  if (!exp || !email || Date.now() > Number(exp) || !admins().includes(email)) return null;
  return matches(sig, sign(secret, 'admin', email, Number(exp))) ? email : null;
}

/** The sample: a real hotel's current, cached scan in the monthly template. Never spends a search. */
async function sample(target, settings) {
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const snap = snapshotOf(target, scan);
  if (!snap) return { error: 'No graded scan cached for that hotel. Open its report on the site first, then try again.' };
  const prev = await previousSnapshot(scanKey(target), new Date(Date.parse(snap.at) - 1).toISOString());
  const first = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)); // the next send date
  const contact = { email: process.env.MONTHLY_TEST_TO || 'test@example.com', name: target.name || 'there', hotels: [{ ...target, key: scanKey(target) }] };
  return { snap, prev, mail: buildEmail({ contact, snap, prev, sendDate: first, test: true, wouldGoTo: 'a contact who unlocked this hotel' }) };
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
    // Same answer either way, so the page doesn't reveal who is an admin.
    if (!EMAIL_RE.test(email) || !admins().includes(email)) return json(200, { token: '' });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const exp = Date.now() + CODE_TTL_MS;
    await sendMail({ to: email, ...codeEmail({ theme: 'light', name: 'admin', code, hotel: '' }) }).catch(() => false);
    return json(200, { token: `${exp}.${sign(secret, 'admin-code', email, code, exp)}` });
  }
  if (action === 'verify') {
    const email = clean(body.email).toLowerCase();
    const [exp, sig] = clean(body.token).split('.');
    const code = clean(body.code).replace(/\D/g, '');
    if (!admins().includes(email) || !exp || Date.now() > Number(exp) || !matches(sig ?? '', sign(secret, 'admin-code', email, code, Number(exp)))) {
      return json(401, { error: 'That code isn’t right.' });
    }
    return json(200, { session: sessionFor(secret, email, Date.now() + SESSION_MS) });
  }

  const who = readSession(secret, req.headers.get('x-admin-session'));
  if (!who) return json(401, { error: 'Sign in again.' });
  const settings = await getSettings();
  const month = monthOf();

  if (action === 'status') {
    const contacts = await listContacts();
    const byReason = {};
    for (const c of contacts) { const r = eligibilityReason(c); byReason[r] = (byReason[r] ?? 0) + 1; }
    const hotels = new Set(contacts.flatMap((c) => (c.hotels ?? []).map((h) => h.key)));
    const prevMonth = monthOf(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)));
    const [rescan, rescanPrev, send, sendTest] = await Promise.all([runRecord(`rescan-${month}`), runRecord(`rescan-${prevMonth}`), runRecord(`send-${month}`), runRecord(`send-${month}-test`)]);
    const summarizeRun = (r) => r && { month: r.month, startedAt: r.startedAt, finishedAt: r.finishedAt, total: r.total ?? null, done: Object.values(r.hotels ?? {}).filter((h) => h.status === 'done').length, skippedForCap: Object.values(r.hotels ?? {}).filter((h) => h.status === 'skipped-cap').length, searches: r.searches, usd: r.usd, stoppedForCap: r.stoppedForCap, paused: !!r.paused };
    return json(200, {
      you: who, templateVersion: TEMPLATE_VERSION, settings, readiness: readiness(settings),
      env: { testTo: !!process.env.MONTHLY_TEST_TO, postal: !!process.env.MAIL_POSTAL_ADDRESS, admins: admins().length },
      contacts: { total: contacts.length, eligible: contacts.filter(eligible).length, byReason, hotels: hotels.size },
      estimate: { hotels: hotels.size, maxSearches: hotels.size * 16, maxUsd: Math.round(hotels.size * 16 * settings.costPerSearch * 100) / 100 },
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
    const got = await sample(target, settings);
    if (got.error) return json(409, { error: got.error });
    if (action === 'preview') return json(200, { subject: got.mail.subject, html: got.mail.html, firstReport: !got.prev });
    // The sample goes to MONTHLY_TEST_TO and nowhere else.
    const to = process.env.MONTHLY_TEST_TO;
    if (!to) return json(409, { error: 'Set MONTHLY_TEST_TO in Netlify first.' });
    const ok = await sendMonthlyMail({ to, mail: got.mail, unsubscribe: 'https://hotelgrader.com/api/unsubscribe' });
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
