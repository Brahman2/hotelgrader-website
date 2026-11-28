import { useEffect, useRef, useState, type FormEvent } from 'react';
import { UNCONFIGURED, checkCode, sendCode, type User } from '../lib/verify';
import { track } from '../lib/track';

// The gate in front of the grade: name and email, then a 6-digit code
// we email to that address. It sits beside the live scan, so the visitor can
// verify while the scan runs.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Gate({ target, ready, onUnlock }: {
  target: { hotel: string; city: string; state: string };
  ready: boolean;
  onUnlock: (user: User) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  // The monthly report card box. Ticked by default, except where the law asks for an explicit opt-in.
  const [monthly, setMonthly] = useState(true);
  useEffect(() => {
    fetch('/api/geo').then((r) => (r.ok ? r.json() : null)).then((g) => { if (g?.optInRequired) setMonthly(false); }).catch(() => { /* keep the default */ });
  }, []);
  const codeRef = useRef<HTMLInputElement>(null);

  // Put the cursor in the code box as soon as it appears.
  useEffect(() => { if (token) codeRef.current?.focus(); }, [token]);

  const request = async () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n) return setError('Enter your name.');
    if (!EMAIL_RE.test(e)) return setError('That doesn’t look like an email address.');
    setBusy(true); setError('');
    try {
      const t = await sendCode({ name: n, email: e, hotel: target.hotel });
      // Until the email keys are set in Netlify, don't strand the visitor:
      // take the name and email as given and show the grade.
      if (t === UNCONFIGURED) return onUnlock({ name: n, email: e, proof: 'unverified' });
      setToken(t);
      setCode('');
      track('code_requested', { hotel: target.hotel });
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  const submitDetails = (ev: FormEvent) => { ev.preventDefault(); void request(); };

  const submitCode = async (ev: FormEvent) => {
    ev.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit code from the email.');
    const n = name.trim();
    const e = email.trim().toLowerCase();
    setBusy(true); setError('');
    try {
      const proof = await checkCode({ name: n, email: e, code, token, monthly, ...target });
      onUnlock({ name: n, email: e, proof });
    } catch (err) {
      setError((err as Error).message);
      codeRef.current?.select(); // so retyping replaces the wrong code
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-7 pt-6 border-t border-edge">
      {!token ? (
        <form onSubmit={submitDetails} noValidate>
          <h2 className="headline text-[18px]">{ready ? 'Your grade is ready.' : 'Where should we send your code?'}</h2>
          <p className="text-ink-60 text-[13px] mt-1">We’ll email a 6-digit code to confirm it’s you, then show the grade and send you a copy.</p>
          <div className="flex flex-col gap-2 mt-4">
            <label htmlFor="gate-name" className="text-[13px] font-medium">Name</label>
            <input id="gate-name" name="name" type="text" autoComplete="name" autoFocus
              value={name} onChange={(e) => { setName(e.target.value); setError(''); }} className="input w-full" />
            <label htmlFor="gate-email" className="text-[13px] font-medium mt-2">Email</label>
            <input id="gate-email" name="email" type="email" inputMode="email" autoComplete="email"
              value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="input w-full" />
            <label className="flex items-start gap-2 mt-2 text-[13px] text-ink-60 cursor-pointer">
              <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="mt-[3px]" />
              <span>Email me an updated report card each month. Unsubscribe anytime.</span>
            </label>
            {error && <p className="text-attention text-[13px]" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn--primary justify-center mt-2">
              {busy ? 'sending' : 'email me a code'}
            </button>
          </div>
          <p className="meta mt-3">We may follow up about your grade. We never sell your details. <a href="/privacy">privacy</a></p>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h2 className="headline text-[18px]">Check your email.</h2>
          <p className="text-ink-60 text-[13px] mt-1">We sent a 6-digit code to <span className="text-ink">{email.trim().toLowerCase()}</span>. It works for 10 minutes.</p>
          <div className="flex flex-col gap-2 mt-4">
            <label htmlFor="gate-code" className="text-[13px] font-medium">Code</label>
            <input ref={codeRef} id="gate-code" name="one-time-code" type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              className="input w-full num text-[20px] tracking-[0.3em]" />
            {error && <p className="text-attention text-[13px]" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn--primary justify-center mt-2">
              {busy ? 'checking' : ready ? 'show my grade' : 'confirm'}
            </button>
          </div>
          <p className="meta mt-3">
            <button type="button" className="link" disabled={busy}
              onClick={async () => { await request(); setResent(true); }}>
              {resent ? 'Sent again' : 'Send a new code'}
            </button>
            {' or '}
            <button type="button" className="link" onClick={() => { setToken(''); setError(''); setResent(false); }}>
              use a different email
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
