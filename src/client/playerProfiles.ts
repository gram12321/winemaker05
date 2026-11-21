export interface PlayerProfile { id: string; name: string; createdAt: string }
const selectedKey = 'winemaker05.selectedPlayer';

async function request(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
  const response = await fetch(`/api${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== 'object') throw new Error('Could not save or load player profiles.');
  return result as Record<string, unknown>;
}

export async function listProfiles(): Promise<PlayerProfile[]> {
  const result = await request('/players', 'GET');
  if (result.kind !== 'players-listed' || !Array.isArray(result.players)) throw new Error('Could not load player profiles.');
  return result.players as PlayerProfile[];
}
export async function createProfile(name: string): Promise<PlayerProfile> {
  const result = await request('/players', 'POST', { name });
  if (result.kind !== 'player-created' || !result.player) throw new Error('Could not create player profile.');
  return result.player as PlayerProfile;
}
export async function renameProfile(id: string, name: string): Promise<PlayerProfile> {
  const result = await request(`/players/${encodeURIComponent(id)}`, 'PATCH', { name });
  if (result.kind !== 'player-updated' || !result.player) throw new Error('Could not update player profile.');
  return result.player as PlayerProfile;
}
export function selectedPlayer() { return localStorage.getItem(selectedKey); }
export function selectPlayer(id: string | null) {
  if (id) localStorage.setItem(selectedKey, id);
  else localStorage.removeItem(selectedKey);
}
