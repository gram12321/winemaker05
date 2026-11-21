export interface PlayerProfile { id: string; name: string; createdAt: string }
const profilesKey = 'winemaker05.players';
const selectedKey = 'winemaker05.selectedPlayer';

export function profiles(): PlayerProfile[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(profilesKey) ?? '[]');
    return Array.isArray(stored) ? stored.filter((p): p is PlayerProfile => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.createdAt === 'string') : [];
  } catch { return []; }
}
export function saveProfile(profile: PlayerProfile) {
  localStorage.setItem(profilesKey, JSON.stringify([...profiles().filter(p => p.id !== profile.id), profile]));
}
export function selectedPlayer() { return localStorage.getItem(selectedKey); }
export function selectPlayer(id: string | null) {
  if (id) localStorage.setItem(selectedKey, id);
  else localStorage.removeItem(selectedKey);
}
