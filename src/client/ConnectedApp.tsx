import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const creationKey = `winemaker05.creation.${session.user.id}`;
  const companyId = snapshot?.companyId;
  const subscribePending = useCallback((notify: () => void) => {
    if (!companyId) return () => {};
    return client.subscribePending(companyId, (cleared) => {
      if (cleared) setNeedsRefresh(true);
      notify();
    });
  }, [client, companyId]);
  const getPending = useCallback(() => companyId ? client.hasPending(companyId) : false, [client, companyId]);
  const localPending = useSyncExternalStore(subscribePending, getPending, () => false);
  async function list() { setCompanies(await client.list()); }
  useEffect(() => { let active = true; void client.list().then(ids => { if (active) setCompanies(ids); }).catch(() => { if (active) setMessage('Could not reach the company service. Check that the authority is running.'); }); return () => { active = false; }; }, [client]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'The service is unavailable.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function open(id: string) {
    const loaded = await client.load(id);
    setSnapshot(loaded.snapshot); setPendingId(loaded.pendingId); setNeedsRefresh(false);
  }
  async function actAndRefresh(id: string, action: () => Promise<void>) {
    setNeedsRefresh(true);
    let failed = false;
    let failure: unknown;
    try { await action(); } catch (error) { failed = true; failure = error; }
    try { await open(id); } catch {
      const prefix = failed && failure instanceof Error ? `${failure.message} ` : '';
      throw new Error(`${prefix}The company could not be refreshed. Refresh it before advancing time.`);
    }
    if (failed) throw failure;
  }
  async function create() {
    const id = localStorage.getItem(creationKey) ?? crypto.randomUUID();
    localStorage.setItem(creationKey, id);
    await client.create(id);
    localStorage.removeItem(creationKey);
    await list(); await open(id);
  }
  const unresolved = Boolean(pendingId || localPending);
  return <>
    <div className="account-bar"><span>{session.user.email}</span><button type="button" disabled={busy} onClick={() => { setSnapshot(null); void supabase!.auth.signOut(); }}>Sign out</button></div>
    {!snapshot ? <main className="connection-screen"><div className="connection-card"><span className="eyebrow">YOUR WINERY</span><h1>Your companies</h1>
      {companies.length === 0 && <p>No companies found.</p>}
      {companies.map(id => <button className="company-choice" key={id} disabled={busy} onClick={() => void run(() => open(id))}>Open company {id.slice(0, 8)}</button>)}
      <button className="primary-button" disabled={busy} onClick={() => void run(create)}>{localStorage.getItem(creationKey) ? 'Retry creating company' : 'Create company'}</button>{' '}
      <button className="secondary-button" disabled={busy} onClick={() => void run(list)}>Refresh</button>
      {message && <p role="alert">{message}</p>}
    </div></main> : <>
      <App calendar={snapshot.state.calendar} busy={busy} canAdvance={!unresolved && !needsRefresh} onAdvance={() => void run(() => actAndRefresh(snapshot.companyId, () => client.advance(snapshot)))} />
      <div className="connection-status"><button type="button" disabled={busy || unresolved} onClick={() => void run(async () => {
        if (pendingId) throw new Error('Resolve the pending command first.');
        await client.prepareToSwitch(snapshot.companyId);
        setSnapshot(null); setPendingId(undefined); setNeedsRefresh(false); await list();
      })}>Companies</button>
        {unresolved && <button type="button" disabled={busy} onClick={() => void run(() => actAndRefresh(snapshot.companyId, () => client.recover(snapshot.companyId, pendingId)))}>Resolve pending command</button>}
        {needsRefresh && <button type="button" disabled={busy} onClick={() => void run(() => open(snapshot.companyId))}>Refresh company</button>}
        {message && <span role="alert">{message}</span>}
      </div>
    </>}
  </>;
}
