import { isPlayerId } from '../shared/identifiers';
import { isValidName } from '../shared/names';
import { withBrowserLock } from './browserLock';

export interface PlayerProfile { id: string; name: string; createdAt: string }
const selectedKey = 'winemaker05.selectedPlayer';
const creationKey = 'winemaker05.creation.player';

export type PendingPlayerCreation =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending'; readonly id: string; readonly name: string }
  | { readonly kind: 'invalid' };

class PlayerCreationConflict extends Error {}

function isProfile(value: unknown): value is PlayerProfile {
  return !!value && typeof value === 'object' && 'id' in value && isPlayerId(value.id) &&
    'name' in value && isValidName(value.name) &&
    'createdAt' in value && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
}

export function pendingPlayerCreation(): PendingPlayerCreation {
  const raw = localStorage.getItem(creationKey);
  if (raw === null) return { kind: 'none' };
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && 'id' in value && isPlayerId(value.id) &&
        'name' in value && isValidName(value.name)) {
      return { kind: 'pending', id: value.id, name: value.name };
    }
  } catch { /* Preserve the record until explicitly discarded. */ }
  return { kind: 'invalid' };
}

export async function discardInvalidPlayerCreation(): Promise<void> {
  await withBrowserLock(creationKey, async () => {
    if (pendingPlayerCreation().kind !== 'invalid') throw new Error('The saved player request changed. Refresh and try again.');
    localStorage.removeItem(creationKey);
  });
}

async function request(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
  const response = await fetch(`/api${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result: unknown = await response.json();
  if (response.status === 409 && result && typeof result === 'object' && 'kind' in result && result.kind === 'not-created') throw new PlayerCreationConflict();
  if (!response.ok || !result || typeof result !== 'object') throw new Error('Could not save or load player profiles.');
  return result as Record<string, unknown>;
}

export async function listProfiles(): Promise<PlayerProfile[]> {
  const result = await request('/players', 'GET');
  if (result.kind !== 'players-listed' || !Array.isArray(result.players) || !result.players.every(isProfile)) throw new Error('Could not load player profiles.');
  return result.players;
}
export async function createProfile(name: string): Promise<PlayerProfile> {
  return withBrowserLock(creationKey, async () => {
    const saved = pendingPlayerCreation();
    if (saved.kind === 'invalid') throw new Error('The saved player request is invalid. Discard it before creating a player.');
    const intent = saved.kind === 'pending' ? saved : { id: crypto.randomUUID(), name: name.trim() };
    if (!isValidName(intent.name)) throw new Error('Enter a player name.');
    localStorage.setItem(creationKey, JSON.stringify({ id: intent.id, name: intent.name }));
    let result: Record<string, unknown>;
    try { result = await request('/players', 'POST', { id: intent.id, name: intent.name }); }
    catch (error) {
      if (!(error instanceof PlayerCreationConflict)) throw error;
      localStorage.removeItem(creationKey);
      throw new Error('The saved request conflicts with an existing player. Select that player or create a new user.');
    }
    if (result.kind !== 'player-created' || !isProfile(result.player) || result.player.id !== intent.id || result.player.name !== intent.name) throw new Error('Could not confirm the player profile.');
    localStorage.removeItem(creationKey);
    return result.player;
  });
}
export async function renameProfile(id: string, name: string): Promise<PlayerProfile> {
  const result = await request(`/players/${encodeURIComponent(id)}`, 'PATCH', { name });
  if (result.kind !== 'player-updated' || !isProfile(result.player) || result.player.id !== id) throw new Error('Could not update player profile.');
  return result.player;
}
export function selectedPlayer() { return localStorage.getItem(selectedKey); }
export function selectPlayer(id: string | null) {
  if (id) localStorage.setItem(selectedKey, id);
  else localStorage.removeItem(selectedKey);
}
