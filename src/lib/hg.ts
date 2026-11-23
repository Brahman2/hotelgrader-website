// Client for the live hotelgrader API (Flask on Railway).
//
//   GET  {HG_API}/api/hotel-autocomplete?query={q}
//        -> { success, suggestions: [{ name, description, place_id, secondary_text }] }
//   POST {HG_API}/api/analyze-hotel-async   { hotel_name, city, state, force_refresh, role }
//        -> { job_id, status: "pending" }            (fresh scan)
//        -> { cached: true, status: "completed", data } (recent scan, returned at once)
//   GET  {HG_API}/api/job-status/{job_id}
//        -> { status, progress, current_step, result?, error_message? }
//
// No login is needed for any of these. CORS reflects any origin, so the same
// code works on localhost, Netlify previews and production.
// Override the API host per environment with PUBLIC_HG_API in .env.

export const HG_API: string =
  (import.meta.env.PUBLIC_HG_API as string | undefined) ??
  'https://web-production-13e22.up.railway.app';

export interface HotelSuggestion {
  name: string;
  description: string;
  place_id: string;
  secondary_text: string;
}

/** "Stockton Street, San Francisco, CA, USA" -> { city: "San Francisco", state: "CA" } */
export function parsePlace(s: HotelSuggestion): { city: string; state: string } {
  const parts = (s.secondary_text || '').split(',').map((p) => p.trim()).filter(Boolean);
  const country = parts[parts.length - 1] || '';
  // US addresses end "..., City, ST, USA". Elsewhere they end "..., City, Country",
  // so the country stands in for the state.
  if (parts.length >= 3 && /^(USA|United States)$/i.test(country)) {
    return { city: parts[parts.length - 3], state: parts[parts.length - 2] };
  }
  if (parts.length >= 2) {
    return { city: parts[parts.length - 2], state: country };
  }
  return { city: s.secondary_text || '', state: '' };
}

