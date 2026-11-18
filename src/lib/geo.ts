// Locates a hotel by name so the regional scanner can plot real positions.
// Uses OpenStreetMap's public Nominatim search: one request at a time, spaced
// out, cached for the session. A hotel it can't find is simply not plotted.

export interface LatLon { lat: number; lon: number }

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GAP_MS = 1100;

let chain: Promise<unknown> = Promise.resolve();
let last = 0;

function cached(key: string): LatLon | null | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw == null ? undefined : (JSON.parse(raw) as LatLon | null);
  } catch { return undefined; }
}

async function search(q: string, signal?: AbortSignal): Promise<LatLon | null> {
  const key = `hg-geo:${q.toLowerCase()}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  const wait = Math.max(0, last + GAP_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (signal?.aborted) return null;
  last = Date.now();
  const res = await fetch(`${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string }[];
  const found = rows[0] ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null;
  try { sessionStorage.setItem(key, JSON.stringify(found)); } catch { /* fine */ }
  return found;
}

/** Tries the full name, then simpler spellings ("X Hotel & Swim Club" -> "X Hotel"). */
export function geocode(name: string, city: string, state: string, signal?: AbortSignal): Promise<LatLon | null> {
  const place = [city, state].filter(Boolean).join(', ');
  const names = [...new Set([name, name.split(/\s+(?:&|and|by)\s+/i)[0], name.replace(/&/g, 'and')])];
  const run = async () => {
    for (const n of names) {
      try {
        const found = await search(place ? `${n}, ${place}` : n, signal);
        if (found) return found;
      } catch { return null; }
    }
    return null;
  };
  const next = chain.then(run, run);
  chain = next;
  return next;
}

/** Metres east (x) and north (y) of `from`. Good enough at city scale. */
export function offset(from: LatLon, to: LatLon): { x: number; y: number } {
  const x = (to.lon - from.lon) * 111320 * Math.cos((from.lat * Math.PI) / 180);
  const y = (to.lat - from.lat) * 110540;
  return { x, y };
}

/** The city itself, for when the hotel can't be pinned. */
export function geocodeCity(city: string, state: string, signal?: AbortSignal): Promise<LatLon | null> {
  const q = [city, state].filter(Boolean).join(', ');
  if (!q) return Promise.resolve(null);
  const run = () => search(q, signal).catch(() => null);
  const next = chain.then(run, run);
  chain = next;
  return next;
}
