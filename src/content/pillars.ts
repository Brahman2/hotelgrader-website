// The seven sections, named and ordered exactly like the live product's audit
// (GEO & AI Visibility first — it runs first in the real scan queue).

export interface Pillar {
  num: string;
  name: string;
  /** Short code used in dense UI (scan rows, sub-grade strips) */
  short: string;
  /** Share of the overall grade, percent. Sums to 100 across sections. */
  weight: number;
  /** Detailed line used on the report page */
  oneLiner: string;
  /** Punchy line with personality, used on the marketing homepage */
  punch: string;
  /** Sample sub-grade for the demo surfaces */
  sample: {
    grade: string;
    /** Numeric section score, like the product's "94/100" */
    score: number;
    tone: 'good' | 'warn' | 'attention';
    stat: string;
    delta: string;
    /** 0-100 position on the F-to-A scale (higher is better) */
    position: number;
    compMedian: number;
  };
}

export const pillars: Pillar[] = [
  {
    num: '01',
    name: 'GEO & AI Visibility',
    short: 'AI',
    weight: 20,
    oneLiner: 'AI mention rate across ChatGPT, Gemini, Perplexity, Copilot. Answer panels.',
    punch: 'Ask ChatGPT for a hotel here. It won’t say yours.',
    sample: { grade: 'D', score: 45, tone: 'attention', stat: 'AI mention rate 14% · 1 of 4 engines', delta: 'Bottom 25%', position: 26, compMedian: 52 },
  },
  {
    num: '02',
    name: 'Website & Digital Presence',
    short: 'WEB',
    weight: 18,
    oneLiner: 'Site speed, mobile experience, search visibility, structured data.',
    punch: 'Loads in 2.1 seconds and Google has no complaints.',
    sample: { grade: 'B+', score: 94, tone: 'good', stat: 'Performance 94/100 · mobile 91/100', delta: '+6 pts vs last month', position: 78, compMedian: 54 },
  },
  {
    num: '03',
    name: 'Reputation Management',
    short: 'REP',
    weight: 16,
    oneLiner: 'Review velocity, sentiment, response rate, score parity across platforms.',
    punch: '4.7 stars, with three reviews still waiting on a reply.',
    sample: { grade: 'B+', score: 88, tone: 'good', stat: '4.7 ★ · 88% reply rate', delta: '+0.2 vs last month', position: 80, compMedian: 58 },
  },
  {
    num: '04',
    name: 'Social Media',
    short: 'SOC',
    weight: 10,
    oneLiner: 'Cadence, engagement, content performance against the comp set.',
    punch: '4.2 posts a week at 0.8% engagement. The comp set runs 2.4%.',
    sample: { grade: 'B', score: 71, tone: 'good', stat: '4.2 posts / wk · 0.8% engagement', delta: '+0.6 vs comp', position: 66, compMedian: 50 },
  },
  {
    num: '05',
    name: 'Advertising & Brand',
    short: 'ADS',
    weight: 12,
    oneLiner: 'Paid efficiency, brand-search defense, share of voice.',
    punch: 'You’re buying clicks the OTAs already own.',
    sample: { grade: 'C+', score: 62, tone: 'warn', stat: '2 OTA ads above your name · 62% share of voice', delta: '−3 pts vs last month', position: 52, compMedian: 56 },
  },
  {
    num: '06',
    name: 'Booking & Distribution',
    short: 'BKG',
    weight: 14,
    oneLiner: 'Direct funnel, OTA mix, metasearch visibility, rate presentation.',
    punch: 'Every third booking pays a commission it shouldn’t.',
    sample: { grade: 'C', score: 58, tone: 'warn', stat: '58% OTA share · direct 38%', delta: '−4 vs comp', position: 46, compMedian: 55 },
  },
  {
    num: '07',
    name: 'Competitive Intelligence',
    short: 'COMP',
    weight: 10,
    oneLiner: 'Rank, momentum, and gaps against the properties you actually lose bookings to.',
    punch: 'The properties that take your bookings, and where each one underperforms.',
    sample: { grade: 'A-', score: 87, tone: 'good', stat: '#18 of 74 · top 25%', delta: '+18 vs comp', position: 88, compMedian: 50 },
  },
];
