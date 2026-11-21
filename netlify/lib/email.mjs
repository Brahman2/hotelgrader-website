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

/** The report card email: grade, sections as bars, top fixes, link back. */
export function reportEmail({ theme, name, summary: s, link }) {
  const t = themeOf(theme);
  const lead = tone(t, s.letter);
  const label = (txt) => `<p style="margin:26px 0 10px;padding-top:20px;border-top:1px solid ${t.edge};font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${t.muted};">${e(txt)}</p>`;

  const sections = s.sections.map((x) => `<tr>
<td style="padding:6px 10px 6px 0;font-size:13.5px;color:${t.ink};white-space:nowrap;">${e(x.name)}</td>
<td width="42%" style="padding:6px 0;">${bar(t, x.score, x.letter)}</td>
<td align="right" style="padding:6px 0 6px 12px;font-family:${t.num};font-size:13.5px;font-weight:600;color:${tone(t, x.letter)};white-space:nowrap;">${x.score ?? '-'}</td></tr>`).join('');

  const fixes = s.fixes.map((f) => `<tr>
<td width="46" valign="top" style="padding:8px 12px 8px 0;"><div style="width:44px;height:44px;line-height:44px;text-align:center;border:2px solid ${tone(t, f.letter)};border-radius:50%;font-family:${t.num};font-size:15px;font-weight:600;color:${t.ink};">${f.score}</div></td>
<td valign="top" style="padding:8px 0;"><div style="font-weight:600;">${e(f.name)}</div>${f.step ? `<div style="color:${t.muted};font-size:13.5px;margin-top:2px;">${e(f.step)}</div>` : ''}</td></tr>`).join('');

  const html = shell(t, `${s.hotel}: ${s.letter}, ${s.score} out of 100`, `
<p style="margin:0 0 4px;color:${t.accent};font-size:13px;">report card</p>
<h1 style="margin:0;font-family:${t.font};font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.5px;color:${t.ink};">${e(s.hotel)}</h1>
${s.place ? `<p style="margin:2px 0 0;color:${t.muted};">${e(s.place)}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 6px;"><tr>
<td valign="bottom" style="font-family:${t.font};font-size:96px;line-height:0.9;font-weight:700;letter-spacing:-4px;color:${lead};">${e(s.letter.charAt(0))}<span style="font-size:52px;vertical-align:36px;letter-spacing:0;">${e(s.letter.slice(1))}</span></td>
<td valign="bottom" style="padding:0 0 10px 18px;font-family:${t.num};font-size:18px;color:${t.muted};">${s.score} / 100</td></tr></table>
${s.keyFinding ? `<p style="margin:14px 0 0;">${e(s.keyFinding)}</p>` : ''}
${s.rank ? `<p style="margin:10px 0 0;color:${t.muted};"><span style="color:${t.ink};font-weight:600;">#${s.rank.place} of ${s.rank.total}</span> on guest rating among nearby hotels.</p>` : ''}
${label('The seven sections')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sections}</table>
${s.fixes.length ? label('Fix these first') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fixes}</table>` : ''}
<div style="margin-top:26px;">${button(t, link, 'Open the full report')}</div>
<p style="margin:14px 0 0;color:${t.faint};font-size:13px;">Hi ${e(name)}, this link opens your report card without asking for a code again.</p>`);

  const text = [
    `${s.hotel}${s.place ? ` (${s.place})` : ''}`,
    `Grade: ${s.letter}, ${s.score} out of 100`,
    s.keyFinding || '',
    s.rank ? `#${s.rank.place} of ${s.rank.total} on guest rating among nearby hotels.` : '',
    '',
    'The seven sections:',
    ...s.sections.map((x) => `  ${x.name}: ${x.score ?? 'not scored'}`),
    '',
    s.fixes.length ? 'Fix these first:' : '',
    ...s.fixes.map((f) => `  ${f.name} (${f.score})${f.step ? `: ${f.step}` : ''}`),
    '',
    `Open the full report: ${link}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  return { subject: `${s.hotel}: ${s.letter} (${s.score}/100) on hotelgrader`, html, text };
}
