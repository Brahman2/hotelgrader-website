// Email templates. Two looks that mirror the site's two themes: the dark
// terminal style and the light style. The browser tells us which theme the
// visitor is in, and the email follows it. Table-based markup with inline
// styles, because that is what email clients render reliably.

import { createHash } from 'node:crypto';
import { escapeHtml as e } from './verify.mjs';
import { TIPS, tipFor } from './tips.mjs';

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const THEMES = {
  dark: {
    scheme: 'dark', font: MONO, num: MONO, radius: 3,
    bg: '#0B0D0C', panel: '#121514', ink: '#E6EAE7', muted: '#A4ABA7', faint: '#6F7672',
    accent: '#6EF3A5', edge: '#2A302D', btnBg: '#6EF3A5', btnFg: '#0B0D0C',
    grade: { A: '#6EF3A5', B: '#B6E36A', C: '#F2C14E', D: '#F28C4E', F: '#F2595C' },
  },
  light: {
    scheme: 'light', font: SANS, num: MONO, radius: 12,
    bg: '#F5F5F7', panel: '#FFFFFF', ink: '#14151A', muted: '#5E5F66', faint: '#8B8C93',
    accent: '#5B5BD6', edge: '#E2E2E8', btnBg: '#5B5BD6', btnFg: '#FFFFFF',
    grade: { A: '#1E8E5A', B: '#5F8F1E', C: '#B9811A', D: '#C6611F', F: '#C8383F' },
  },
};

export const themeOf = (name) => THEMES[name === 'light' ? 'light' : 'dark'];
const tone = (t, letter) => t.grade[(letter || 'F').charAt(0)] || t.muted;

function brand(t) {
  if (t.scheme === 'dark') {
    return `<span style="font-family:${t.font};font-size:18px;font-weight:600;color:${t.ink};letter-spacing:-0.5px">hotelgrader</span><span style="display:inline-block;width:10px;height:18px;margin-left:3px;background:${t.accent};vertical-align:-3px">&nbsp;</span>`;
  }
  return `<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:6px;background:${t.accent};color:#FFFFFF;font-family:${t.font};font-size:13px;font-weight:600;text-align:center;vertical-align:middle">hg</span><span style="font-family:${t.font};font-size:18px;font-weight:650;color:${t.ink};letter-spacing:-0.4px;vertical-align:middle;margin-left:8px">hotelgrader</span>`;
}

function shell(t, preheader, inner, footer = "You're getting this because this address was entered on hotelgrader.com. Graded from public data only.") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="${t.scheme}"><meta name="supported-color-schemes" content="${t.scheme}"></head>
<body style="margin:0;padding:0;background:${t.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${t.bg}">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px;">${brand(t)}</td></tr>
<tr><td style="background:${t.panel};border:1px solid ${t.edge};border-radius:${t.radius}px;padding:28px;font-family:${t.font};color:${t.ink};font-size:15px;line-height:1.55;">${inner}</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${t.font};font-size:12px;line-height:1.5;color:${t.faint};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(t, href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${t.btnBg};border-radius:${t.radius}px;"><a href="${e(href)}" style="display:inline-block;padding:13px 22px;font-family:${t.font};font-size:15px;font-weight:600;color:${t.btnFg};text-decoration:none;">${e(label)}</a></td></tr></table>`;
}

/** Greet by the first word of the name people give ("Patrick Ahler" -> "Patrick"). */
const firstWord = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/** The 6-digit code email. */
export function codeEmail({ theme, name: fullName, code, hotel }) {
  const name = firstWord(fullName);
  const t = themeOf(theme);
  const about = hotel ? `the report card for ${hotel}` : 'your report card';
  const html = shell(t, `${code} is your hotelgrader code`, `
<p style="margin:0 0 6px;color:${t.muted};font-size:13px;">${t.scheme === 'dark' ? '<span style="color:' + t.accent + '">$</span> ' : ''}verify</p>
<p style="margin:0 0 18px;">Hi ${e(name)}, here's your code.</p>
<p style="margin:0 0 18px;font-family:${t.num};font-size:38px;font-weight:600;letter-spacing:8px;color:${t.accent};">${code}</p>
<p style="margin:0;color:${t.muted};">Enter it on hotelgrader to see ${e(about)}. It works for 10 minutes.</p>
<p style="margin:16px 0 0;color:${t.faint};font-size:13px;">Didn't ask for this? You can ignore this email.</p>`);
  const text = `Hi ${name},\n\nYour code is ${code}\n\nEnter it on hotelgrader to see ${about}. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`;
  return { subject: `${code} is your hotelgrader code`, html, text };
}

