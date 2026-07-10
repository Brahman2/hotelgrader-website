// Integration with the live hotelgrader backend.
//
// The production app (hotelgrader.com) is a SPA backed by a Railway API.
// Contract extracted from the live bundle on 2026-07-06:
//   GET  {HG_API}/api/hotel-autocomplete?query={q}
//        -> { success, suggestions: [{ name, description, place_id, secondary_text }] }
//   POST {HG_API}/api/generate-report
//        -> { hotelName, city, state, address, contactName, email, auditData }
//   Audit runner (live SPA): {HG_APP}/analyze?hotel={name}&city={city}&state={state}
//
// CORS on the API reflects any origin, so this works from localhost and any deploy.
// Override per environment in .env: PUBLIC_HG_API / PUBLIC_HG_APP.
// When this site is deployed at hotelgrader.com itself, set PUBLIC_HG_APP="" so
// handoff links stay relative.

export const HG_API: string =
  (import.meta.env.PUBLIC_HG_API as string | undefined) ??
  'https://web-production-13e22.up.railway.app';

export const HG_APP: string =
  (import.meta.env.PUBLIC_HG_APP as string | undefined) ?? 'https://hotelgrader.com';

export interface HotelSuggestion {
  name: string;
  description: string;
  place_id: string;
  secondary_text: string;
}

/** "Stockton Street, San Francisco, CA, USA" -> { city: "San Francisco", state: "CA" } */
export function parsePlace(s: HotelSuggestion): { city: string; state: string } {
  const parts = (s.secondary_text || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { city: parts[parts.length - 3], state: parts[parts.length - 2] };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: parts[1] };
  }
  return { city: s.secondary_text || '', state: '' };
}

/** Live audit runner URL for a selected hotel. */
export function analyzeUrl(hotel: string, city: string, state: string): string {
  const q = new URLSearchParams({ hotel, city, state });
  return `${HG_APP}/analyze?${q.toString()}`;
}

export async function fetchSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<HotelSuggestion[]> {
  const res = await fetch(
    `${HG_API}/api/hotel-autocomplete?query=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.success && Array.isArray(data.suggestions) ? data.suggestions : [];
}
