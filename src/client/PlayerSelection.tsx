import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../shared/names';
import type { CompanySummary, PendingCreation } from './CompanyClient';
import type { PendingPlayerCreation, PlayerProfile } from './playerProfiles';

interface PlayerSelectionProps {
  players: PlayerProfile[];
  unassignedCompanies: CompanySummary[];
  pendingPlayer: PendingPlayerCreation;
  pendingCreation: PendingCreation;
  busy: boolean;
  message: string;
  onChoose: (profile: PlayerProfile) => void;
  onCreate: (name: string) => void;
  onDiscardInvalidPlayer: () => void;
  onStartCompany: (name: string) => void;
  onDiscardInvalid: () => void;
  onOpenUnassigned: (id: string) => void;
}

export default function PlayerSelection({
  players, unassignedCompanies, pendingPlayer, pendingCreation, busy, message,
  onChoose, onCreate, onDiscardInvalidPlayer, onStartCompany, onDiscardInvalid, onOpenUnassigned,
}: PlayerSelectionProps) {
  const [creating, setCreating] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(true);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');

  return <>
    <h2>♙ User Selection</h2>
    <p className="hint">Select a user or create a new one</p>
    {players.length > 0 && <div className="choice-grid">
      {players.map(profile => <button key={profile.id} className="profile-choice" disabled={busy} onClick={() => onChoose(profile)}>
        <span className="avatar">♟</span>
        <span><strong>{profile.name}</strong><small>Member since {new Date(profile.createdAt).toLocaleDateString()}</small></span>
      </button>)}
    </div>}

    {pendingPlayer.kind === 'invalid' && <div className="entry-form">
      <p role="alert">The saved player request is invalid.</p>
      <button type="button" className="outline-button" disabled={busy} onClick={onDiscardInvalidPlayer}>Discard invalid player request</button>
    </div>}
    {pendingPlayer.kind === 'none' && !creating && <div className="entry-form">
      <button type="button" className="outline-button full create-user-button" disabled={busy} onClick={() => setCreating(true)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="7" r="4" /><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20M19 8v6M16 11h6" />
        </svg>
        Create New User
      </button>
    </div>}
    {pendingPlayer.kind !== 'invalid' && (creating || pendingPlayer.kind === 'pending') && <form className="entry-form" onSubmit={event => { event.preventDefault(); onCreate(name.trim()); }}>
      <label>User Name<input autoComplete="nickname" maxLength={MAX_NAME_LENGTH} required placeholder="Enter your username"
        disabled={pendingPlayer.kind === 'pending'} value={pendingPlayer.kind === 'pending' ? pendingPlayer.name : name}
        onChange={event => setName(event.target.value)} /></label>
      <button className="wine-button" disabled={busy || (pendingPlayer.kind === 'none' && !name.trim())}>
        {pendingPlayer.kind === 'pending' ? 'Retry creating user' : 'Create User'}
      </button>{' '}
      <button type="button" className="outline-button" disabled={busy || pendingPlayer.kind === 'pending'} onClick={() => { setCreating(false); setName(''); }}>Cancel</button>
    </form>}

    {unassignedCompanies.length > 0 && <>
      <h3>Unassigned Companies</h3>
      <div className="choice-grid">{unassignedCompanies.map(company => <button type="button" className="company-choice" key={company.id} disabled={busy} onClick={() => onOpenUnassigned(company.id)}>
        <strong>{company.name}</strong>
        <small>{company.date ? `Week ${company.date.week}, Season ${company.date.season}, Year ${company.date.year}` : 'Company data unavailable'}</small>
      </button>)}</div>
    </>}

    {pendingCreation.kind === 'invalid' && <div className="entry-form">
      <p role="alert">The saved company request is invalid.</p>
      <button type="button" className="outline-button" disabled={busy} onClick={onDiscardInvalid}>Discard invalid request</button>
    </div>}
    {pendingCreation.kind !== 'invalid' && (creatingCompany || pendingCreation.kind === 'pending') && <form className="entry-form" onSubmit={event => { event.preventDefault(); onStartCompany(companyName.trim()); }}>
      <label>Company Name<input required maxLength={MAX_NAME_LENGTH} placeholder="Enter company name"
        disabled={pendingCreation.kind === 'pending'} value={pendingCreation.kind === 'pending' ? pendingCreation.name : companyName}
        onChange={event => setCompanyName(event.target.value)} /></label>
      <button className="wine-button" disabled={busy || (pendingCreation.kind === 'none' && !companyName.trim())}>
        {busy ? 'Creating...' : pendingCreation.kind === 'pending' ? 'Retry creating company' : 'Start'}
      </button>{' '}
      <button type="button" className="outline-button" disabled={busy || pendingCreation.kind === 'pending'} onClick={() => { setCompanyName(''); setCreatingCompany(false); }}>Cancel</button>
    </form>}
    {pendingCreation.kind === 'none' && !creatingCompany && <div className="entry-form">
      <button type="button" className="outline-button full" disabled={busy} onClick={() => setCreatingCompany(true)}>Create Company Without User</button>
    </div>}
    {message && <p role="alert">{message}</p>}
  </>;
}
