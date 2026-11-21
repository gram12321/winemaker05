import type { PlayerProfile } from './playerProfiles';

/** An unassigned company has no synthetic player profile. */
export type ActiveSelection =
  | { readonly kind: 'player'; readonly profile: PlayerProfile; readonly autoOpen: boolean }
  | { readonly kind: 'unassigned'; readonly autoOpen: boolean };
