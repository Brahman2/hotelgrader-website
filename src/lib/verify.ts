// Browser side of the email check. The code is emailed and checked by the two
// Netlify functions in netlify/functions. Once verified, the visitor is
// remembered in this browser and isn't asked again.

export interface User { name: string; email: string; proof: string }

const KEY = 'hg-user';
/** send-code answers 503 when the site has no email keys yet. */
export const UNCONFIGURED = 'unconfigured';

const WRONG = 'That code isn’t right. Check the email and try again.';

export function loadUser(): User | null {
  try {
    const u = JSON.parse(localStorage.getItem(KEY) || 'null');
    return u && u.email && u.proof ? (u as User) : null;
  } catch { return null; }
}

export function saveUser(u: User) {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* storage blocked; they'll be asked again next visit */ }
}

async function post(path: string, body: unknown): Promise<Record<string, string>> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Couldn’t reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) return { token: UNCONFIGURED };
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

/** Which theme the visitor is in, so emails can match it. */
const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** Emails a 6-digit code. Returns the token to pass back with the code. */
export async function sendCode(input: { name: string; email: string; hotel: string }): Promise<string> {
  if (import.meta.env.DEV) {
    // `astro dev` has no functions and sends no email. The code is always 123456.
    console.info('[dev] no email sent. The verification code is 123456.');
    return 'dev';
  }
  return (await post('/api/send-code', { ...input, theme: theme() })).token;
}

/** Checks the code. Returns the proof to store with the user. */
export async function checkCode(input: {
  name: string; email: string; code: string; token: string; hotel: string; city: string; state: string;
}): Promise<string> {
  if (import.meta.env.DEV) {
    if (input.code !== '123456') throw new Error(WRONG);
    return 'dev';
  }
  return (await post('/api/verify-code', input)).proof;
}

/** Emails the finished report card to a verified visitor. Never throws. */
export async function sendReport(user: User, t: { hotel: string; city: string; state: string }): Promise<boolean> {
  if (import.meta.env.DEV) {
    console.info('[dev] no report email sent.');
    return false;
  }
  try {
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, ...t, theme: theme() }),
    });
    return res.ok;
  } catch { return false; }
}

/** True when the page was opened from a genuine emailed report link. */
export async function checkLink(t: { hotel: string; city: string; state: string }, k: string): Promise<boolean> {
  if (import.meta.env.DEV) return false;
  try {
    const res = await fetch('/api/check-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, k }),
    });
    return res.ok && (await res.json()).ok === true;
  } catch { return false; }
}

/** The signed link that opens this hotel's report for anyone, or '' if it can't be made. */
export async function shareLink(user: User, t: { hotel: string; city: string; state: string }): Promise<string> {
  if (import.meta.env.DEV) return '';
  try {
    const res = await fetch('/api/share-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, proof: user.proof, ...t }),
    });
    return res.ok ? ((await res.json()).link as string) || '' : '';
  } catch { return ''; }
}

/** Send a factual correction about a report to the team. False when it couldn't be sent. */
export async function sendCorrection(t: { hotel: string; city: string; state: string }, message: string): Promise<boolean> {
  if (import.meta.env.DEV) return true;
  try {
    const user = loadUser();
    const res = await fetch('/api/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, message, name: user?.name ?? '', email: user?.email ?? '' }),
    });
    return res.ok;
  } catch { return false; }
}
