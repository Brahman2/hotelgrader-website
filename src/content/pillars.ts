// The seven sections, named and ordered exactly like the live product's audit
// (GEO & AI Visibility first: it runs first in the real scan queue).

export interface Pillar {
  /** Category key in the API's audit payload */
  key: string;
  num: string;
  name: string;
  /** Short code used in dense UI (scan rows, sub-grade strips) */
  short: string;
  /** Share of the overall grade, percent. Sums to 100 across sections. */
  weight: number;
  /** What the section measures */
  oneLiner: string;
}

export const pillars: Pillar[] = [
  {
    key: 'searchAndAI',
    num: '01',
    name: 'GEO & AI Visibility',
    short: 'AI',
    weight: 20,
    oneLiner: 'AI mention rate across ChatGPT, Gemini, Perplexity, Copilot. Answer panels.',
  },
  {
    key: 'digitalPresence',
    num: '02',
    name: 'Website & Digital Presence',
    short: 'WEB',
    weight: 18,
    oneLiner: 'Site speed, mobile experience, search visibility, structured data.',
  },
  {
    key: 'reputation',
    num: '03',
    name: 'Reputation Management',
    short: 'REP',
    weight: 16,
    oneLiner: 'Review velocity, sentiment, response rate, score parity across platforms.',
  },
  {
    key: 'socialMedia',
    num: '04',
    name: 'Social Media',
    short: 'SOC',
    weight: 10,
    oneLiner: 'Cadence, engagement, content performance against the comp set.',
  },
  {
    key: 'advertising',
    num: '05',
    name: 'Advertising & Brand',
    short: 'ADS',
    weight: 12,
    oneLiner: 'Paid efficiency, brand-search defense, share of voice.',
  },
  {
    key: 'booking',
    num: '06',
    name: 'Booking & Distribution',
    short: 'BKG',
    weight: 14,
    oneLiner: 'Direct funnel, OTA mix, metasearch visibility, rate presentation.',
  },
  {
    key: 'competitive',
    num: '07',
    name: 'Competitive Intelligence',
    short: 'COMP',
    weight: 10,
    oneLiner: 'Rank, momentum, and gaps against the properties you actually lose bookings to.',
  },
];
