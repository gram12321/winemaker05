import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompanyClient, type CompanySummary } from './CompanyClient';
import CompanyWorkspace from './CompanyWorkspace';
import PlayerSelection from './PlayerSelection';
import Welcome from './Welcome';
import { createProfile, discardInvalidPlayerCreation, listProfiles, pendingPlayerCreation, renameProfile, selectedPlayer, selectPlayer, type PlayerProfile } from './playerProfiles';
import type { ActiveSelection } from './activeSelection';
import './connection.css';

export default function ConnectedApp() {
  const [active, setActive] = useState<ActiveSelection | null>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<PlayerProfile[]>([]);
  const [unassignedCompanies, setUnassignedCompanies] = useState<CompanySummary[]>([]);
  const unassignedClient = useMemo(() => new CompanyClient({ kind: 'unassigned' }), []);
  const activeRef = useRef(false);

  const activate = useCallback((profile: PlayerProfile | null, autoOpen: boolean) => {
    if (!profile) {
      selectPlayer('unassigned');
      setActive({ kind: 'unassigned', autoOpen });
      return;
    }
    selectPlayer(profile.id);
    setActive({ kind: 'player', profile, autoOpen });
  }, []);
  useEffect(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    const id = selectedPlayer();
    void (async () => {
      const players = await listProfiles();
      setAvailable(players);
      void unassignedClient.list().then(setUnassignedCompanies).catch(() => setMessage('Could not load unassigned companies.'));
      if (pendingPlayerCreation().kind !== 'none') return;
      if (!id) {
        if (players.length === 1) activate(players[0], false);
        return;
      }
      if (id === 'unassigned') {
        activate(null, true);
        return;
      }
      const profile = players.find(player => player.id === id);
      if (profile) activate(profile, true);
      else selectPlayer(null);
    })().catch(() => { setMessage('Could not load player profiles. Check that the authority is running.'); }).finally(() => setChecking(false));
  }, [activate, unassignedClient]);

  async function createPlayer(name: string) {
    setBusy(true); setMessage('');
    try {
      const profile = await createProfile(name);
      setAvailable(players => players.some(player => player.id === profile.id)
        ? players.map(player => player.id === profile.id ? profile : player)
        : [...players, profile]);
      selectPlayer(profile.id);
      setActive({ kind: 'player', profile, autoOpen: false });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create player.'); }
    finally { setBusy(false); }
  }
  async function choose(profile: PlayerProfile) {
    setBusy(true); setMessage('');
    try { activate(profile, false); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not select player.'); }
    finally { setBusy(false); }
  }
  async function startUnassignedCompany(name: string) {
    setBusy(true); setMessage('');
    try {
      const { snapshot } = await unassignedClient.create(name);
      localStorage.setItem('winemaker05.lastCompany.unassigned', snapshot.companyId);
      localStorage.setItem(`winemaker05.lastCompany.unassigned.${snapshot.companyId}`, new Date().toISOString());
      selectPlayer('unassigned');
      setActive({ kind: 'unassigned', autoOpen: true });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create company.'); }
    finally { setBusy(false); }
  }
  async function openUnassignedCompany(companyId: string) {
    try {
      localStorage.setItem('winemaker05.lastCompany.unassigned', companyId);
      activate(null, true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open company.'); }
  }
  async function discardInvalidUnassignedCreation() {
    setBusy(true); setMessage('');
    try { await unassignedClient.discardInvalidCreation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not discard the saved request.'); }
    finally { setBusy(false); }
  }
  async function discardInvalidPlayer() {
    setBusy(true); setMessage('');
    try { await discardInvalidPlayerCreation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not discard the saved request.'); }
    finally { setBusy(false); }
  }
  if (checking) return <div className="connection-screen">Restoring your player…</div>;
  if (!active) return <Welcome><PlayerSelection players={available} unassignedCompanies={unassignedCompanies} pendingPlayer={pendingPlayerCreation()} pendingCreation={unassignedClient.getPendingCreation()} busy={busy} message={message} onChoose={profile => void choose(profile)} onCreate={name => void createPlayer(name)} onDiscardInvalidPlayer={() => void discardInvalidPlayer()} onStartCompany={name => void startUnassignedCompany(name)} onDiscardInvalid={() => void discardInvalidUnassignedCreation()} onOpenUnassigned={id => void openUnassignedCompany(id)} /></Welcome>;
  return <CompanyWorkspace key={active.kind === 'player' ? active.profile.id : 'unassigned'} active={active} onLogout={async () => { if (active.kind === 'unassigned') { try { setUnassignedCompanies(await unassignedClient.list()); } catch { setMessage('Could not load unassigned companies.'); } } selectPlayer(null); setActive(null); }} onRename={async name => {
    if (active.kind !== 'player') return;
    const profile = await renameProfile(active.profile.id, name);
    setAvailable(players => players.map(player => player.id === profile.id ? profile : player));
    setActive(current => current?.kind === 'player' && current.profile.id === profile.id ? { ...current, profile } : current);
  }} />;
}
