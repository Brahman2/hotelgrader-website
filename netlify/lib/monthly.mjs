// The monthly report card (see docs/monthly-report-card.md): settings, snapshots, the re-scan and the send.
//
// Safety: sendMonthly() only sends to contacts when settings.mode is 'live' AND every approval is in place.
// In every other case it sends at most a few emails, and only to MONTHLY_TEST_TO.

import { assess, compSet } from '../../shared/assess.mjs';
import { scanFor, scanKey } from './scan.mjs';
import { sendMail, sign, matches } from './verify.mjs';
import { reportLink } from './report.mjs';
import { eligible, listContacts, unsubscribeLink } from './contacts.mjs';
import { monthlyEmail, TEMPLATE_VERSION } from './email.mjs';
import { tipFor } from './tips.mjs';

async function store(name) {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore(name);
  } catch { return null; }
}
async function getJSON(name, key) { const s = await store(name); try { return s ? await s.get(key, { type: 'json' }) : null; } catch { return null; } }
async function putJSON(name, key, v) { const s = await store(name); try { if (s) await s.setJSON(key, v); return !!s; } catch { return false; } }

// ---------- settings ----------

export const DEFAULTS = {
  enabled: false, mode: 'test', capUsd: 25, costPerSearch: 0.015,
  templateApprovedVersion: null, templateApprovedAt: null, templateApprovedBy: null,
  sampleSentAt: null, sampleSentVersion: null, sampleApprovedAt: null, sampleApprovedBy: null,
};
// The most one hotel's re-scan can spend (prices with the class search, profile, brand search, AI, reviews, ads).
export const MAX_SEARCHES_PER_HOTEL = 16;
export const TEST_LIMIT = 3;

export async function getSettings() {
  const s = { ...DEFAULTS, ...((await getJSON('monthly', 'settings')) ?? {}) };
  // A template change voids the approvals and drops the program back to test.
  if (s.templateApprovedVersion && s.templateApprovedVersion !== TEMPLATE_VERSION) {
    Object.assign(s, { templateApprovedVersion: null, templateApprovedAt: null, sampleApprovedAt: null, mode: 'test' });
  }
  return s;
}
export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch, updatedAt: new Date().toISOString() };
  await putJSON('monthly', 'settings', next);
  return next;
}

/** Everything that must be true before live sending, with the first thing missing. */
export function readiness(s) {
  const missing = [];
  if (s.templateApprovedVersion !== TEMPLATE_VERSION) missing.push('template not approved at the current version');
  if (!s.sampleApprovedAt || !s.sampleSentAt || s.sampleSentVersion !== TEMPLATE_VERSION) missing.push('sample not approved');
  if (!process.env.MAIL_POSTAL_ADDRESS) missing.push('MAIL_POSTAL_ADDRESS not set');
  if (!process.env.MONTHLY_TEST_TO) missing.push('MONTHLY_TEST_TO not set');
  return { ready: missing.length === 0, missing };
}

export const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);

// ---------- internal calls between functions ----------

export const internalToken = (secret) => sign(secret, 'monthly-internal', new Date().toISOString().slice(0, 10)).slice(0, 40);
export const validInternal = (secret, t) => !!t && matches(t, internalToken(secret));

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
    score: a.score, letter: a.letter,
    hotelClass: c?.hotel_class ?? scan.live?.prices?.hotel?.hotelClass ?? null,
    sections: a.functions.filter((f) => f.score != null).map((f) => ({ name: f.name, score: f.score })),
    rank: c?.rating_rank != null ? { place: c.rating_rank, total: c.total_in_set, basis: c.basis } : null,
    rating: c?.own_rating ?? scan.live?.prices?.hotel?.rating ?? null,
    reviews: c?.own_reviews ?? scan.live?.prices?.hotel?.reviews ?? null,
    recent: a.recent ? { total: a.recent.total, replied: a.recent.replied, low: a.recent.low, lowUnanswered: a.recent.lowUnanswered } : null,
    fixes: a.priorities.map((p) => ({ title: p.title, evidence: p.evidence, owner: p.owner, type: p.type })),
    profile: prof?.ok ? { found: !!prof.found, unclaimed: prof.unclaimed } : null,
  };
}

/** Saves a snapshot under the hotel's key. `label` is the month (YYYY-MM) or "unlock-YYYY-MM-DD". */
export async function saveSnapshot(key, label, snap) {
  if (!snap) return false;
  return putJSON('monthly-snapshots', `${key}/${label}`, { ...snap, label });
}

