import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CompanySnapshot } from '../authority/contracts';
import App from '../App';
import { companyScopeStorageKey, type CompanyScope } from '../shared/companyScope';
import { MAX_NAME_LENGTH } from '../shared/names';
import type { ActiveSelection } from './activeSelection';
import { CompanyClient, type CompanySummary } from './CompanyClient';
import Welcome from './Welcome';

export default function CompanyWorkspace({ active, onLogout, onRename }: { active: ActiveSelection; onLogout: () => Promise<void>; onRename: (name: string) => Promise<void> }) {
  const profile = active.kind === 'player' ? active.profile : null;
  const playerId = profile?.id;
  const unassigned = active.kind === 'unassigned';
  const scope = useMemo<CompanyScope>(() => playerId ? { kind: 'player', playerId } : { kind: 'unassigned' }, [playerId]);
  const client = useMemo(() => new CompanyClient(scope), [scope]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loadedList, setLoadedList] = useState(false);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [pendingId, setPendingId] = useState<string>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [editingPlayer, setEditingPlayer] = useState(false);
  const [playerName, setPlayerName] = useState(profile?.name ?? '');
  const [companyName, setCompanyName] = useState('');
  const [creating, setCreating] = useState(false);
  const ownerKey = companyScopeStorageKey(scope);
  const lastKey = `winemaker05.lastCompany.${ownerKey}`;
  const pendingCreation = client.getPendingCreation();
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
      if (active.autoOpen && client.getPendingCreation().kind === 'none' && id && result.some(c => c.id === id)) {
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
    const loaded = await client.create(companyName);
    const id = loaded.snapshot.companyId;
    localStorage.setItem(lastKey, id); localStorage.setItem(`${lastKey}.${id}`, new Date().toISOString());
    setSnapshot(loaded.snapshot); setPendingId(loaded.pendingId); setNeedsRefresh(false);
  }
  const unresolved = Boolean(pendingId || localPending);
  async function logout() {
    if (snapshot) { if (unresolved) throw new Error('Resolve the pending command first.'); await client.prepareToSwitch(snapshot.companyId); }
    await onLogout();
  }
  const bar = <div className="account-bar"><span>{profile?.name ?? 'Unassigned company'}</span>{!unassigned && <button type="button" disabled={busy} onClick={() => setEditingPlayer(v => !v)}>Player profile</button>}<button type="button" disabled={busy} onClick={() => void run(logout)}>Log out</button></div>;
  const editor = editingPlayer && !unassigned && <form className="profile-editor" onSubmit={event => { event.preventDefault(); void run(async () => { const name = playerName.trim(); if (!name) throw new Error('Enter a player name.'); await onRename(name); setEditingPlayer(false); }); }}><label>Player name<input required maxLength={MAX_NAME_LENGTH} value={playerName} onChange={event => setPlayerName(event.target.value)} /></label><button className="wine-button" disabled={busy}>Save name</button> <button type="button" onClick={() => setEditingPlayer(false)}>Cancel</button>{message && <p role="alert">{message}</p>}</form>;
  if (!snapshot) return <>{bar}{editor}<Welcome><h2>{unassigned ? '♧ Unassigned Companies' : '♙ My Companies'}</h2><p className="hint">{unassigned ? 'Select an existing company or create a new one.' : `Welcome, ${profile?.name}. Select a company or create a new one.`}</p><div className="choice-grid">{companies.map(company => <button className="company-choice" key={company.id} disabled={busy} onClick={() => void run(() => open(company.id))}><strong>{company.name}</strong><small>{company.date ? `Week ${company.date.week}, Season ${company.date.season}, Year ${company.date.year}` : 'Company data unavailable'}</small><small>{localStorage.getItem(`${lastKey}.${company.id}`) ? `Last played ${new Date(localStorage.getItem(`${lastKey}.${company.id}`)!).toLocaleDateString()}` : 'Not played in this browser'}</small></button>)}</div>
    {loadedList && !companies.length && <p className="hint">No companies yet.</p>}
    {pendingCreation.kind === 'invalid' ? <div className="entry-form"><p role="alert">The saved company request is invalid.</p><button type="button" className="outline-button" disabled={busy} onClick={() => void run(() => client.discardInvalidCreation())}>Discard invalid request</button></div> : !creating && companies.length > 0 && pendingCreation.kind === 'none' ? <button className="outline-button full" onClick={() => setCreating(true)}>♧ Create New Company</button> : <form className="entry-form" onSubmit={event => { event.preventDefault(); void run(create); }}><label>Company Name<input required maxLength={MAX_NAME_LENGTH} placeholder="Enter company name" disabled={pendingCreation.kind === 'pending'} value={pendingCreation.kind === 'pending' ? pendingCreation.name : companyName} onChange={event => setCompanyName(event.target.value)} /></label><button className="wine-button" disabled={busy || (!companyName.trim() && pendingCreation.kind === 'none')}>{pendingCreation.kind === 'pending' ? 'Retry creating company' : 'Start'}</button>{companies.length > 0 && pendingCreation.kind === 'none' && <> <button type="button" className="outline-button" onClick={() => setCreating(false)}>Cancel</button></>}</form>}
    {message && <p role="alert">{message}</p>}</Welcome></>;
  return <>{bar}{editor}<App calendar={snapshot.state.calendar} busy={busy} canAdvance={!unresolved && !needsRefresh} onAdvance={() => void run(() => actAndRefresh(snapshot.companyId, () => client.advance(snapshot)))} /><div className="connection-status"><button type="button" disabled={busy || unresolved} onClick={() => void run(async () => { await client.prepareToSwitch(snapshot.companyId); setSnapshot(null); setPendingId(undefined); setNeedsRefresh(false); await list(); })}>Companies</button>{unresolved && <button type="button" disabled={busy} onClick={() => void run(() => actAndRefresh(snapshot.companyId, () => client.recover(snapshot.companyId, pendingId)))}>Resolve pending command</button>}{needsRefresh && <button type="button" disabled={busy} onClick={() => void run(() => open(snapshot.companyId, false))}>Refresh company</button>}{message && <span role="alert">{message}</span>}</div></>;
}