/** Report card URL on this site for a selected hotel. */
export function gradeUrl(hotel: string, city: string, state: string): string {
  const q = new URLSearchParams({ hotel, city, state });
  return `/grade?${q.toString()}`;
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

// ---------- Grade ----------

export interface Metric {
  id: string;
  name: string;
  score: number | null;
  verified: boolean | null;
  insight?: string;
  recommendation?: string;
  /** Raw facts the API collected for this metric. Shape varies by metric. */
  verified_data?: Record<string, any> | null;
}

/** True when a metric has real data behind it this scan. */
export function isMeasured(m: Metric): boolean {
  return !!m.verified && m.score != null && !/not collected|no data/i.test(m.insight ?? '');
}

/**
 * Findings that contradict the rest of the scan, by name. They are left out of
 * the report instead of being shown next to the data that disproves them.
 *  - Review Volume is scored on an absolute scale, so it can read 100 while the
 *    hotel has fewer Google reviews than most of its comp set.
 *  - Recommendation Position repeats AI Mention Rate when no assistant named the
 *    hotel: one result, counted twice.
 */
export function contradicted(audit: Audit): Set<string> {
  const out = new Set<string>();
  const c = audit._meta?.competitors;
  if (c?.review_rank != null && c.total_in_set != null && c.review_rank > c.total_in_set / 2) out.add('Review Volume');
  const ai = audit.categories?.searchAndAI?.metrics ?? [];
  const mention = ai.find((m) => /ai mention rate/i.test(m.name));
  if (mention && isMeasured(mention) && mention.score === 0) out.add('Recommendation Position');
  return out;
}

/** The summary sentence, minus any strength the scan itself contradicts. */
export function keyFindingFor(audit: Audit): string {
  const text = audit.executiveSummary?.keyFinding ?? '';
  const hide = contradicted(audit);
  return text.split(/(?<=\.)\s+/).filter((s) => ![...hide].some((n) => s.includes(n))).join(' ');
}

export interface Category {
  score: number | null;
  metrics: Metric[];
}

export interface Audit {
  hotelName: string;
  city: string;
  state: string;
  overallScore: number;
  categories: Record<string, Category>;
  executiveSummary?: { keyFinding?: string };
  _meta?: {
    generatedAt?: string;
    competitors?: {
      own_rating?: number;
      own_reviews?: number;
      compset_avg_rating?: number;
      rating_rank?: number;
      review_rank?: number;
      total_in_set?: number;
      tier_label?: string;
      top_competitors?: { name: string; rating?: number; reviews?: number }[];
    };
    /** One-night prices found on Google's hotel search, per booking site. */
    booking_pricing?: {
      matched_name?: string;
      ota_rates?: { rate: number; source: string }[];
      identity?: { check_in?: string };
    };
    /** Whether each named competitor runs Google or Meta ads. null = couldn't tell. */
    compset_ads?: {
      competitors?: { name: string; google_ads?: boolean | null; meta_ads?: boolean | null; meta_ads_count?: number }[];
    };
    coverage?: { metrics_delivered?: number; metrics_expected?: number };
    overall_scoring?: { included?: string[] };
  };
}

// Same cutoffs the product uses, so a grade here matches the full report.
const CUTOFFS: [number, string][] = [
  [95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'], [75, 'C+'], [70, 'C'], [65, 'D+'], [60, 'D'],
];

export function letterFor(score: number | null | undefined): string {
  if (score == null) return '-';
  return CUTOFFS.find(([min]) => score >= min)?.[1] ?? 'F';
}

// Full class names (not built from parts) so Tailwind keeps them in the build.
const TONES: Record<string, string> = {
  A: 'grade--a', B: 'grade--b', C: 'grade--c', D: 'grade--d', F: 'grade--f',
};

/** Colour class for a letter grade, from the A-F palette in global.css. */
export function gradeTone(letter: string): string {
  return TONES[letter.charAt(0)] ?? '';
}

export interface OwnScan {
  /** An empty scan in the grading API's shape, so the assessment can run on our evidence alone. Null when nothing was read. */
  base: Audit | null;
  crawl: unknown | null;
  live: Record<string, unknown> | null;
  pending?: boolean;
  /** Why spending stopped, if it did: 'monthly' or 'daily'. */
  limited?: string;
}

/**
 * Our own scan of the hotel: prices, the hotels around it, its website, the brand search and an AI question.
 * It comes back in stages, so this asks again while the server says more is pending, and reports each stage
 * to `onProgress` as it lands. Null when it couldn't be reached.
 */
export async function fetchScan(hotel: string, city: string, state: string, signal?: AbortSignal, onProgress?: (scan: OwnScan) => void): Promise<OwnScan | null> {
  let last: OwnScan | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel, city, state }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
      });
      if (!res.ok) return last;
      const scan = ((await res.json())?.scan ?? null) as OwnScan | null;
      if (!scan) return last;
      last = scan;
      onProgress?.(scan);
      if (!scan.pending) return scan;
    } catch { if (signal?.aborted) return last; }
  }
  return last;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a scan and resolve with the finished audit. Rejects on API errors or
 * after ~4 minutes.
 */
export async function runAudit(
  hotel: string,
  city: string,
  state: string,
  signal?: AbortSignal,
): Promise<Audit> {
  const start = await fetch(`${HG_API}/api/analyze-hotel-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotel_name: hotel, city, state, force_refresh: false, role: 'general_manager' }),
    signal,
  });
  const started = await start.json().catch(() => ({}));
  if (!start.ok || !started.success) {
    throw new Error(started.message || started.error || 'The scan could not start.');
  }
  if (started.status === 'completed' && started.data) return started.data as Audit;
  if (!started.job_id) throw new Error('The scan could not start.');

  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const res = await fetch(`${HG_API}/api/job-status/${started.job_id}`, { signal });
    if (!res.ok) continue;
    const job = await res.json();
    if (job.status === 'completed' && job.result) return job.result as Audit;
    if (job.status === 'failed' || job.error_message) {
      throw new Error(job.error_message || 'The scan failed.');
    }
  }
  throw new Error('The scan is taking longer than usual. Try again in a minute.');
}