/** The newest snapshot for a hotel taken before `beforeIso`, or null. */
export async function previousSnapshot(key, beforeIso) {
  const s = await store('monthly-snapshots');
  if (!s) return null;
  let keys = [];
  try { keys = (await s.list({ prefix: `${key}/` })).blobs.map((b) => b.key); } catch { return null; }
  const all = (await Promise.all(keys.map((k) => s.get(k, { type: 'json' }).catch(() => null)))).filter(Boolean);
  return all.filter((x) => x.at < beforeIso).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;
}
export async function snapshotFor(key, label) { return getJSON('monthly-snapshots', `${key}/${label}`); }

/** A baseline at unlock, from cached readings only (never spends a search). */
export async function baselineAtUnlock(target) {
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const snap = snapshotOf(target, scan);
  if (snap) await saveSnapshot(scanKey(target), `unlock-${new Date().toISOString().slice(0, 10)}`, snap);
  return snap;
}

// ---------- what changed ----------

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/** Plain-language changes between two snapshots, most important first. Each: { text, tone: good | bad | neutral }. */
export function changesBetween(prev, cur) {
  if (!prev || !cur) return { first: true, items: [] };
  const items = [];
  const sameMethod = prev.version === cur.version;
  if (!sameMethod) {
    items.push({ tone: 'neutral', text: `We improved how we grade (method v${prev.version} to v${cur.version}), so your score isn’t directly comparable to last time. Your grade under the new method is ${cur.letter} (${cur.score}).` });
  } else if (cur.score !== prev.score) {
    items.push({ tone: cur.score > prev.score ? 'good' : 'bad', text: `Your score went ${cur.score > prev.score ? 'up' : 'down'} from ${prev.score} to ${cur.score}${cur.letter !== prev.letter ? `, from ${prev.letter} to ${cur.letter}` : ''}.` });
  }
  if (sameMethod) {
    const moved = cur.sections.map((s) => ({ ...s, was: prev.sections.find((p) => p.name === s.name)?.score }))
      .filter((s) => s.was != null && Math.abs(s.score - s.was) >= 3)
      .sort((a, b) => Math.abs(b.score - b.was) - Math.abs(a.score - a.was)).slice(0, 2);
    for (const s of moved) items.push({ tone: s.score > s.was ? 'good' : 'bad', text: `${s.name}: ${s.was} to ${s.score} (${signed(s.score - s.was)}).` });
  }
  if (prev.rank && cur.rank && prev.rank.place !== cur.rank.place) {
    items.push({ tone: cur.rank.place < prev.rank.place ? 'good' : 'bad', text: `You moved from #${prev.rank.place} to #${cur.rank.place} of ${cur.rank.total} on Google rating among the hotels you compete with.` });
  }
  if (prev.reviews != null && cur.reviews != null && cur.reviews > prev.reviews) {
    items.push({ tone: 'neutral', text: `${(cur.reviews - prev.reviews).toLocaleString('en-US')} new Google reviews (${cur.reviews.toLocaleString('en-US')} in all)${prev.rating != null && cur.rating != null && cur.rating !== prev.rating ? `, and your rating went from ${prev.rating} to ${cur.rating}` : ''}.` });
  } else if (prev.rating != null && cur.rating != null && cur.rating !== prev.rating) {
    items.push({ tone: cur.rating > prev.rating ? 'good' : 'bad', text: `Your Google rating went from ${prev.rating} to ${cur.rating}.` });
  }
  if (prev.recent && cur.recent && prev.recent.lowUnanswered !== cur.recent.lowUnanswered) {
    items.push({ tone: cur.recent.lowUnanswered < prev.recent.lowUnanswered ? 'good' : 'bad', text: `Unanswered low-star reviews: ${prev.recent.lowUnanswered} to ${cur.recent.lowUnanswered}.` });
  }
  if (prev.profile?.unclaimed === true && cur.profile?.unclaimed === false) items.push({ tone: 'good', text: 'Your Google profile is now claimed.' });
  if (sameMethod) {
    const was = new Set(prev.fixes.map((f) => f.title));
    const now = new Set(cur.fixes.map((f) => f.title));
    const done = prev.fixes.find((f) => !now.has(f.title));
    const fresh = cur.fixes.find((f) => !was.has(f.title));
    if (done) items.push({ tone: 'good', text: `Off your list: ${done.title}.` });
    if (fresh) items.push({ tone: 'bad', text: `New on your list: ${fresh.title}.` });
  }
  return { first: false, since: prev.label?.startsWith('unlock-') ? 'when you first saw your grade' : 'last month', items: items.slice(0, 5) };
}

// ---------- the email for one contact ----------

