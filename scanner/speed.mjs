// Page speed collector. Google's PageSpeed Insights runs one lab visit on a
// phone and one on a desktop, and returns what real Chrome visitors measured
// over the last 28 days when the site has enough of them.
//
// It needs a Google API key (PAGESPEED_KEY). Without one Google's shared quota
// is almost always spent, so we don't try. A run takes 10 to 25 seconds.

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export const hasSpeedKey = () => !!process.env.PAGESPEED_KEY;

const audit = (lh, id) => { const a = lh?.audits?.[id]; return a && typeof a.numericValue === 'number' ? Math.round(a.numericValue * 1000) / 1000 : null; };

/** One lab run. Returns { ok, error, data }. Never throws. */
async function run(url, strategy, timeout) {
  const q = new URLSearchParams({ url, strategy, category: 'performance', key: process.env.PAGESPEED_KEY });
  try {
    const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(timeout) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.lighthouseResult) return { ok: false, error: String(data?.error?.status || data?.error?.message || `http-${res.status}`).slice(0, 120), data: null };
    return { ok: true, error: '', data };
  } catch (e) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'timeout' : 'network', data: null };
  }
}

/** The lab numbers from one run: score out of 100, and the timings behind it in milliseconds. */
function lab(data) {
  const lh = data.lighthouseResult;
  const score = lh.categories?.performance?.score;
  if (typeof score !== 'number') return null;
  return {
    score: Math.round(score * 100),
    fcp: audit(lh, 'first-contentful-paint'), lcp: audit(lh, 'largest-contentful-paint'),
    tbt: audit(lh, 'total-blocking-time'), cls: audit(lh, 'cumulative-layout-shift'), si: audit(lh, 'speed-index'),
    bytes: audit(lh, 'total-byte-weight'),
  };
}

/** What real visitors measured, when Google has enough of them. `origin` is true when it covers the whole site, not this page. */
function field(data) {
  const page = data.loadingExperience?.metrics ? data.loadingExperience : null;
  const src = page ?? (data.originLoadingExperience?.metrics ? data.originLoadingExperience : null);
  if (!src?.overall_category) return null;
  const m = (k) => (src.metrics[k] ? { value: src.metrics[k].percentile, rating: src.metrics[k].category } : null);
  const cls = m('CUMULATIVE_LAYOUT_SHIFT_SCORE');
  return {
    overall: src.overall_category, // FAST | AVERAGE | SLOW
    origin: !page || !!src.origin_fallback,
    lcp: m('LARGEST_CONTENTFUL_PAINT_MS'), inp: m('INTERACTION_TO_NEXT_PAINT'),
    cls: cls ? { ...cls, value: cls.value / 100 } : null,
  };
}

/** Tracking tags on the address don't change the page, and Google keeps its real-visitor data under the clean address. */
function tidy(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gclid|fbclid|msclkid|y_source)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch { return url; }
}

/**
 * The lab runs for one address, and the field data. `have` is an earlier reading with one run missing
 * (they sometimes time out); only the missing run is repeated and the two are merged.
 */
export async function scanSpeed(rawUrl, { timeout = Number(process.env.SPEED_TIMEOUT_MS || 40000), have = null } = {}) {
  const fetchedAt = new Date().toISOString();
  const url = tidy(rawUrl);
  if (!hasSpeedKey()) return { ok: false, error: 'no-key', fetchedAt, url };
  const skip = { ok: false, error: '', data: null };
  // One run per call. Two at once slow each other down, and a heavy site can take most of the time allowed.
  // The phone run comes first because it carries most of the points; the next call adds the desktop run.
  const wantMobile = !have?.mobile;
  const m = wantMobile ? await run(url, 'mobile', timeout) : skip;
  const d = !wantMobile && !have?.desktop ? await run(url, 'desktop', timeout) : skip;
  const mobile = have?.mobile ?? (m.ok ? lab(m.data) : null);
  const desktop = have?.desktop ?? (d.ok ? lab(d.data) : null);
  const shot = m.ok ? m.data.lighthouseResult.audits?.['final-screenshot']?.details?.data : '';
  return {
    ok: !!(mobile || desktop),
    error: [m, d].map((x) => x.error).filter(Boolean).join(', '),
    fetchedAt: have?.fetchedAt ?? fetchedAt, url,
    mobile, desktop,
    field: have?.field ?? ((m.ok && field(m.data)) || (d.ok && field(d.data)) || null),
    // The page as the test phone drew it. Kept only when it's a small image.
    screenshot: have?.screenshot || (typeof shot === 'string' && shot.startsWith('data:image/') && shot.length < 120000 ? shot : ''),
  };
}