function bar(t, score, letter) {
  const v = Math.max(2, Math.min(100, score ?? 0));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="height:8px;"><tr>
<td width="${v}%" style="background:${tone(t, letter)};height:8px;font-size:0;line-height:0;">&nbsp;</td>
<td style="background:${t.edge};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US'));

/** The report card email: the grade, then the same substance as the page. */
export function reportEmail({ theme, name: fullName, summary: s, link }) {
  const name = firstWord(fullName);
  const t = themeOf(theme);
  const lead = tone(t, s.letter);
  const label = (txt) => `<p style="margin:26px 0 12px;padding-top:20px;border-top:1px solid ${t.edge};font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${t.muted};">${e(txt)}</p>`;
  const th = `font-weight:normal;font-size:12px;color:${t.muted};text-align:left;padding:0 0 6px;`;
  const td = `padding:7px 0;border-top:1px solid ${t.edge};font-size:13.5px;`;

  const cover = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
<td width="${Math.max(2, s.coverage)}%" style="background:${t.accent};height:8px;font-size:0;line-height:0;">&nbsp;</td>
<td style="background:${t.edge};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
<p style="margin:6px 0 0;font-size:12.5px;color:${t.muted};">Based on ${s.coverage}% of the assessment, weighted by importance. The rest couldn't be seen from outside and isn't guessed.</p>`;

  const sections = s.sections.map((x) => `<tr>
<td style="padding:6px 10px 6px 0;font-size:13.5px;color:${t.ink};">${e(x.name)} <span style="color:${t.faint};font-size:12px;">${x.weight} pts, ${x.seen}% seen</span></td>
<td width="42%" style="padding:6px 0;">${bar(t, x.score, x.letter)}</td>
<td align="right" style="padding:6px 0 6px 12px;font-family:${t.num};font-size:13.5px;font-weight:600;color:${tone(t, x.letter)};white-space:nowrap;">${x.score ?? '-'}</td></tr>`).join('');

  const fixes = s.fixes.map((f, i) => `<tr>
<td width="34" valign="top" style="padding:9px 10px 9px 0;font-family:${t.num};font-size:20px;line-height:1.1;color:${t.faint};">${i + 1}</td>
<td valign="top" style="padding:9px 0;"><div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${f.kind === 'Fix' ? t.grade.F : t.grade.C};">${e(f.kind)}</div><div style="font-weight:600;margin-top:2px;">${e(f.name)}</div><div style="color:${t.muted};font-size:13.5px;margin-top:3px;">${e(f.step)}</div><div style="color:${t.faint};font-size:12.5px;margin-top:3px;">Who: ${e(f.owner)}</div></td></tr>`).join('');

  let prices = '';
  if (s.prices) {
    const p = s.prices;
    const line = p.direct == null ? ''
      : p.cheaper > 0
        ? `<p style="margin:0 0 12px;"><span style="font-weight:600;">${p.cheaper} of ${p.total} sites showed a lower rate than your own.</span> <span style="color:${t.muted};">Your site lists the night at ${usd(p.direct)}. The lowest other rate is ${usd(p.lowest.rate)} on ${e(p.lowest.source)}. Rooms and fees aren't matched, so treat this as something to check.</span></p>`
        : `<p style="margin:0 0 12px;"><span style="font-weight:600;">Your own rate was the lowest shown,</span> <span style="color:${t.muted};">at ${usd(p.direct)}.</span></p>`;
    const rows = p.rows.map((r) => `<tr>
<td style="padding:4px 10px 4px 0;font-size:13px;white-space:nowrap;${r.mine ? 'font-weight:600;' : `color:${t.muted};`}">${r.mine ? 'Your site' : e(r.source)}</td>
<td width="48%" style="padding:4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${Math.max(4, Math.round((r.rate / p.max) * 100))}%" style="background:${r.mine ? t.accent : t.faint};height:9px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
<td align="right" style="padding:4px 0 4px 12px;font-family:${t.num};font-size:13px;white-space:nowrap;${r.mine ? 'font-weight:600;' : ''}">${usd(r.rate)}</td></tr>`).join('');
    prices = label('One night across the booking sites') + line + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:10px 0 0;font-size:12px;color:${t.faint};">${p.checkIn ? `Check-in ${e(p.checkIn)}. ` : ''}The lowest rate each site showed on Google's hotel search.${p.second && p.second.night ? ` On a second night, ${e(new Date(`${p.second.night}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))}, ${p.second.direct ? `your site showed ${usd(p.second.direct.rate)}${p.second.cheaper > 0 && p.second.lowest ? ` and the lowest other rate was ${usd(p.second.lowest.rate)}` : ' and no site was lower'}` : 'your site was not listed'}.` : " One date can't show a lasting pattern."}</p>`;
  }

  const adCell = (v) => v == null ? `<span style="color:${t.faint};">couldn't tell</span>` : v ? `<span style="color:${t.accent};">&#9679;</span> seen` : `<span style="color:${t.faint};">none found</span>`;
  const ads = s.ads ? label('Advertising we could see (not graded)') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><th style="${th}">hotel</th><th style="${th}" width="27%">Google ads</th><th style="${th}" width="27%">Meta ads</th></tr>
${s.ads.map((r) => `<tr><td style="${td}${r.you ? 'font-weight:600;' : ''}padding-right:10px;">${e(r.name)}</td><td style="${td}">${adCell(r.google)}</td><td style="${td}">${adCell(r.meta)}</td></tr>`).join('')}
</table>` : '';

  const market = s.market && s.market.rivals.length ? label('The hotels you were compared with') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><th style="${th}">hotel</th><th style="${th}text-align:right;">Google rating</th><th style="${th}text-align:right;">reviews</th></tr>
${[{ ...s.market.own, you: true }, ...s.market.rivals].map((r) => `<tr><td style="${td}${r.you ? 'font-weight:600;' : ''}padding-right:10px;">${e(r.name)}</td><td align="right" style="${td}font-family:${t.num};${r.you ? 'font-weight:600;' : ''}">${r.rating != null ? Number(r.rating).toFixed(1) : '-'}</td><td align="right" style="${td}font-family:${t.num};color:${t.muted};">${num(r.reviews)}</td></tr>`).join('')}
</table>` : '';

  const seen = (ok) => (ok == null ? `color:${t.faint};` : ok ? `color:${t.accent};` : '');
  const searches = s.searches ? label('Where you appear when travellers search (not graded)') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><th style="${th}">search</th><th style="${th}" width="27%">Google hotel search</th><th style="${th}" width="24%">regular results</th></tr>
${s.searches.map((r) => `<tr><td style="${td}padding-right:10px;">${e(r.query)}</td><td style="${td}${seen(r.good.hotel)}">${e(r.hotel)}</td><td style="${td}${seen(r.good.web)}">${e(r.web)}</td></tr>`).join('')}
</table>` : '';

  // --- the newest reviews, and whether each was answered ---
  const starTone = (n) => (n == null ? t.faint : n >= 4 ? t.grade.A : n > 3 ? t.grade.C : t.grade.F);
  let reviews = '';
  if (s.reviews) {
    const r = s.reviews;
    const rate = Math.round((r.replied / r.total) * 100);
    const head = r.replied === 0
      ? `<span style="font-weight:600;"><span style="color:${t.grade.F};">None</span> of your ${r.total} newest Google reviews has a reply.</span>`
      : `<span style="font-weight:600;"><span style="color:${rate >= 80 ? t.grade.A : rate >= 50 ? t.grade.C : t.grade.F};">${r.replied} of ${r.total}</span> newest Google reviews have a reply.</span>`;
    const low = r.low > 0
      ? (r.lowUnanswered > 0
        ? ` <span style="color:${t.muted};">${r.lowUnanswered} of the ${r.low} at three stars or below ${r.lowUnanswered === 1 ? 'sits' : 'sit'} unanswered.</span>`
        : ` <span style="color:${t.muted};">Every one at three stars or below was answered.</span>`)
      : '';
    const cards = r.rows.map((x) => `<tr><td style="padding:0 0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${t.edge};border-radius:${t.radius}px;"><tr><td style="padding:11px 13px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${t.num};font-size:14px;font-weight:600;color:${starTone(x.rating)};">${x.rating != null ? `${x.rating}/5` : ''}</td>
<td align="right" style="font-size:12px;color:${x.replied ? t.grade.A : t.faint};">${x.replied ? 'you replied' : 'no reply'}${x.when ? ` <span style="color:${t.faint};">· ${e(x.when)}</span>` : ''}</td></tr></table>
<div style="margin-top:6px;font-size:13.5px;line-height:1.45;color:${t.muted};">“${e(x.text)}”</div></td></tr></table></td></tr>`).join('');
    reviews = label('Your newest reviews, and whether you answered') + `<p style="margin:0 0 12px;">${head}${low}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>`;
  }

  // --- what guests keep saying ---
  let themes = '';
  if (s.themes) {
    const m = s.themes;
    const col = (title, rows, color) => `<p style="margin:0 0 6px;font-size:12px;color:${t.muted};">${title}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map((x) => `<tr>
<td style="padding:5px 10px 5px 0;font-size:13.5px;">${e(x.theme)}${x.quote ? `<div style="font-size:12.5px;line-height:1.4;color:${t.faint};">“${e(x.quote)}”</div>` : ''}</td>
<td width="34%" valign="top" style="padding:9px 0 5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${Math.max(6, Math.round((x.mentions / m.max) * 100))}%" style="background:${color};height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
<td width="26" align="right" valign="top" style="padding:5px 0 5px 8px;font-family:${t.num};font-size:13px;color:${t.muted};">${x.mentions}</td></tr>`).join('')}</table>`;
    themes = label('What guests keep saying')
      + (m.positive.length ? col('They value', m.positive, t.grade.A) : '')
      + (m.negative.length ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${col('They complain about', m.negative, t.grade.F)}` : '')
      + `<p style="margin:10px 0 0;font-size:12px;color:${t.faint};">Grouped by AI from ${m.reviews ?? 'your'} of your newest Google reviews. The number is how many reviews raised each one.</p>`;
  }

  // --- page speed on a phone ---
  let speed = '';
  if (s.speed) {
    const v = s.speed;
    const labTone = (n) => (n == null ? t.faint : n >= 90 ? t.grade.A : n >= 50 ? t.grade.C : t.grade.F);
    const limit = (n, good, poor) => (n == null ? t.faint : n <= good ? t.grade.A : n <= poor ? t.grade.C : t.grade.F);
    const tile = (name, value, color, note) => `<td width="25%" valign="top" style="padding:0 8px 0 0;"><div style="font-size:11.5px;color:${t.muted};">${name}</div><div style="font-family:${t.num};font-size:24px;line-height:1.25;font-weight:600;color:${color};">${value}</div><div style="font-size:11.5px;color:${t.faint};">${note}</div></td>`;
    const word = { FAST: ['fast', t.grade.A], AVERAGE: ['middling', t.grade.C], SLOW: ['slow', t.grade.F] }[v.field?.overall];
    speed = label('How your home page loads on a phone') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${tile('Phone score', v.mobile ?? '-', labTone(v.mobile), 'out of 100')}
${tile('Desktop score', v.desktop ?? '-', labTone(v.desktop), 'out of 100')}
${tile('Main content', v.lcp != null ? `${(v.lcp / 1000).toFixed(1)}s` : '-', limit(v.lcp, 2500, 4000), 'to appear')}
${tile('Page weight', v.bytes ? `${(v.bytes / 1048576).toFixed(1)}MB` : '-', t.ink, 'to download')}
</tr></table>
<p style="margin:12px 0 0;font-size:13.5px;">${word
    ? `Real visitors: Chrome rates ${v.field.origin ? 'your site as a whole' : 'this page'} as <span style="font-weight:600;color:${word[1]};">${word[0]}</span> over the last 28 days${v.field.lcp != null ? `, with the main content in ${(v.field.lcp / 1000).toFixed(1)}s for three visitors in four` : ''}.`
    : `<span style="color:${t.muted};">Google has too few real visits on record for this site to say how guests experience it.</span>`}</p>
<p style="margin:8px 0 0;font-size:12px;color:${t.faint};">Google's PageSpeed test: one lab visit on a mid-range phone with a slowed connection, so it reads slower than most guests' phones.</p>`;
  }

  // --- where the hotel is listed ---
  let listings = '';
  if (s.listings) {
    const l = s.listings;
    const missing = l.majors.filter((x) => !x.listed);
    const cell = (x) => `<td width="50%" style="padding:0 6px 6px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${t.edge};border-radius:${t.radius}px;"><tr>
<td style="padding:8px 10px;font-size:13px;${x.listed ? '' : `color:${t.muted};`}"><span style="color:${x.listed ? t.grade.A : t.grade.F};">&#9679;</span> ${e(x.name)}</td>
<td align="right" style="padding:8px 10px;font-family:${t.num};font-size:12.5px;color:${t.muted};white-space:nowrap;">${x.listed ? (x.low != null ? `from ${usd(x.low)}` : 'rate shown') : 'no rate shown'}</td></tr></table></td>`;
    const rows = [];
    for (let i = 0; i < l.majors.length; i += 2) rows.push(`<tr>${cell(l.majors[i])}${l.majors[i + 1] ? cell(l.majors[i + 1]) : '<td width="50%"></td>'}</tr>`);
    listings = label('Where guests can find and book you')
      + `<p style="margin:0 0 12px;"><span style="font-weight:600;">${l.total} booking sites showed a rate for you${l.own ? ', alongside your own site.' : `, and <span style="color:${t.grade.F};">your own site wasn't among them</span>.`}</span> <span style="color:${t.muted};">${missing.length ? `No rate showed on ${e(missing.map((x) => x.name).join(', '))}.` : 'Every major one is there.'}${l.resellers ? ` ${l.resellers === 1 ? '1 of them is a smaller reseller' : `${l.resellers} of them are smaller resellers`}.` : ''}</span></p>`
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`
      + (l.ratings.length ? `<p style="margin:8px 0 0;font-size:13px;color:${t.muted};">Ratings on your Google listing: ${l.ratings.map((x) => `${e(x.source)} <span style="font-family:${t.num};color:${t.ink};">${Number(x.rating).toFixed(1)}</span>/${x.max}${x.reviews != null ? ` (${num(x.reviews)})` : ''}`).join(' · ')}</p>` : '')
      + `<p style="margin:8px 0 0;font-size:12px;color:${t.faint};">Sites that showed a rate on Google's hotel search across the ${l.nights === 1 ? 'night' : `${l.nights} nights`} we sampled. A site with no rate shown may list you and be sold out or closed for those dates.</p>`;
  }

  const html = shell(t, s.graded ? `${s.hotel}: ${s.letter}, ${s.score} out of 100` : `${s.hotel}: your hotelgrader report`, `
<p style="margin:0 0 4px;color:${t.accent};font-size:13px;">report card</p>
<h1 style="margin:0;font-family:${t.font};font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.5px;color:${t.ink};">${e(s.hotel)}</h1>
${s.place ? `<p style="margin:2px 0 0;color:${t.muted};">${e(s.place)}</p>` : ''}
${s.graded ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 6px;"><tr>
<td valign="bottom" style="font-family:${t.font};font-size:96px;line-height:0.9;font-weight:700;letter-spacing:-4px;color:${lead};">${e(s.letter.charAt(0))}<span style="font-size:52px;vertical-align:36px;letter-spacing:0;">${e(s.letter.slice(1))}</span></td>
<td valign="bottom" style="padding:0 0 10px 18px;font-family:${t.num};font-size:18px;color:${t.muted};">${s.score} / 100<br><span style="font-family:${t.font};font-size:12px;">execution grade</span></td></tr></table>` : `<p style="margin:18px 0 0;font-weight:600;">Not enough evidence for a grade yet.</p>`}
${cover}
${s.keyFinding ? `<p style="margin:14px 0 0;">${e(s.keyFinding)}</p>` : ''}
${s.rank ? `<p style="margin:10px 0 0;color:${t.muted};"><span style="color:${t.ink};font-weight:600;">#${s.rank.place} of ${s.rank.total}</span> on Google rating in your comp set.</p>` : ''}
<div style="margin-top:24px;">${button(t, link, 'Open the full report')}</div>
${s.fixes.length ? label('What to do first') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fixes}</table>` : ''}
${label('What the grade is made of')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sections}</table>
${reviews}
${themes}
${speed}
${prices}
${listings}
${searches}
${ads}
${market}
<div style="margin-top:28px;padding-top:22px;border-top:1px solid ${t.edge};">${button(t, link, 'Open the full report')}</div>
<p style="margin:14px 0 0;color:${t.faint};font-size:13px;">Hi ${e(name)}, the full report has the evidence behind every check, and a form to correct anything we got wrong. This link opens it without asking for a code again. Questions? Just reply to this email.</p>`);

  const text = [
    `${s.hotel}${s.place ? ` (${s.place})` : ''}`,
    s.graded ? `Execution grade: ${s.letter}, ${s.score} out of 100, based on ${s.coverage}% of the assessment` : 'Not enough evidence for a grade yet.',
    s.keyFinding || '',
    s.rank ? `#${s.rank.place} of ${s.rank.total} on Google rating in your comp set.` : '',
    '',
    s.fixes.length ? 'What to do first:' : '',
    ...s.fixes.map((f, i) => `  ${i + 1}. [${f.kind}] ${f.name}. ${f.step}`),
    '',
    'What the grade is made of:',
    ...s.sections.map((x) => `  ${x.name} (${x.weight} pts): ${x.score}`),
    '',
    ...(s.prices && s.prices.direct != null ? [`One night on your site: ${usd(s.prices.direct)}. ${s.prices.cheaper} of ${s.prices.total} other sites showed a lower rate${s.prices.cheaper && s.prices.lowest ? `, from ${usd(s.prices.lowest.rate)} on ${s.prices.lowest.source}` : ''}. Rooms and fees aren't matched.`, ''] : []),
    ...(s.reviews ? [`Your newest Google reviews: ${s.reviews.replied} of ${s.reviews.total} have a reply.${s.reviews.low ? ` ${s.reviews.lowUnanswered} of the ${s.reviews.low} at three stars or below ${s.reviews.lowUnanswered === 1 ? 'is' : 'are'} unanswered.` : ''}`, ''] : []),
    ...(s.themes ? ['What guests keep saying:', ...(s.themes.positive.length ? [`  They value: ${s.themes.positive.map((x) => `${x.theme} (${x.mentions})`).join(', ')}`] : []), ...(s.themes.negative.length ? [`  They complain about: ${s.themes.negative.map((x) => `${x.theme} (${x.mentions})`).join(', ')}`] : []), ''] : []),
    ...(s.speed ? [`Page speed: ${s.speed.mobile ?? '-'} out of 100 on a phone, ${s.speed.desktop ?? '-'} on a desktop.${s.speed.field ? ` Real visitors: rated ${{ FAST: 'fast', AVERAGE: 'middling', SLOW: 'slow' }[s.speed.field.overall] ?? 'unknown'}.` : ''}`, ''] : []),
    ...(s.listings ? [`Where you're listed: ${s.listings.total} booking sites showed a rate${s.listings.majors.some((x) => !x.listed) ? `. No rate showed on ${s.listings.majors.filter((x) => !x.listed).map((x) => x.name).join(', ')}` : ', every major one among them'}.`, ''] : []),
    ...(s.ads ? ['Advertising we could see (not graded):', ...s.ads.map((r) => `  ${r.name}: Google ${r.google == null ? "couldn't tell" : r.google ? 'seen' : 'none found'}, Meta ${r.meta == null ? "couldn't tell" : r.meta ? 'seen' : 'none found'}`), ''] : []),
    ...(s.searches ? ['Where you appear when travellers search (not graded):', ...s.searches.map((r) => `  ${r.query}: Google hotel search ${r.hotel}, regular results ${r.web}`), ''] : []),
    `Open the full report: ${link}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  return { subject: s.graded ? `${s.hotel}: ${s.letter} (${s.score}/100) on hotelgrader` : `${s.hotel}: your hotelgrader report`, html, text };
}

// ---------- the monthly report card ----------


const monthName = (d) => d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

/** The reviews line, true to what was read: low-star reviews without a reply first, then replies overall. */
function reviewLine(r) {
  const replies = r.replied === 0 ? 'None of them has a reply yet, so guests don’t see you answering.'
    : r.replied === r.total ? 'Every one has a reply.' : `${r.replied} of them ${r.replied === 1 ? 'has' : 'have'} a reply.`;
  if (r.lowUnanswered > 0) return `${r.lowUnanswered} low-star ${r.lowUnanswered === 1 ? 'review has' : 'reviews have'} no reply among your newest ${r.total} on Google. Future guests read these first.`;
  if (r.low === 0) return `${r.total} newest Google reviews read, none below four stars. ${replies}`;
  return `Every low-star review among your newest ${r.total} on Google has a reply. ${replies}`;
}

/** The monthly report card. Light theme only. See docs/monthly-report-card.md. */
export function monthlyEmail({ name: fullName, snap: s, prev, changes, tip, others = [], link, unsubscribe, postal, month = new Date(), test = false, wouldGoTo = '' }) {
  const t = themeOf('light');
  const name = firstWord(fullName);
  const mon = monthName(month);
  const sameReach = prev && prev.coverage != null && s.coverage != null && Math.abs(prev.coverage - s.coverage) <= 3;
  const delta = prev && prev.version === s.version && sameReach ? s.score - prev.score : null;
  const sinceTxt = changes.since === 'last month' ? 'last month' : 'you first looked';
  const dTxt = delta == null ? '' : delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta} since ${sinceTxt}`;
  const rankMove = prev?.rank && s.rank && prev.rank.basis === s.rank.basis && prev.rank.total === s.rank.total && prev.rank.place !== s.rank.place ? prev.rank.place - s.rank.place : 0;
  // Rate fixes are left out for now: the report's rate check still compares against every site on Google,
  // resellers included, which is rate leakage, not parity. Use them again once that check follows the parity
  // rule (same room type and rate plan against Booking.com, Expedia and Priceline).
  const fix = s.fixes.find((f) => f.fn !== 'rates') ?? null;
  const unanswered = s.recent?.lowUnanswered ?? null;
  const toneOf = (x) => (x === 'good' ? t.grade.A : x === 'bad' ? t.grade.F : t.muted);
  const h = (label) => `<p style="margin:26px 0 8px;padding-top:20px;border-top:1px solid ${t.edge};font-size:13px;font-weight:600;color:${t.muted};">${e(label)}</p>`;

  const changed = changes.first
    ? `<p style="margin:0;color:${t.muted};">This is your first monthly report card. From next month, this section recaps what moved since this scan.</p>`
    : changes.items.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${changes.items.map((x) => `<tr><td width="14" valign="top" style="padding:5px 8px 5px 0;color:${toneOf(x.tone)};font-size:14px;">●</td><td style="padding:5px 0;font-size:14.5px;">${e(x.text)}</td></tr>`).join('')}</table>`
      : `<p style="margin:0;color:${t.muted};">Nothing moved since ${e(changes.since)}. Your competitors may not be standing still, so the fix below is still worth doing.</p>`;

  const testBanner = test ? `<p style="margin:0 0 18px;padding:10px 12px;background:#FFF6DB;border:1px solid #F2C14E;border-radius:8px;font-size:13px;color:#5C4500;">TEST SEND. Only you received this${wouldGoTo ? `. In live mode it would go to ${e(wouldGoTo)}` : ''}.</p>` : '';

  const inner = `${testBanner}
<p style="margin:0 0 4px;color:${t.accent};font-size:13px;">${e(mon)} report card</p>
<h1 style="margin:0;font-family:${t.font};font-size:24px;line-height:1.2;font-weight:600;color:${t.ink};">${e(s.hotel)}</h1>
<p style="margin:2px 0 0;color:${t.muted};">${e([s.city, s.state].filter(Boolean).join(', '))}</p>
<p style="margin:18px 0 0;">Hi ${e(name)}, here's what changed at ${e(s.hotel)} this month, and the one thing worth doing next.</p>
${h('What’s changed')}${changed}
${h('Your grade')}
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="bottom" style="font-family:${t.num};font-size:64px;line-height:0.9;font-weight:700;color:${tone(t, s.letter)};">${e(s.letter)}</td>
<td valign="bottom" style="padding:0 0 6px 14px;font-family:${t.num};font-size:17px;color:${t.muted};">${s.score} / 100${dTxt ? `<br><span style="font-size:13px;color:${delta > 0 ? t.grade.A : delta < 0 ? t.grade.F : t.muted};">${e(dTxt)}</span>` : ''}</td></tr></table>
${s.rank ? `${h('Your comp set')}<p style="margin:0;"><span style="font-family:${t.num};font-size:22px;font-weight:600;">#${s.rank.place}</span> <span style="color:${t.muted};">of ${s.rank.total} on Google rating${s.hotelClass ? ` among ${s.hotelClass}-star hotels near you priced like you` : ' among the hotels near you'}${rankMove ? `. <span style="color:${rankMove > 0 ? t.grade.A : t.grade.F};">${rankMove > 0 ? `Up ${rankMove}` : `Down ${-rankMove}`} since ${sinceTxt}.</span>` : '.'}</span></p>` : ''}
${unanswered != null ? `${h('Reviews waiting on you')}<p style="margin:0;">${e(reviewLine(s.recent)).replace(/^(\d+)/, `<span style="font-family:${t.num};font-size:22px;font-weight:600;color:${unanswered ? t.grade.F : t.ink};">$1</span>`)}</p>` : ''}
${fix ? `${h('One fix for this month')}<p style="margin:0;font-weight:600;">${e(fix.title)}</p><p style="margin:4px 0 0;color:${t.muted};">${e(fix.evidence)}</p>${fix.outcome ? `<p style="margin:8px 0 0;"><span style="color:${t.muted};">Done looks like:</span> ${e(fix.outcome)}</p>` : ''}${fix.owner ? `<p style="margin:6px 0 0;font-size:13px;color:${t.faint};">Usually done by: ${e(fix.owner)}</p>` : ''}` : ''}
${tip ? `${h('Marketing tip of the month')}<p style="margin:0;font-weight:600;">${e(tip.title)}</p><p style="margin:4px 0 0;color:${t.muted};">${e(tip.body)}</p>` : ''}
<div style="margin-top:26px;">${button(t, link, 'Open your full report')}</div>
${others.length ? `<p style="margin:14px 0 0;font-size:13px;color:${t.faint};">You also follow ${e(others.join(', '))}. Open each from your report.</p>` : ''}`;

  const footer = `You're getting this monthly report card because you unlocked a hotelgrader report for ${e(s.hotel)}. Graded from public data only.<br><a href="${e(unsubscribe)}" style="color:${t.faint};">Unsubscribe in one click</a>${postal ? `<br>${e(postal)}` : ''}`;
  const html = shell(t, `${s.hotel}: ${s.letter}${dTxt ? ` (${dTxt})` : ''}. What changed in ${mon}.`, inner, footer);

  const text = [
    test ? `TEST SEND. Only you received this${wouldGoTo ? `. In live mode it would go to ${wouldGoTo}` : ''}.\n` : null,
    `${mon} report card: ${s.hotel}${s.city ? `, ${s.city}` : ''}`,
    '',
    `Hi ${name}, here's what changed at ${s.hotel} this month, and the one thing worth doing next.`,
    '',
    'What’s changed:',
    ...(changes.first ? ['This is your first monthly report card. From next month, this section recaps what moved since this scan.']
      : changes.items.length ? changes.items.map((x) => `- ${x.text}`) : [`Nothing moved since ${changes.since}.`]),
    '',
    '',
    `Your grade: ${s.letter} (${s.score}/100)${dTxt ? `, ${dTxt}` : ''}`,
    s.rank ? `Your comp set: #${s.rank.place} of ${s.rank.total} on Google rating` : null,
    unanswered != null ? `Reviews waiting on you: ${reviewLine(s.recent)}` : null,
    fix ? `\nOne fix for this month: ${fix.title}\n${fix.evidence}${fix.outcome ? `\nDone looks like: ${fix.outcome}` : ''}` : null,
    tip ? `\nMarketing tip of the month: ${tip.title}\n${tip.body}` : null,
    '',
    `Open your full report: ${link}`,
    '',
    `Unsubscribe in one click: ${unsubscribe}`,
    postal || null,
  ].filter((l) => l != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const subject = `${test ? '[TEST] ' : ''}${s.hotel}: ${s.letter} in ${mon}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`;
  return { subject, html, text };
}

/**
 * The template version: a fingerprint of the monthly template code and every tip. Any change to either gives
 * a new version, which voids the template and sample approvals in /admin and drops the program back to test.
 */
export const TEMPLATE_VERSION = `monthly-${createHash('sha256')
  .update([monthlyEmail, reviewLine, shell, button, tipFor].map((f) => f.toString()).join('\n') + JSON.stringify(TIPS))
  .digest('hex').slice(0, 10)}`;
