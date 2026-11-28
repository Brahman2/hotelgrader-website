// The monthly report card (see docs/monthly-report-card.md): settings, snapshots, the re-scan and the send.
//
// Safety: sendMonthly() only sends to contacts when settings.mode is 'live' AND every approval is in place.
// In every other case it sends at most TEST_LIMIT emails, all to MONTHLY_TEST_TO, and each of those carries
// an unsubscribe link for the test address, never for the contact it stands in for.
// A storage read that fails throws, so a run stops instead of treating "couldn't read" as "nothing there".

import { assess, compSet } from '../../shared/assess.mjs';
import { scanFor, scanKey } from './scan.mjs';
import { sendMail, sign, matches } from './verify.mjs';
import { reportLink } from './report.mjs';
import { eligible, listContacts, unsubscribeLink } from './contacts.mjs';
import { monthlyEmail, TEMPLATE_VERSION } from './email.mjs';
import { tipFor } from './tips.mjs';

async function store(name) {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name, consistency: 'strong' });
}
/** null when the key doesn't exist; throws when the store can't be read. */
async function getJSON(name, key) { return (await (await store(name)).get(key, { type: 'json' })) ?? null; }
async function putJSON(name, key, v) { await (await store(name)).setJSON(key, v); return true; }

// ---------- settings ----------

export const DEFAULTS = {
  enabled: false, mode: 'test', capUsd: 25, costPerSearch: 0.015,
  templateApprovedVersion: null, templateApprovedAt: null, templateApprovedBy: null,
  sampleSentAt: null, sampleSentVersion: null, sampleApprovedAt: null, sampleApprovedBy: null,
};
// The most one hotel's re-scan can spend (prices with the class search, profile, brand search, AI, reviews, two ad searches).
export const MAX_SEARCHES_PER_HOTEL = 17;
export const TEST_LIMIT = 3;

/** The settings. If they can't be read, the safe defaults (off, test mode) apply. */
export async function getSettings() {
  let saved = null;
  try { saved = await getJSON('monthly', 'settings'); } catch { saved = null; }
  const s = { ...DEFAULTS, ...(saved ?? {}) };
  // A template change voids the approvals and drops the program back to test.
  if (s.templateApprovedVersion && s.templateApprovedVersion !== TEMPLATE_VERSION) {
    Object.assign(s, { templateApprovedVersion: null, templateApprovedAt: null, sampleApprovedAt: null, mode: 'test' });
  }
  return s;
}
export async function saveSettings(patch) {
  const current = { ...DEFAULTS, ...((await getJSON('monthly', 'settings')) ?? {}) }; // throws rather than save over unread settings
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await putJSON('monthly', 'settings', next);
  return getSettings();
}

/**
 * Everything that must be true before live sending, plus warnings that don't block it.
 * The postal address is a warning, not a requirement: hotelgrader is free and the monthly email sells nothing,
 * so it is a relationship message rather than commercial email under CAN-SPAM. Once the email promotes anything
 * paid (pricing, upgrades, offers), set MAIL_POSTAL_ADDRESS: a PO Box or virtual mailbox is fine.
 */
export function readiness(s) {
  const missing = [];
  const warnings = [];
  if (s.templateApprovedVersion !== TEMPLATE_VERSION) missing.push('template not approved at the current version');
  if (!s.sampleApprovedAt || !s.sampleSentAt || s.sampleSentVersion !== TEMPLATE_VERSION) missing.push('sample not approved');
  if (!process.env.MONTHLY_TEST_TO) missing.push('MONTHLY_TEST_TO not set');
  if (!process.env.MAIL_POSTAL_ADDRESS) warnings.push('No postal address in the footer. Fine while the email sells nothing; add one (a PO Box works) before it promotes anything paid.');
  return { ready: missing.length === 0, missing, warnings };
}

const ym = (d) => d.toISOString().slice(0, 7);
/**
 * The issue a date belongs to: the month the email goes out. The re-scan on the 25th and the send on the 1st of
 * the next month share one label, so the send finds what the re-scan saved.
 */
