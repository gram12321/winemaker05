import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLIC_ANON_KEY as string | undefined;
export const authConfigured = Boolean(url && key);

// Each browser profile has its own persisted Supabase session. Deselecting a
// player does not revoke the anonymous session needed to select it again.
export function playerAuth(profileId: string) {
  if (!url || !key) throw new Error('Supabase is not configured.');
  return createClient(url, key, { auth: { storageKey: `winemaker05.player.${profileId}`, autoRefreshToken: false } });
}
