// Email templates. Two looks that mirror the site's two themes: the dark
// terminal style and the light style. The browser tells us which theme the
// visitor is in, and the email follows it. Table-based markup with inline
// styles, because that is what email clients render reliably.

import { escapeHtml as e } from './verify.mjs';

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

function shell(t, preheader, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="${t.scheme}"><meta name="supported-color-schemes" content="${t.scheme}"></head>
<body style="margin:0;padding:0;background:${t.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${t.bg}">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px;">${brand(t)}</td></tr>
<tr><td style="background:${t.panel};border:1px solid ${t.edge};border-radius:${t.radius}px;padding:28px;font-family:${t.font};color:${t.ink};font-size:15px;line-height:1.55;">${inner}</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${t.font};font-size:12px;line-height:1.5;color:${t.faint};">You're getting this because this address was entered on hotelgrader.com. Graded from public data only.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(t, href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${t.btnBg};border-radius:${t.radius}px;"><a href="${e(href)}" style="display:inline-block;padding:13px 22px;font-family:${t.font};font-size:15px;font-weight:600;color:${t.btnFg};text-decoration:none;">${e(label)}</a></td></tr></table>`;
}

/** The 6-digit code email. */
export function codeEmail({ theme, name, code, hotel }) {
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
export function reportEmail({ theme, name, summary: s, link }) {
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
${prices}
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
    ...(s.ads ? ['Advertising we could see (not graded):', ...s.ads.map((r) => `  ${r.name}: Google ${r.google == null ? "couldn't tell" : r.google ? 'seen' : 'none found'}, Meta ${r.meta == null ? "couldn't tell" : r.meta ? 'seen' : 'none found'}`), ''] : []),
    `Open the full report: ${link}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  return { subject: s.graded ? `${s.hotel}: ${s.letter} (${s.score}/100) on hotelgrader` : `${s.hotel}: your hotelgrader report`, html, text };
}
