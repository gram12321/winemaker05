import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { CompanySnapshot } from '../authority/contracts';
import App from '../App';
import readme from '../../README.md?raw';
import versionLog from '../../docs/versionlog.md?raw';
import { CompanyClient, type CompanySummary } from './CompanyClient';
import { profiles, saveProfile, selectedPlayer, selectPlayer, type PlayerProfile } from './playerProfiles';
import { authConfigured, playerAuth } from './supabase';
import './connection.css';

type ActivePlayer = { profile: PlayerProfile; auth: SupabaseClient; session: Session; autoOpen: boolean };

export default function ConnectedApp() {
  const [active, setActive] = useState<ActivePlayer | null>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(profiles);
  const activeRef = useRef(false);

  const activate = useCallback(async (profile: PlayerProfile, autoOpen: boolean) => {
    const auth = playerAuth(profile.id);
    const { data, error } = await auth.auth.getSession();
    if (error || !data.session) throw new Error('This player session is unavailable in this browser.');
    selectPlayer(profile.id);
    setActive({ profile, auth, session: data.session, autoOpen });
  }, []);
  useEffect(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    const id = selectedPlayer();
    const profile = profiles().find(p => p.id === id);
    if (!profile || !authConfigured) { setChecking(false); return; }
    void activate(profile, true).catch(() => { selectPlayer(null); setMessage('Your previous player could not be restored. Select a player to continue.'); }).finally(() => setChecking(false));
  }, [activate]);
  useEffect(() => {
    if (!active) return;
    const { data } = active.auth.auth.onAuthStateChange((_event, session) => {
      if (session) setActive(current => current?.profile.id === active.profile.id ? { ...current, session } : current);
    });
    return () => data.subscription.unsubscribe();
  }, [active?.auth, active?.profile.id]);

  async function createPlayer(name: string) {
    setBusy(true); setMessage('');
    try {
      const profile: PlayerProfile = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
      const auth = playerAuth(profile.id);
      const { data, error } = await auth.auth.signInAnonymously({ options: { data: { name } } });
      if (error || !data.session) throw new Error(error?.message ?? 'Could not create player.');
      saveProfile(profile); setAvailable(profiles()); selectPlayer(profile.id);
      setActive({ profile, auth, session: data.session, autoOpen: false });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create player.'); }
    finally { setBusy(false); }
  }
  async function choose(profile: PlayerProfile) {
    setBusy(true); setMessage('');
    try { await activate(profile, false); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not select player.'); }
    finally { setBusy(false); }
  }
  if (!authConfigured) return <div className="connection-screen">Supabase URL and publishable key are required in the client configuration.</div>;
  if (checking) return <div className="connection-screen">Restoring your player…</div>;
  if (!active) return <Welcome><PlayerSelection players={available} busy={busy} message={message} onChoose={profile => void choose(profile)} onCreate={name => void createPlayer(name)} /></Welcome>;
  return <CompanyWorkspace key={active.profile.id} active={active} onLogout={() => { selectPlayer(null); setActive(null); setAvailable(profiles()); }} onRename={name => { const profile = { ...active.profile, name }; saveProfile(profile); setAvailable(profiles()); setActive(current => current && { ...current, profile }); }} />;
}

function Welcome({ children }: { children: React.ReactNode }) {
  const [document, setDocument] = useState<'readme' | 'version' | null>(null);
  return <main className="welcome-screen"><div className="welcome-frame"><header className="welcome-header"><h1>Welcome to Winemaker</h1><p>Manage your wine empire and compete with other vintners</p></header>
    <div className="welcome-layout"><section className="welcome-main">{children}</section><aside className="welcome-sidebar"><section><h2>♜ Top Companies</h2><p>Rankings coming soon</p></section><section><h2>♜ Fastest Growing</h2><p>Rankings coming soon</p></section><section><h2>Getting Started</h2><ul><li>Create a company to start your wine empire</li><li>Plant vineyards and craft premium wines</li><li>Build relationships with customers</li><li>Compete on the global leaderboards</li></ul><small>Gameplay features are in development.</small></section></aside></div>
    <nav className="welcome-links" aria-label="Resources"><span title="Coming soon">▤ Trello Board <small>(coming soon)</small></span><button onClick={() => setDocument('readme')}>▥ README</button><button onClick={() => setDocument('version')}>▧ Version Log</button></nav>
    {document && <div className="document-overlay"><div role="dialog" aria-modal="true" aria-label={document === 'readme' ? 'README' : 'Version Log'} className="document-dialog"><button onClick={() => setDocument(null)}>Close</button><pre>{document === 'readme' ? readme : versionLog}</pre></div></div>}
  </div></main>;
}

function PlayerSelection({ players, busy, message, onChoose, onCreate }: { players: PlayerProfile[]; busy: boolean; message: string; onChoose: (profile: PlayerProfile) => void; onCreate: (name: string) => void }) {
  const [creating, setCreating] = useState(players.length === 0);
  const [name, setName] = useState('');
  return <><h2>♙ User Selection</h2><p className="hint">Select a user or create a new one</p><div className="choice-grid">{players.map(profile => <button key={profile.id} className="profile-choice" disabled={busy} onClick={() => onChoose(profile)}><span className="avatar">♟</span><span><strong>{profile.name}</strong><small>Member since {new Date(profile.createdAt).toLocaleDateString()}</small></span></button>)}</div>
    {!creating ? <button className="outline-button full" disabled={busy} onClick={() => setCreating(true)}>♙ Create New User</button> : <form className="entry-form" onSubmit={event => { event.preventDefault(); if (name.trim()) onCreate(name.trim()); }}><label>User Name<input autoComplete="nickname" maxLength={80} required placeholder="Enter your username" value={name} onChange={event => setName(event.target.value)} /></label><button className="wine-button" disabled={busy || !name.trim()}>Create User</button>{players.length > 0 && <> <button type="button" className="outline-button" onClick={() => setCreating(false)}>Cancel</button></>}</form>}
    <p className="hint">Players are saved in this browser. Clearing browser data loses access to their companies.</p>{message && <p role="alert">{message}</p>}</>;
}

function CompanyWorkspace({ active, onLogout, onRename }: { active: ActivePlayer; onLogout: () => void; onRename: (name: string) => void }) {
  const { auth, profile, session } = active;
  const client = useMemo(() => new CompanyClient(async () => {
    const { data, error } = await auth.auth.getSession();
    if (error || !data.session || data.session.user.id !== session.user.id) throw new Error('Select your player again to continue.');
    return data.session.access_token;
  }, session.user.id), [auth, session.user.id]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loadedList, setLoadedList] = useState(false);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [pendingId, setPendingId] = useState<string>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [editingPlayer, setEditingPlayer] = useState(false);
  const [playerName, setPlayerName] = useState(profile.name);
  const [companyName, setCompanyName] = useState('');
  const [creating, setCreating] = useState(false);
  const creationKey = `winemaker05.creation.${session.user.id}`;
  const lastKey = `winemaker05.lastCompany.${session.user.id}`;
  const companyId = snapshot?.companyId;
  const subscribePending = useCallback((notify: () => void) => companyId ? client.subscribePending(companyId, cleared => { if (cleared) setNeedsRefresh(true); notify(); }) : () => {}, [client, companyId]);
  const getPending = useCallback(() => companyId ? client.hasPending(companyId) : false, [client, companyId]);
  const localPending = useSyncExternalStore(subscribePending, getPending, () => false);
  async function list() { const result = await client.list(); setCompanies(result); setLoadedList(true); return result; }
  async function open(id: string, remember = true) {
    const loaded = await client.load(id);
    setSnapshot(loaded.snapshot); setPendingId(loaded.pendingId); setNeedsRefresh(false);
    if (remember) { localStorage.setItem(lastKey, id); localStorage.setItem(`${lastKey}.${id}`, new Date().toISOString()); }
  }
  useEffect(() => {
    let live = true;
    void client.list().then(async result => {
      if (!live) return;
      setCompanies(result); setLoadedList(true);
      const id = localStorage.getItem(lastKey);
      if (active.autoOpen && id && result.some(c => c.id === id)) {
        const loaded = await client.load(id);
        if (live) { setSnapshot(loaded.snapshot); setPendingId(loaded.pendingId); }
      }
    }).catch(() => { if (live) setMessage('Could not load companies. Check that the authority is running.'); });
    return () => { live = false; };
  }, [client, lastKey, active.autoOpen]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'The service is unavailable.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function actAndRefresh(id: string, action: () => Promise<void>) {
    setNeedsRefresh(true); let failure: unknown;
    try { await action(); } catch (error) { failure = error; }
    try { await open(id, false); } catch { throw new Error(`${failure instanceof Error ? `${failure.message} ` : ''}The company could not be refreshed. Refresh it before advancing time.`); }
    if (failure) throw failure;
  }
  async function create() {
    const saved = localStorage.getItem(creationKey);
    const intent: { id: string; name: string } = saved ? JSON.parse(saved) : { id: crypto.randomUUID(), name: companyName.trim() };
    if (!intent.name) throw new Error('Enter a company name.');
    localStorage.setItem(creationKey, JSON.stringify(intent));
    await client.create(intent.id, intent.name); localStorage.removeItem(creationKey);
    await list(); await open(intent.id);
  }
  const unresolved = Boolean(pendingId || localPending);
  async function logout() {
    if (snapshot) { if (unresolved) throw new Error('Resolve the pending command first.'); await client.prepareToSwitch(snapshot.companyId); }
    onLogout();
  }
  const bar = <div className="account-bar"><span>{profile.name}</span><button type="button" disabled={busy} onClick={() => setEditingPlayer(v => !v)}>Player profile</button><button type="button" disabled={busy} onClick={() => void run(logout)}>Log out</button></div>;
  const editor = editingPlayer && <form className="profile-editor" onSubmit={event => { event.preventDefault(); void run(async () => { const name = playerName.trim(); if (!name) throw new Error('Enter a player name.'); const { error } = await auth.auth.updateUser({ data: { name } }); if (error) throw new Error(error.message); onRename(name); setEditingPlayer(false); }); }}><label>Player name<input required maxLength={80} value={playerName} onChange={event => setPlayerName(event.target.value)} /></label><button className="wine-button" disabled={busy}>Save name</button> <button type="button" onClick={() => setEditingPlayer(false)}>Cancel</button>{message && <p role="alert">{message}</p>}</form>;
  if (!snapshot) return <>{bar}{editor}<Welcome><h2>♙ My Companies</h2><p className="hint">Welcome, {profile.name}. Select a company or create a new one.</p><div className="choice-grid">{companies.map(company => <button className="company-choice" key={company.id} disabled={busy} onClick={() => void run(() => open(company.id))}><strong>{company.name}</strong><small>{company.date ? `Week ${company.date.week}, Season ${company.date.season}, Year ${company.date.year}` : 'Company data unavailable'}</small><small>{localStorage.getItem(`${lastKey}.${company.id}`) ? `Last played ${new Date(localStorage.getItem(`${lastKey}.${company.id}`)!).toLocaleDateString()}` : 'Not played in this browser'}</small></button>)}</div>
    {loadedList && !companies.length && <p className="hint">No companies yet.</p>}
    {!creating && companies.length > 0 && !localStorage.getItem(creationKey) ? <button className="outline-button full" onClick={() => setCreating(true)}>♧ Create New Company</button> : <form className="entry-form" onSubmit={event => { event.preventDefault(); void run(create); }}><label>Company Name<input required maxLength={80} placeholder="Enter company name" disabled={Boolean(localStorage.getItem(creationKey))} value={companyName} onChange={event => setCompanyName(event.target.value)} /></label><button className="wine-button" disabled={busy || (!companyName.trim() && !localStorage.getItem(creationKey))}>{localStorage.getItem(creationKey) ? 'Retry creating company' : 'Start'}</button>{companies.length > 0 && !localStorage.getItem(creationKey) && <> <button type="button" className="outline-button" onClick={() => setCreating(false)}>Cancel</button></>}</form>}
    {message && <p role="alert">{message}</p>}</Welcome></>;
  return <>{bar}{editor}<App calendar={snapshot.state.calendar} busy={busy} canAdvance={!unresolved && !needsRefresh} onAdvance={() => void run(() => actAndRefresh(snapshot.companyId, () => client.advance(snapshot)))} /><div className="connection-status"><button type="button" disabled={busy || unresolved} onClick={() => void run(async () => { await client.prepareToSwitch(snapshot.companyId); setSnapshot(null); setPendingId(undefined); setNeedsRefresh(false); await list(); })}>Companies</button>{unresolved && <button type="button" disabled={busy} onClick={() => void run(() => actAndRefresh(snapshot.companyId, () => client.recover(snapshot.companyId, pendingId)))}>Resolve pending command</button>}{needsRefresh && <button type="button" disabled={busy} onClick={() => void run(() => open(snapshot.companyId, false))}>Refresh company</button>}{message && <span role="alert">{message}</span>}</div></>;
}
