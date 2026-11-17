import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CompanySnapshot } from '../authority/contracts';
import App from '../App';
import { CompanyClient } from './CompanyClient';
import { supabase } from './supabase';
import './connection.css';

export default function ConnectedApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setChecking(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setChecking(false); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  if (!supabase) return <div className="connection-screen">Supabase URL and publishable key are required in the client configuration.</div>;
  if (checking) return <div className="connection-screen">Checking your session…</div>;
  if (!session) return <SignIn />;
  return <CompanyWorkspace key={session.user.id} session={session} />;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(signUp: boolean) {
    setBusy(true); setMessage('');
    try {
      const { data, error } = signUp ? await supabase!.auth.signUp({ email, password }) : await supabase!.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else if (signUp && !data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch { setMessage('The authentication service is unavailable.'); }
    finally { setBusy(false); }
  }
  return <main className="connection-screen"><form className="connection-card" onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
    <span className="eyebrow">WINEMAKER</span><h1>Your winery awaits</h1><p>Sign in to load your companies.</p>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
    {message && <p role="status">{message}</p>}
    <button className="primary-button" disabled={busy}>Sign in</button>{' '}
    <button className="secondary-button" type="submit" disabled={busy} onClick={(e) => { e.preventDefault(); if (email && password) void submit(true); }}>Create account</button>
  </form></main>;
}

function CompanyWorkspace({ session }: { session: Session }) {
  const client = useMemo(() => new CompanyClient(async () => {
    const { data, error } = await supabase!.auth.getSession();
    if (error || !data.session || data.session.user.id !== session.user.id) throw new Error('Sign in again to continue.');
    return data.session.access_token;
  }, session.user.id), [session.user.id]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const creationKey = `winemaker05.creation.${session.user.id}`;
  async function list() { setCompanies(await client.list()); }
  useEffect(() => { let active = true; void client.list().then(ids => { if (active) setCompanies(ids); }).catch(() => { if (active) setMessage('Could not reach the company service. Check that the authority is running.'); }); return () => { active = false; }; }, [client]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'The service is unavailable.'); }
    finally { setBusy(false); }
  }
  async function open(id: string) {
    const loaded = await client.load(id);
    setSnapshot(loaded.snapshot); setPendingId(loaded.pendingId);
  }
  async function create() {
    const id = localStorage.getItem(creationKey) ?? crypto.randomUUID();
    localStorage.setItem(creationKey, id);
    await client.create(id);
    localStorage.removeItem(creationKey);
    await list(); await open(id);
  }
  const unresolved = snapshot ? Boolean(pendingId || client.hasPending(snapshot.companyId)) : false;
  return <>
    <div className="account-bar"><span>{session.user.email}</span><button type="button" onClick={() => { setSnapshot(null); void supabase!.auth.signOut(); }}>Sign out</button></div>
    {!snapshot ? <main className="connection-screen"><div className="connection-card"><span className="eyebrow">YOUR WINERY</span><h1>Your companies</h1>
      {companies.length === 0 && <p>No companies found.</p>}
      {companies.map(id => <button className="company-choice" key={id} disabled={busy} onClick={() => void run(() => open(id))}>Open company {id.slice(0, 8)}</button>)}
      <button className="primary-button" disabled={busy} onClick={() => void run(create)}>{localStorage.getItem(creationKey) ? 'Retry creating company' : 'Create company'}</button>{' '}
      <button className="secondary-button" disabled={busy} onClick={() => void run(list)}>Refresh</button>
      {message && <p role="alert">{message}</p>}
    </div></main> : <>
      <App calendar={snapshot.state.calendar} busy={busy} canAdvance={!unresolved} onAdvance={() => void run(async () => { await client.advance(snapshot); await open(snapshot.companyId); })} />
      <div className="connection-status"><button type="button" disabled={busy} onClick={() => { setSnapshot(null); setPendingId(undefined); void run(list); }}>Companies</button>
        {unresolved && <button type="button" disabled={busy} onClick={() => void run(async () => { await client.recover(snapshot.companyId, pendingId); await open(snapshot.companyId); })}>Resolve pending command</button>}
        {message && <span role="alert">{message}</span>}
      </div>
    </>}
  </>;
}
