// Thin client for SerpApi (search-data provider). The key stays on the server.
// Every call costs one search from the monthly plan unless SerpApi served it
// from its own one-hour cache, so callers cache results and check the budget.
// Swapping provider later means replacing this file and the two normalizers
// that read its responses (scanner/prices.mjs).

const BASE = 'https://serpapi.com';

export const hasKey = () => !!process.env.SERPAPI_KEY;

/** One search. Returns { ok, data, error, ms }. Never throws. */
export async function search(params, { timeout = 8500 } = {}) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { ok: false, error: 'no-key', data: null, ms: 0 };
  const q = new URLSearchParams({ ...params, api_key: key, output: 'json' });
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/search?${q}`, { signal: AbortSignal.timeout(timeout) });
    const data = await res.json().catch(() => null);
    const ms = Date.now() - started;
    if (!res.ok || !data || data.error) return { ok: false, error: String(data?.error || `http-${res.status}`).slice(0, 200), data: null, ms };
    return { ok: true, data, error: '', ms };
  } catch (e) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'timeout' : 'network', data: null, ms: Date.now() - started };
  }
}

/** Searches left on the plan this month, or null if it couldn't be read. Free to call. */
export async function searchesLeft() {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}/account.json?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const a = await res.json();
    const left = a.total_searches_left ?? a.plan_searches_left;
    return typeof left === 'number' ? left : null;
  } catch { return null; }
}
