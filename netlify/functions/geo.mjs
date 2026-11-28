// GET /api/geo
// Whether this visitor's country needs an explicit opt-in for the monthly report card (EU/EEA, UK,
// Switzerland, Canada, or unknown). The gate uses it to decide whether the box starts ticked.

import { json } from '../lib/verify.mjs';
import { needsOptIn } from '../lib/contacts.mjs';

export default async (_req, context) => {
  const country = context?.geo?.country?.code ?? '';
  return json(200, { optInRequired: needsOptIn(country) });
};

export const config = { path: '/api/geo' };
