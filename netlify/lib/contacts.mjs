// Contacts for the monthly report card (see docs/monthly-report-card.md).
//
// One record per verified email address, in Netlify Blobs (store "contacts"), keyed by a hash of the address.
// It holds the hotels the person unlocked, the country their request came from, and their consent.

import { createHash } from 'node:crypto';
import { matches, sign } from './verify.mjs';
import { scanKey } from './scan.mjs';

async function store() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('contacts');
  } catch { return null; } // not on Netlify
}

// EU member states, the rest of the EEA, the UK, Switzerland and Canada: monthly email only with an explicit opt-in.
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
export const OPT_IN_COUNTRIES = new Set([...EU, 'IS', 'LI', 'NO', 'GB', 'CH', 'CA']);

/** True when a contact from this country gets the monthly email only after opting in. Unknown country counts as yes. */
export const needsOptIn = (country) => !country || OPT_IN_COUNTRIES.has(String(country).toUpperCase());

const idOf = (email) => createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);

export async function getContact(email) {
  const s = await store();
  if (!s || !email) return null;
  try { return await s.get(idOf(email), { type: 'json' }); } catch { return null; }
}

export async function saveContact(c) {
  const s = await store();
  if (!s || !c?.email) return false;
  try { await s.setJSON(idOf(c.email), { ...c, updatedAt: new Date().toISOString() }); return true; } catch { return false; }
}

/**
 * Adds a person (or a hotel to an existing person). `optIn` is the monthly checkbox from the gate:
 * true or false when the visitor saw it, undefined otherwise (the existing consent is kept then).
 */
export async function recordContact({ email, name, hotel, city, state, country, optIn, source = 'gate' }) {
  const now = new Date().toISOString();
  const addr = String(email).trim().toLowerCase();
  const c = (await getContact(addr)) ?? { email: addr, name: '', createdAt: now, country: '', hotels: [], consent: null, unsubscribed: false };
  if (name) c.name = name;
  if (country && !c.country) c.country = String(country).toUpperCase();
  if (typeof optIn === 'boolean') {
    c.consent = { monthly: optIn, at: now, source, country: c.country || '' };
    if (optIn) c.unsubscribed = false; // ticking the box again is a fresh opt-in
  }
  if (hotel) {
    const key = scanKey({ hotel, city, state });
    if (!c.hotels.some((h) => h.key === key)) c.hotels.push({ key, hotel, city: city || '', state: state || '', addedAt: now });
  }
  await saveContact(c);
  return c;
}

export async function listContacts() {
  const s = await store();
  if (!s) return [];
  let keys = [];
  try { keys = (await s.list()).blobs.map((b) => b.key); } catch { return []; }
  const all = await Promise.all(keys.map((k) => s.get(k, { type: 'json' }).catch(() => null)));
  return all.filter(Boolean);
}

/** Whether this contact may get the monthly email: not unsubscribed, and opted in where the law asks for it. */
export function eligible(c) {
  if (!c || c.unsubscribed || !c.hotels?.length) return false;
  const opted = c.consent?.monthly;
  return needsOptIn(c.country) ? opted === true : opted !== false;
}

export function eligibilityReason(c) {
  if (!c) return 'missing';
  if (c.unsubscribed) return 'unsubscribed';
  if (!c.hotels?.length) return 'no hotel';
  if (needsOptIn(c.country)) return c.consent?.monthly === true ? 'opted in' : 'needs opt-in';
  return c.consent?.monthly === false ? 'declined' : 'opted in by default';
}

// ---------- unsubscribe ----------

export const unsubscribeToken = (secret, email) => sign(secret, 'unsubscribe', String(email).trim().toLowerCase()).slice(0, 32);
export const validUnsubscribe = (secret, email, token) => !!email && !!token && matches(token, unsubscribeToken(secret, email));

export function unsubscribeLink(secret, email) {
  const base = (process.env.URL || 'https://hotelgrader.com').replace(/\/$/, '');
  const q = new URLSearchParams({ e: String(email).trim().toLowerCase(), t: unsubscribeToken(secret, email) });
  return `${base}/api/unsubscribe?${q}`;
}

export async function setUnsubscribed(email, value) {
  const c = await getContact(email);
  if (!c) return false;
  c.unsubscribed = !!value;
  c.unsubscribedAt = value ? new Date().toISOString() : null;
  if (!value) c.consent = { monthly: true, at: new Date().toISOString(), source: 'resubscribe', country: c.country || '' };
  return saveContact(c);
}
