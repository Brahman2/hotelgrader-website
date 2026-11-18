// Browser side of the email check. The code is emailed and checked by the two
// Netlify functions in netlify/functions. Once verified, the visitor is
// remembered in this browser and isn't asked again.

export interface User { name: string; email: string; proof: string }

const KEY = 'hg-user';
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
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

/** Emails a 6-digit code. Returns the token to pass back with the code. */
export async function sendCode(input: { name: string; email: string; hotel: string }): Promise<string> {
  if (import.meta.env.DEV) {
    // `astro dev` has no functions and sends no email. The code is always 123456.
    console.info('[dev] no email sent. The verification code is 123456.');
    return 'dev';
  }
  return (await post('/api/send-code', input)).token;
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
