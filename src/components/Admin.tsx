import { useEffect, useState, type FormEvent } from 'react';

// The monthly report card admin. See docs/monthly-report-card.md.
// Sign in with a code emailed to an ADMIN_EMAILS address; the session lasts 12 hours in this tab.

type Status = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const KEY = 'hg-admin-session';

async function call(action: string, body: Record<string, unknown> = {}) {
  let session = '';
  try { session = sessionStorage.getItem(KEY) || ''; } catch { /* private mode */ }
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': session },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const usd = (n: number | null | undefined) => (n == null ? '–' : `$${Number(n).toFixed(2)}`);
const day = (s?: string | null) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–');

function SignIn({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault(); setMsg('');
    try { const r = await call('send-code', { email }); setToken(r.token || 'none'); setMsg('If that address is an admin, a code is on its way.'); } catch (err) { setMsg((err as Error).message); }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault(); setMsg('');
    try { const r = await call('verify', { email, token, code }); sessionStorage.setItem(KEY, r.session); onIn(); } catch (err) { setMsg((err as Error).message); }
  };
  return (
    <div className="panel p-6 max-w-[420px]">
      <h1 className="headline text-[22px]">Admin sign-in</h1>
      {!token ? (
        <form onSubmit={send} className="flex flex-col gap-2 mt-4">
          <label className="text-[13px] font-medium" htmlFor="admin-email">Email</label>
          <input id="admin-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button className="btn btn--primary justify-center mt-2" type="submit">email me a code</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-2 mt-4">
          <label className="text-[13px] font-medium" htmlFor="admin-code">Code</label>
          <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" className="input num" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn btn--primary justify-center mt-2" type="submit">sign in</button>
        </form>
      )}
      {msg && <p className="text-ink-60 text-[13px] mt-3">{msg}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1.5 border-b border-edge text-[14px]"><span className="text-ink-60">{label}</span><span className="text-right">{children}</span></div>;
}

export default function Admin() {
  const [signedIn, setSignedIn] = useState(false);
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [cap, setCap] = useState('');
  const [cps, setCps] = useState('');
  const [hotel, setHotel] = useState({ hotel: '', city: '', state: '', name: '' });
  const [preview, setPreview] = useState('');

  const load = async () => {
    try { const r = await call('status'); setS(r); setCap(String(r.settings.capUsd)); setCps(String(r.settings.costPerSearch)); setSignedIn(true); }
    catch { setSignedIn(false); }
  };
  useEffect(() => { void load(); }, []);

  const act = async (action: string, body: Record<string, unknown> = {}, done = '') => {
    setBusy(action); setMsg('');
    try { const r = await call(action, body); if (action === 'preview') setPreview(r.html); setMsg(done || (r.subject ? `Done: ${r.subject}` : 'Done.')); await load(); }
    catch (err) { setMsg((err as Error).message); }
    finally { setBusy(''); }
  };

  if (!signedIn) return <SignIn onIn={load} />;
  if (!s) return <p>Loading…</p>;
  const st = s.settings;
  const rs = s.runs.rescan;
  const live = st.mode === 'live';

  return (
    <div className="grid gap-6 max-w-[980px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="headline text-[26px]">Monthly report card</h1>
        <span className="meta">signed in as {s.you}</span>
      </div>
      {msg && <p className="panel p-4 text-[14px]">{msg}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="panel p-5">
          <h2 className="headline text-[17px] mb-2">Status</h2>
          <Row label="Program">{st.enabled ? 'On' : 'Off'}</Row>
          <Row label="Mode"><span className={live ? 'text-attention font-semibold' : ''}>{live ? 'LIVE: emails real contacts' : 'Test: emails only the test address'}</span></Row>
          <Row label="Template">{st.templateApprovedVersion === s.templateVersion ? `approved ${day(st.templateApprovedAt)}` : `not approved (${s.templateVersion})`}</Row>
          <Row label="Sample">{st.sampleApprovedAt ? `approved ${day(st.sampleApprovedAt)}` : st.sampleSentAt ? `sent ${day(st.sampleSentAt)}, not approved` : 'not sent'}</Row>
          <Row label="Test address set">{s.env.testTo ? 'yes' : 'no: set MONTHLY_TEST_TO'}</Row>
          <Row label="Postal address set">{s.env.postal ? 'yes' : 'no: set MAIL_POSTAL_ADDRESS'}</Row>
          {!s.readiness.ready && <p className="text-[13px] text-ink-60 mt-3">Before live: {s.readiness.missing.join('; ')}.</p>}
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn" disabled={!!busy} onClick={() => act('enable', { on: !st.enabled })}>{st.enabled ? 'turn program off' : 'turn program on'}</button>
            {live
              ? <button className="btn" disabled={!!busy} onClick={() => act('mode', { mode: 'test' })}>back to test mode</button>
              : <button className="btn btn--primary" disabled={!!busy || !s.readiness.ready} onClick={() => { if (confirm('Switch to LIVE? From the next 1st, the email goes to every eligible contact.')) void act('mode', { mode: 'live' }); }}>switch to live</button>}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="headline text-[17px] mb-2">Re-scan cost</h2>
          <Row label="Hotels to re-scan">{s.estimate.hotels}</Row>
          <Row label="Worst case a month">{s.estimate.maxSearches} searches, {usd(s.estimate.maxUsd)}</Row>
          <Row label="This month">{rs ? `${rs.done} of ${rs.total ?? '?'} hotels, ${rs.searches} searches, ${usd(rs.usd)}${rs.stoppedForCap ? ' (stopped at cap)' : ''}${rs.paused ? ' (paused, will resume)' : ''}` : 'not run yet'}</Row>
          <Row label="Last month">{s.runs.rescanLastMonth ? `${s.runs.rescanLastMonth.done} hotels, ${s.runs.rescanLastMonth.searches} searches, ${usd(s.runs.rescanLastMonth.usd)}` : '–'}</Row>
          <form className="grid grid-cols-2 gap-2 mt-4 items-end" onSubmit={(e) => { e.preventDefault(); void act('settings', { capUsd: Number(cap), costPerSearch: Number(cps) }, 'Saved.'); }}>
            <label className="text-[13px]">Spend cap a month ($)<input className="input w-full mt-1" value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" /></label>
            <label className="text-[13px]">Cost per search ($)<input className="input w-full mt-1" value={cps} onChange={(e) => setCps(e.target.value)} inputMode="decimal" /></label>
            <button className="btn col-span-2 justify-center" type="submit" disabled={!!busy}>save</button>
          </form>
          <button className="btn mt-2" disabled={!!busy} onClick={() => { if (confirm(`Re-scan every unlocked hotel now, up to the ${usd(st.capUsd)} cap?`)) void act('rescan-now', {}, 'Re-scan started. Refresh in a few minutes.'); }}>re-scan now</button>
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="headline text-[17px] mb-2">Contacts</h2>
        <Row label="Total">{s.contacts.total}</Row>
        <Row label="Would get the email">{s.contacts.eligible}</Row>
        {Object.entries(s.contacts.byReason).map(([k, v]) => <Row key={k} label={k}>{String(v)}</Row>)}
        <p className="text-[13px] text-ink-60 mt-3">EU/EEA, UK, Swiss and Canadian contacts, and anyone whose country we couldn’t tell, only count once they opt in.</p>
      </section>

      <section className="panel p-5">
        <h2 className="headline text-[17px] mb-2">Template and sample</h2>
        <p className="text-[13px] text-ink-60">Pick a hotel that has a report on the site. The preview and sample use its latest cached scan and never spend a search. The sample goes only to the test address.</p>
        <div className="grid sm:grid-cols-4 gap-2 mt-3">
          <input className="input" placeholder="Hotel" value={hotel.hotel} onChange={(e) => setHotel({ ...hotel, hotel: e.target.value })} />
          <input className="input" placeholder="City" value={hotel.city} onChange={(e) => setHotel({ ...hotel, city: e.target.value })} />
          <input className="input" placeholder="State" value={hotel.state} onChange={(e) => setHotel({ ...hotel, state: e.target.value })} />
          <input className="input" placeholder="Greet as (name)" value={hotel.name} onChange={(e) => setHotel({ ...hotel, name: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn" disabled={!!busy} onClick={() => act('preview', hotel)}>preview</button>
          <button className="btn" disabled={!!busy} onClick={() => act('sample', hotel)}>send sample to test address</button>
          <button className="btn" disabled={!!busy} onClick={() => act('approve-template', {}, 'Template approved.')}>approve template</button>
          <button className="btn" disabled={!!busy} onClick={() => act('approve-sample', {}, 'Sample approved.')}>approve sample</button>
          <button className="btn" disabled={!!busy || !st.enabled} title={st.enabled ? '' : 'Turn the program on first'} onClick={() => act('send-test-now', {}, 'Test send started: up to 3 emails, all to the test address.')}>test send to me</button>
        </div>
        {preview && <iframe title="Email preview" srcDoc={preview} className="w-full mt-4 border border-edge rounded" style={{ height: 1100, background: '#F5F5F7' }} />}
      </section>
    </div>
  );
}