export function buildEmail({ contact, snap, prev, sendDate = new Date(), test = false, wouldGoTo = '' }) {
  const secret = process.env.VERIFY_SECRET;
  const changes = changesBetween(prev, snap);
  const tip = tipFor(sendDate, { city: snap.city, hotelClass: snap.hotelClass });
  const others = (contact.hotels ?? []).filter((h) => h.hotel !== snap.hotel).map((h) => h.hotel);
  return monthlyEmail({
    name: contact.name, snap, prev, changes, tip, others,
    link: reportLink(secret, snap.hotel, snap.city, snap.state),
    unsubscribe: unsubscribeLink(secret, contact.email),
    postal: process.env.MAIL_POSTAL_ADDRESS || '',
    month: sendDate,
    test, wouldGoTo,
  });
}

/** Sends one monthly email with one-click unsubscribe headers. */
export async function sendMonthlyMail({ to, mail, unsubscribe }) {
  return sendMail({
    to, subject: mail.subject, text: mail.text, html: mail.html,
    headers: {
      'List-Unsubscribe': `<${unsubscribe}>, <mailto:${(process.env.REPLY_TO || 'hello@hotelgrader.com')}?subject=unsubscribe>`,
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

/** Re-scans every hotel any contact unlocked, within the spend cap. Resumable: a rerun skips hotels already done this month. */
export async function rescanAll({ deadlineMs = 13 * 60 * 1000 } = {}) {
  const started = Date.now();
  const settings = await getSettings();
  const month = monthOf();
  const runKey = `rescan-${month}`;
  const run = (await getJSON('monthly', runKey)) ?? { month, startedAt: new Date().toISOString(), hotels: {}, searches: 0, usd: 0, stoppedForCap: false };
  const contacts = await listContacts();
  const hotels = new Map();
  for (const c of contacts) for (const h of c.hotels ?? []) if (!hotels.has(h.key)) hotels.set(h.key, h);
  run.total = hotels.size;
  for (const [key, h] of hotels) {
    if (run.hotels[key]?.status === 'done') continue;
    if (Date.now() - started > deadlineMs) { run.paused = true; break; }
    const worst = MAX_SEARCHES_PER_HOTEL * settings.costPerSearch;
    if (run.usd + worst > settings.capUsd) { run.stoppedForCap = true; run.hotels[key] = { status: 'skipped-cap', at: new Date().toISOString() }; continue; }
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
    if (snap) await saveSnapshot(key, month, snap);
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
 * Sends the monthly email. In test mode (or whenever live isn't fully approved) it sends at most TEST_LIMIT
 * emails, all to MONTHLY_TEST_TO, each saying who it would have gone to. Live mode sends to eligible contacts,
 * once each per month.
 */
export async function sendMonthly({ forceTest = false } = {}) {
  const settings = await getSettings();
  const live = !forceTest && settings.mode === 'live' && readiness(settings).ready;
  const month = monthOf();
  const runKey = `send-${month}${live ? '' : '-test'}`;
  const run = (await getJSON('monthly', runKey)) ?? { month, live, startedAt: new Date().toISOString(), sent: {}, skipped: {}, count: 0 };
  const testTo = process.env.MONTHLY_TEST_TO;
  if (!live && !testTo) { run.error = 'MONTHLY_TEST_TO not set'; await putJSON('monthly', runKey, run); return run; }
  const contacts = (await listContacts()).filter(eligible);
  let testSent = 0;
  for (const c of contacts) {
    if (run.sent[c.email]) continue;
    if (!live && testSent >= TEST_LIMIT) break;
    const h = c.hotels.find(Boolean);
    const snap = await snapshotFor(h.key, month);
    if (!snap) { run.skipped[c.email] = 'no snapshot this month'; continue; }
    const prev = await previousSnapshot(h.key, snap.at);
    const mail = buildEmail({ contact: c, snap, prev, test: !live, wouldGoTo: c.email });
    const to = live ? c.email : testTo;
    const ok = await sendMonthlyMail({ to, mail, unsubscribe: unsubscribeLink(process.env.VERIFY_SECRET, c.email) }).catch(() => false);
    if (ok) { run.sent[c.email] = { at: new Date().toISOString(), hotel: h.hotel, to }; run.count += 1; if (!live) testSent += 1; }
    else run.skipped[c.email] = 'send failed';
    await putJSON('monthly', runKey, run);
    await wait(600); // Resend allows about two sends a second
  }
  run.finishedAt = new Date().toISOString();
  await putJSON('monthly', runKey, run);
  return run;
}

export async function runRecord(key) { return getJSON('monthly', key); }
