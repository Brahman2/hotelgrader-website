// Contacts for the monthly report card (see docs/monthly-report-card.md).
//
// One record per verified email address, in Netlify Blobs (store "contacts", strong consistency), keyed by a
// hash of the address. It holds the hotels the person unlocked, the country their request came from, and
// their consent: { monthly, explicit, at, source, country }. `explicit` is true only when the person ticked
// the box themselves.

import { createHash } from 'node:crypto';
import { matches, sign } from './verify.mjs';
import { scanKey } from './scan.mjs';

async function store() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'contacts', consistency: 'strong' });
}

// Default opt-in (the box starts ticked) only for the US and its territories. Everyone else, and anyone whose
// country we can't tell, gets the monthly email only after ticking the box themselves.
const DEFAULT_OPT_IN = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM']);

/** True when a contact from this country gets the monthly email only after an explicit opt-in. */
export const needsOptIn = (country) => !DEFAULT_OPT_IN.has(String(country || '').toUpperCase());

export const MAX_HOTELS = 5;

const idOf = (email) => createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);

/** The contact, or null when there is none. Throws when the store can't be read, so callers never overwrite on a failed read. */
export async function getContact(email) {
  if (!email) return null;
  const s = await store();
  return (await s.get(idOf(email), { type: 'json' })) ?? null;
}

export async function saveContact(c) {
  const s = await store();
  await s.setJSON(idOf(c.email), { ...c, updatedAt: new Date().toISOString() });
  return true;
}

/**
 * Records a verified unlock.
 *  - `optIn`: the monthly box as submitted (true / false), or undefined when the visitor didn't see it.
 *  - `explicit`: true when the visitor changed the box themselves.
 *  - `existingOnly`: only add the hotel to a contact that already exists (never create one).
 * Returns the contact, or null when nothing was written.
 */
export async function recordContact({ email, name, hotel, city, state, country, optIn, explicit = false, source = 'gate', existingOnly = false }) {
  const now = new Date().toISOString();
  const addr = String(email).trim().toLowerCase();
  let c;
  try { c = await getContact(addr); } catch { return null; } // can't read: write nothing
  if (!c && existingOnly) return null;
  c ??= { email: addr, name: '', createdAt: now, country: '', hotels: [], consent: null, unsubscribed: false };
  if (name) c.name = name;
  if (country && !c.country) c.country = String(country).toUpperCase();
  if (typeof optIn === 'boolean') {
    // Where the law asks for an opt-in, only a box the visitor ticked themselves counts.
    const monthly = needsOptIn(c.country) ? optIn && explicit : optIn;
    c.consent = { monthly, explicit: !!explicit, at: now, source, country: c.country || '' };
    // Only a deliberate tick undoes an earlier unsubscribe.
    if (monthly && explicit) c.unsubscribed = false;
  }
  if (hotel && c.hotels.length < MAX_HOTELS) {
    const key = scanKey({ hotel, city, state });
    if (!c.hotels.some((h) => h.key === key)) c.hotels.push({ key, hotel, city: city || '', state: state || '', addedAt: now });
  }
  await saveContact(c);
  return c;
}

/** Every contact. Throws when the store can't be listed. */
export async function listContacts() {
  const s = await store();
  const keys = (await s.list()).blobs.map((b) => b.key);
  const all = await Promise.all(keys.map((k) => s.get(k, { type: 'json' })));
  return all.filter(Boolean);
}

/** Whether this contact may get the monthly email: not unsubscribed, and consent recorded (explicit where the law asks). */
export function eligible(c) {
  if (!c || c.unsubscribed || !c.hotels?.length || !c.consent) return false;
  return needsOptIn(c.country) ? c.consent.monthly === true && c.consent.explicit === true : c.consent.monthly === true;
}

export function eligibilityReason(c) {
  if (!c) return 'missing';
  if (c.unsubscribed) return 'unsubscribed';
  if (!c.hotels?.length) return 'no hotel';
  if (!c.consent) return 'no consent recorded';
  if (needsOptIn(c.country)) return c.consent.monthly && c.consent.explicit ? 'opted in' : 'needs opt-in';
  return c.consent.monthly ? (c.consent.explicit ? 'opted in' : 'opted in by default (US)') : 'declined';
}

// ---------- unsubscribe ----------

export const unsubscribeToken = (secret, email) => sign(secret, 'unsubscribe', String(email).trim().toLowerCase()).slice(0, 32);
export const validUnsubscribe = (secret, email, token) => !!email && !!token && matches(token, unsubscribeToken(secret, email));

export function unsubscribeLink(secret, email) {
  const base = (process.env.URL || 'https://hotelgrader.com').replace(/\/$/, '');
  const q = new URLSearchParams({ e: String(email).trim().toLowerCase(), t: unsubscribeToken(secret, email) });
  return `${base}/api/unsubscribe?${q}`;
}

/** Unsubscribes, or undoes an unsubscribe. Undoing never grants consent: it only lifts the unsubscribe. */
export async function setUnsubscribed(email, value) {
  let c;
  try { c = await getContact(email); } catch { return false; }
  if (!c) return false;
  c.unsubscribed = !!value;
  c.unsubscribedAt = value ? new Date().toISOString() : null;
  await saveContact(c);
  return true;
}
