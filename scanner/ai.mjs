// AI-answer collector. Asks Google's AI Mode one question a guest might ask
// about hotels of this class in this town, and keeps the answer text so the
// report can say whether the hotel was named and which others were.
//
// One answer is a sample. AI answers change from one request to the next, so
// this counts for very little in the grade and is always shown with its date.

import { search } from './serpapi.mjs';

/** Every piece of answer text in the response, in order. The provider nests it in blocks and lists. */
function textOf(node, out = []) {
  if (!node || out.length > 400) return out;
  if (Array.isArray(node)) { node.forEach((n) => textOf(n, out)); return out; }
  if (typeof node !== 'object') return out;
  for (const k of ['title', 'snippet', 'text']) if (typeof node[k] === 'string' && node[k].trim()) out.push(node[k].trim());
  for (const k of ['list', 'text_blocks', 'rows', 'items', 'table']) if (node[k]) textOf(node[k], out);
  return out;
}

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

export function aiQuestion({ city, state, hotelClass }) {
  const place = [city, state].filter(Boolean).join(', ');
  return hotelClass ? `What are the best ${hotelClass}-star hotels in ${place}? Name specific hotels.` : `What are the best hotels in ${place}? Name specific hotels.`;
}

/** One search. Returns a record in the shape the assessment reads for AI samples. */
export async function aiAnswer(target) {
  const query = aiQuestion(target);
  const r = await search({ engine: 'google_ai_mode', q: query, gl: 'us', hl: 'en' });
  const base = { surface: 'Google AI Mode', model: 'google-ai-mode', intent: 'class-discovery', query, fetched_at: new Date().toISOString() };
  if (!r.ok) return { ok: false, error: r.error, searches: 0, records: [{ ...base, ok: false, response_text: '', sources: [] }] };
  const d = r.data;
  const text = textOf(d.text_blocks ?? d.ai_overview?.text_blocks ?? []).join('\n').slice(0, 6000);
  const sources = [...new Set((d.references ?? d.ai_overview?.references ?? []).map((x) => host(x.link ?? '')).filter(Boolean))].slice(0, 12);
  return {
    ok: text.length > 0, error: text.length ? '' : 'empty', searches: 1, fetchedAt: base.fetched_at,
    records: [{ ...base, ok: text.length > 0, response_text: text, sources }],
    shape: Object.keys(d).slice(0, 20),
  };
}
