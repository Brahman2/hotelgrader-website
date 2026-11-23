// Types for assess.mjs.

export const METHOD_VERSION: string;
export const MIN_COVERAGE: number;
export const CUTOFFS: [number, string][];
export function letterFor(score: number | null | undefined): string;

export interface FunctionDef {
  key: string;
  name: string;
  short: string;
  /** Points out of 100. */
  weight: number;
  covers: string;
  notYet: string;
}
export const FUNCTIONS: FunctionDef[];

export type CheckStatus = 'pass' | 'partial' | 'fail' | 'unknown' | 'na';

export interface Check {
  id: string;
  label: string;
  /** Share of the function, out of 100. */
  max: number;
  /** 0..1, or null when nothing was observed. */
  earned: number | null;
  status: CheckStatus;
  observed: string;
  source: string;
  when: string | null;
  note?: string;
}

export interface FunctionResult extends FunctionDef {
  checks: Check[];
  /** Share of this function's points that had evidence, 0..1. */
  coverage: number;
  score: number | null;
}

export interface Priority {
  id: string;
  type: 'fix' | 'investigate' | 'operations';
  fn: string;
  points: number;
  title: string;
  evidence: string;
  why: string;
  outcome: string;
  owner: string;
  effort: string;
  confidence: 'Confirmed' | 'Likely' | 'Needs checking';
  proof: string;
}

export interface Rate { rate: number; source: string; mine?: boolean; official?: boolean; freeCancel?: boolean | null }
export interface NightPrices { night: string | null; kind: string; direct: Rate | null; lowest: Rate | null; gap: number | null; cheaper: number; others: number }

export interface LabRun { score: number; fcp: number | null; lcp: number | null; tbt: number | null; cls: number | null; si: number | null; bytes: number | null }
export interface FieldMetric { value: number; rating: string }

export interface Assessment {
  version: string;
  scannedAt: string | null;
  siteRead: boolean;
  siteNote: string;
  /** null when too little was observed to grade. */
  score: number | null;
  rawScore: number | null;
  letter: string;
  graded: boolean;
  /** Share of the whole assessment that had evidence, weighted by importance, 0..1. */
  coverage: number;
  functions: FunctionResult[];
  priorities: Priority[];
  strengths: { label: string; observed: string; fn: string; value: number }[];
  identity: { name: string; place: string; website: string; mapsUrl: string; bookingEngine: string; hotelClass: string; classSource: 'google' | 'model'; flags: string[] };
  choice: {
    scenario: string;
    rows: { name: string; you: boolean; rating: number | null; reviews: number | null; rate: number | null; rateNote: string }[];
    peers: number;
    setSize: number | null;
    basis: 'same-class' | 'near-class' | 'nearby' | 'model';
    compared: string[];
    notCompared: string[];
    verdict: string;
    /** Lowest rates shown for hotels around this one on the same night. */
    area: { median: number; count: number; low: number; high: number; own: number | null } | null;
  } | null;
  example: { finding: string; title: string; intro: string; code: string; handoff: string } | null;
  ads: {
    you: { name: string; google: boolean | null; googleBy: string[]; meta: boolean | null };
    rivals: { name: string; google: boolean | null; meta: boolean | null }[];
    brand: { query: string; own: boolean; others: string[] } | null;
  } | null;
  themes: {
    reviews: number | null;
    positive: { theme: string; mentions: number; quote?: string }[];
    negative: { theme: string; mentions: number; quote?: string; severity?: string }[];
  } | null;
  /** Google's own review topics and star spread for the listing. Shown, not scored. */
  voice: {
    topics: { name: string; mentions: number; positive: number; negative: number; negShare: number }[];
    stars: { stars: number; count: number; share: number }[];
    total: number;
    low: number | null;
  } | null;
  /** Where the hotel shows for the searches travellers type. Shown, not scored. */
  visibility: {
    rows: {
      query: string; kind: 'brand' | 'market'; when: string;
      /** Place in the regular results, or null when not in the first ten. */
      organic: number | null; organicKnown: boolean;
      /** Place on Google's own hotel search for the town, or null. */
      box: number | null; boxSize: number; boxShown: boolean; boxTop: string[]; boxNote: string;
      /** Brand search only: whether Google showed the hotel's own panel. */
      panel: boolean | null;
      holders: { who: string; count: number }[]; otas: number; results: number;
    }[];
    town: string; boxSearches: number; boxHits: number; organicHits: number; searches: number;
  } | null;
  /** Our own page speed run. Timings are milliseconds. Null when it hasn't run. */
  speed: {
    when: string;
    mobile: LabRun | null; desktop: LabRun | null;
    field: { overall: string; origin: boolean; lcp: FieldMetric | null; inp: FieldMetric | null; cls: FieldMetric | null } | null;
    /** The page as the test phone drew it, as a data address, or ''. */
    screenshot: string;
  } | null;
  prices: { night: string | null; direct: Rate | null; lowest: Rate | null; gap: number | null; cheaper: number; others: number; rows: Rate[]; ours: boolean; nights: NightPrices[]; rooms: { name: string; rate: number }[] } | null;
  headline: string;
  ai: { samples: { surface: string; query: string; mentioned: boolean | null; valid: boolean; when?: string; why: string; named: string[]; sources: string[] }[]; queries: string[] };
  counts: { checks: number; observed: number };
}

export function assess(audit: unknown, crawl?: unknown, live?: unknown): Assessment;
export function websiteOf(audit: unknown): string;
export interface CompSet {
  basis: string; ours: true; tier_label: string; rating_rank: number; total_in_set: number;
  top_competitors: { name: string; rating: number; reviews: number; rate: number | null; lat: number | null; lng: number | null }[];
}
/** Our own comparison set, or null when the grading API's set is still in use. */
export function compSet(audit: unknown, live?: unknown): CompSet | null;
