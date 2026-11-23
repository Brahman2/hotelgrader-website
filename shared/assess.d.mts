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

export interface Rate { rate: number; source: string; mine?: boolean }

export interface Assessment {
  version: string;
  scannedAt: string | null;
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
  identity: { name: string; place: string; website: string; mapsUrl: string; bookingEngine: string; hotelClass: string; flags: string[] };
  choice: {
    scenario: string;
    rows: { name: string; you: boolean; rating: number | null; reviews: number | null; rate: number | null; rateNote: string }[];
    peers: number;
    setSize: number | null;
    compared: string[];
    notCompared: string[];
    verdict: string;
  } | null;
  example: { finding: string; title: string; intro: string; code: string; handoff: string } | null;
  ads: {
    you: { name: string; google: boolean | null; googleBy: string[]; meta: boolean | null };
    rivals: { name: string; google: boolean | null; meta: boolean | null }[];
  } | null;
  themes: {
    reviews: number | null;
    positive: { theme: string; mentions: number; quote?: string }[];
    negative: { theme: string; mentions: number; quote?: string; severity?: string }[];
  } | null;
  prices: { night: string | null; direct: Rate | null; lowest: Rate | null; gap: number | null; cheaper: number; others: number; rows: Rate[] } | null;
  headline: string;
  ai: { samples: { surface: string; query: string; mentioned: boolean | null; valid: boolean; when?: string; why: string }[]; queries: string[] };
  counts: { checks: number; observed: number };
}

export function assess(audit: unknown): Assessment;