export const issueMonth = (d = new Date()) => (d.getUTCDate() >= 20 ? ym(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) : ym(d));
const monthBefore = (label) => { const [y, m] = label.split('-').map(Number); return ym(new Date(Date.UTC(y, m - 2, 1))); };
export const issueDate = (label) => { const [y, m] = label.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)); };

// ---------- internal calls between functions ----------

const dayToken = (secret, d) => sign(secret, 'monthly-internal', d.toISOString().slice(0, 10)).slice(0, 40);
export const internalToken = (secret) => dayToken(secret, new Date());
/** Today's token, or yesterday's (a call made just before midnight UTC). */
export const validInternal = (secret, t) => !!t && (matches(t, dayToken(secret, new Date())) || matches(t, dayToken(secret, new Date(Date.now() - 864e5))));

export async function trigger(path, body = {}) {
  // The deploy this code is running on (a preview while testing), so its own background functions answer.
  const base = (process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://hotelgrader.com').replace(/\/$/, '');
  await fetch(`${base}/.netlify/functions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hg-internal': internalToken(process.env.VERIFY_SECRET) },
    body: JSON.stringify(body),
  }).catch(() => null);
}

// ---------- snapshots ----------

/** What one scan said about a hotel, in the small shape the monthly email compares. Null when it couldn't be graded. */
export function snapshotOf(target, scan) {
  const audit = scan?.base && scan.live?.prices?.ok ? scan.base : null;
  if (!audit) return null;
  const a = assess(audit, scan.crawl ?? null, scan.live ?? null);
  if (!a.graded) return null;
  const c = compSet(audit, scan.live);
  const prof = scan.live?.gbp;
  return {
    hotel: target.hotel, city: target.city, state: target.state,
    at: new Date().toISOString(), version: a.version,
    score: a.score, letter: a.letter, coverage: Math.round(a.coverage * 100),
    hotelClass: c?.hotel_class ?? scan.live?.prices?.hotel?.hotelClass ?? null,
    sections: a.functions.filter((f) => f.score != null).map((f) => ({ key: f.key, name: f.name, score: f.score, coverage: Math.round(f.coverage * 100) })),
    rank: c?.rating_rank != null ? { place: c.rating_rank, total: c.total_in_set, basis: c.basis } : null,
    rating: c?.own_rating ?? scan.live?.prices?.hotel?.rating ?? null,
    reviews: c?.own_reviews ?? scan.live?.prices?.hotel?.reviews ?? null,
    recent: a.recent ? { total: a.recent.total, replied: a.recent.replied, low: a.recent.low, lowUnanswered: a.recent.lowUnanswered } : null,
    fixes: a.priorities.map((p) => ({ id: p.id, title: p.title, evidence: p.evidence, outcome: p.outcome ?? '', owner: p.owner, type: p.type, fn: p.fn ?? '' })),
    profile: prof?.ok ? { found: !!prof.found, unclaimed: prof.unclaimed } : null,
  };
}

/** Saves a snapshot under the hotel's key. `label` is the issue month (YYYY-MM) or "unlock-YYYY-MM-DD". */
export async function saveSnapshot(key, label, snap) {
  if (!snap) return false;
  return putJSON('monthly-snapshots', `${key}/${label}`, { ...snap, label });
}
export async function snapshotFor(key, label) { return getJSON('monthly-snapshots', `${key}/${label}`); }

/**
 * What this contact's email compares against: last issue's snapshot when there is one, otherwise the baseline
 * saved when this contact unlocked the hotel. Never another contact's baseline.
 */
export async function previousFor(hotelEntry, label) {
  const last = await snapshotFor(hotelEntry.key, monthBefore(label));
  if (last) return { snap: last, since: 'last month' };
  const unlocked = hotelEntry.addedAt ? await snapshotFor(hotelEntry.key, `unlock-${hotelEntry.addedAt.slice(0, 10)}`) : null;
  return unlocked ? { snap: unlocked, since: 'you first saw your grade' } : { snap: null, since: '' };
}

/** A baseline at unlock, from cached readings only (never spends a search). */
export async function baselineAtUnlock(target) {
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const snap = snapshotOf(target, scan);
  if (snap) await saveSnapshot(scanKey(target), `unlock-${new Date().toISOString().slice(0, 10)}`, snap).catch(() => false);
  return snap;
}

// ---------- what changed ----------

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
// Rate fixes and the rates section are left out until the report's rate check follows the parity rule
// (same room type and rate plan, against Booking.com, Expedia and Priceline). See email.mjs.
const RATES = 'rates';

/**
 * Plain-language changes between two snapshots, most important first. Each: { text, tone: good | bad | neutral }.
 * A score move is only claimed when both scans used the same method and read about as much of the hotel.
 */
export function changesBetween(prev, cur, since = 'last month') {
  if (!prev || !cur) return { first: true, since: '', items: [] };
  const items = [];
  const sameMethod = prev.version === cur.version;
  const sameReach = prev.coverage != null && cur.coverage != null && Math.abs(prev.coverage - cur.coverage) <= 3;
  if (!sameMethod) {
    items.push({ tone: 'neutral', text: `We improved how we grade (method v${prev.version} to v${cur.version}), so your score isn’t directly comparable to last time. Under the new method you’re a ${cur.letter} (${cur.score}).` });
  } else if (!sameReach) {
    items.push({ tone: 'neutral', text: `We could read ${cur.coverage > prev.coverage ? 'more' : 'less'} of your hotel’s marketing this time (${prev.coverage}% to ${cur.coverage}% of the checks), so the score isn’t directly comparable. You’re a ${cur.letter} (${cur.score}).` });
  } else if (cur.score !== prev.score) {
    items.push({ tone: cur.score > prev.score ? 'good' : 'bad', text: `Your score went ${cur.score > prev.score ? 'up' : 'down'} from ${prev.score} to ${cur.score}${cur.letter !== prev.letter ? `, from ${prev.letter} to ${cur.letter}` : ''}.` });
  }
  if (sameMethod) {
    const moved = cur.sections
      .map((s) => { const p = prev.sections.find((x) => (x.key ?? x.name) === (s.key ?? s.name)); return { ...s, was: p?.score, wasCov: p?.coverage }; })
      .filter((s) => s.key !== RATES && s.was != null && Math.abs(s.score - s.was) >= 3 && (s.coverage == null || s.wasCov == null || Math.abs(s.coverage - s.wasCov) <= 5))
      .sort((a, b) => Math.abs(b.score - b.was) - Math.abs(a.score - a.was)).slice(0, 2);
    for (const s of moved) items.push({ tone: s.score > s.was ? 'good' : 'bad', text: `${s.name}: ${s.was} to ${s.score} (${signed(s.score - s.was)}).` });
  }
  if (prev.rank && cur.rank && prev.rank.basis === cur.rank.basis && prev.rank.total === cur.rank.total && prev.rank.place !== cur.rank.place) {
    items.push({ tone: cur.rank.place < prev.rank.place ? 'good' : 'bad', text: `You moved from #${prev.rank.place} to #${cur.rank.place} of ${cur.rank.total} on Google rating among the hotels you compete with.` });
  }
  if (prev.reviews != null && cur.reviews != null && cur.reviews > prev.reviews) {
    items.push({ tone: 'neutral', text: `${(cur.reviews - prev.reviews).toLocaleString('en-US')} new Google reviews (${cur.reviews.toLocaleString('en-US')} in all)${prev.rating != null && cur.rating != null && cur.rating !== prev.rating ? `, and your rating went from ${prev.rating} to ${cur.rating}` : ''}.` });
  } else if (prev.rating != null && cur.rating != null && cur.rating !== prev.rating) {
    items.push({ tone: cur.rating > prev.rating ? 'good' : 'bad', text: `Your Google rating went from ${prev.rating} to ${cur.rating}.` });
  }
  if (prev.recent && cur.recent && prev.recent.lowUnanswered !== cur.recent.lowUnanswered) {
    items.push({ tone: cur.recent.lowUnanswered < prev.recent.lowUnanswered ? 'good' : 'bad', text: `Low-star reviews without a reply: ${prev.recent.lowUnanswered} to ${cur.recent.lowUnanswered}.` });
  }
  if (prev.profile?.unclaimed === true && cur.profile?.unclaimed === false) items.push({ tone: 'good', text: 'Your Google profile is now claimed.' });
  if (sameMethod && sameReach) {
    const key = (f) => f.id ?? f.title;
    const was = new Set(prev.fixes.map(key));
    const now = new Set(cur.fixes.map(key));
    const done = prev.fixes.find((f) => f.fn !== RATES && !now.has(key(f)));
    const fresh = cur.fixes.find((f) => f.fn !== RATES && !was.has(key(f)));
    if (done) items.push({ tone: 'good', text: `Off your list: ${done.title}.` });
    if (fresh) items.push({ tone: 'bad', text: `New on your list: ${fresh.title}.` });
  }
  return { first: false, since, items: items.slice(0, 5) };
}

// ---------- the email for one contact ----------

/**
 * Builds one monthly email. In a test send, the unsubscribe link and headers are signed for the address the
 * test goes to, so clicking them can never unsubscribe the contact the test stands in for.
 */
export function buildEmail({ contact, snap, prev, since, sendDate, test = false, testTo = '' }) {
  const secret = process.env.VERIFY_SECRET;
  const changes = changesBetween(prev, snap, since);
  const tip = tipFor(sendDate, { city: snap.city, hotelClass: snap.hotelClass });
  const others = (contact.hotels ?? []).filter((h) => h.hotel !== snap.hotel).map((h) => h.hotel);
  const unsubscribe = unsubscribeLink(secret, test ? testTo : contact.email);
  const mail = monthlyEmail({
    name: contact.name, snap, prev, changes, tip, others,
    link: reportLink(secret, snap.hotel, snap.city, snap.state),
    unsubscribe,
    postal: process.env.MAIL_POSTAL_ADDRESS || '',
    month: sendDate,
    test, wouldGoTo: test ? contact.email : '',
  });
  return { mail, unsubscribe };
}

const mailbox = (v) => { const m = String(v || '').match(/<([^>]+)>/); return (m ? m[1] : String(v || '')).trim() || 'hello@hotelgrader.com'; };

/** Sends one monthly email with one-click unsubscribe headers (RFC 8058). */
export async function sendMonthlyMail({ to, mail, unsubscribe }) {
  return sendMail({
    to, subject: mail.subject, text: mail.text, html: mail.html,
    headers: {
      'List-Unsubscribe': `<${unsubscribe}>, <mailto:${mailbox(process.env.REPLY_TO)}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// ---------- the re-scan ----------

/** Searches a scan actually spent since `sinceIso`: each reading that was fetched fresh carries its own count. */
function spentSince(scan, sinceIso) {
  if (!scan) return 0;
  const fresh = (x) => !!x && (x.fetchedAt ?? x.checkedAt ?? '') >= sinceIso;
  const live = scan.live ?? {};
  const readings = [live.prices, live.search, live.ai, live.reviews, live.ads, live.gbp, ...(live.market?.readings ?? [])];
  return readings.filter(fresh).reduce((n, x) => n + (Number(x.searches) || 1), 0);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-scans every hotel any contact unlocked, within the spend cap, and saves each as this issue's snapshot.
 * Resumable: the cron runs it on several days and each run skips hotels already done for the issue.
 */
export async function rescanAll({ deadlineMs = 13 * 60 * 1000 } = {}) {
  const started = Date.now();
  const settings = await getSettings();
  const label = issueMonth();
  const runKey = `rescan-${label}`;
  const run = (await getJSON('monthly', runKey)) ?? { month: label, startedAt: new Date().toISOString(), hotels: {}, searches: 0, usd: 0, stoppedForCap: false };
  run.paused = false;
  // Every unlocked hotel, those of contacts who get the email first, so the cap spends where it counts.
  const contacts = (await listContacts()).sort((a, b) => Number(eligible(b)) - Number(eligible(a)));
  const hotels = new Map();
  for (const c of contacts) for (const h of c.hotels ?? []) if (!hotels.has(h.key)) hotels.set(h.key, h);
  run.total = hotels.size;
  for (const [key, h] of hotels) {
    if (run.hotels[key]?.status === 'done') continue;
    if (Date.now() - started > deadlineMs) { run.paused = true; break; }
    const worst = MAX_SEARCHES_PER_HOTEL * settings.costPerSearch;
    if (run.usd + worst > settings.capUsd) { run.stoppedForCap = true; run.hotels[key] = { status: 'skipped-cap', hotel: h.hotel, at: new Date().toISOString() }; continue; }
    const since = new Date().toISOString();
    let scan = null;
    for (let i = 0; i < 6; i++) {
      scan = await scanFor({ hotel: h.hotel, city: h.city, state: h.state }, { fresh: true, monthly: true }).catch(() => null);
      if (!scan?.pending) break;
      await wait(2500);
    }
    const searches = spentSince(scan, since);
    const usd = Math.round(searches * settings.costPerSearch * 1000) / 1000;
    const snap = snapshotOf({ hotel: h.hotel, city: h.city, state: h.state }, scan);
    if (snap) await saveSnapshot(key, label, snap);
    run.searches += searches;
    run.usd = Math.round((run.usd + usd) * 1000) / 1000;
    run.hotels[key] = { status: snap ? 'done' : 'not-graded', hotel: h.hotel, searches, usd, at: new Date().toISOString(), limited: scan?.limited || '' };
    await putJSON('monthly', runKey, run); // progress survives a timeout
  }
  run.finishedAt = run.paused ? null : new Date().toISOString();
  await putJSON('monthly', runKey, run);
  return run;
}

// ---------- the send ----------

/**
 * Sends the monthly email for the current issue.
 * Live (mode 'live' and every approval in place): eligible contacts, once each per issue, resumable.
 * Otherwise (test): at most TEST_LIMIT emails, all to MONTHLY_TEST_TO, each saying who it stands in for.
 * Every test run starts fresh, so a later test run that month still sends.
 */
export async function sendMonthly({ forceTest = false, deadlineMs = 13 * 60 * 1000 } = {}) {
  const started = Date.now();
  const settings = await getSettings();
  const live = !forceTest && settings.mode === 'live' && readiness(settings).ready;
  const label = issueMonth();
  const sendDate = issueDate(label);
  const testTo = process.env.MONTHLY_TEST_TO;
  const runKey = live ? `send-${label}` : `send-${label}-test-${Date.now()}`;
  const run = (live ? await getJSON('monthly', runKey) : null) ?? { month: label, live, startedAt: new Date().toISOString(), sent: {}, skipped: {}, count: 0 };
  if (!live && !testTo) { run.error = 'MONTHLY_TEST_TO not set'; await putJSON('monthly', runKey, run); return run; }
  const contacts = (await listContacts()).filter(eligible);
  let testSent = 0;
  for (const c of contacts) {
    if (run.sent[c.email]) continue;
    if (!live && testSent >= TEST_LIMIT) break;
    if (Date.now() - started > deadlineMs) { run.paused = true; break; }
    try {
      const h = c.hotels.find(Boolean);
      const snap = await snapshotFor(h.key, label);
      if (!snap) { run.skipped[c.email] = 'no snapshot for this issue'; continue; }
      const { snap: prev, since } = await previousFor(h, label);
      const { mail, unsubscribe } = buildEmail({ contact: c, snap, prev, since, sendDate, test: !live, testTo });
      const to = live ? c.email : testTo;
      const ok = await sendMonthlyMail({ to, mail, unsubscribe });
      if (ok) { run.sent[c.email] = { at: new Date().toISOString(), hotel: h.hotel, to }; run.count += 1; if (!live) testSent += 1; }
      else run.skipped[c.email] = 'send failed';
    } catch (err) {
      run.skipped[c.email] = `error: ${String(err?.message || err).slice(0, 120)}`;
    }
    await putJSON('monthly', runKey, run);
    await wait(600); // Resend allows about two sends a second
  }
  run.finishedAt = run.paused ? null : new Date().toISOString();
  await putJSON('monthly', runKey, run);
  if (!live) await putJSON('monthly', `send-${label}-test`, run); // the latest test run, for the admin
  return run;
}

export async function runRecord(key) { try { return await getJSON('monthly', key); } catch { return null; } }
