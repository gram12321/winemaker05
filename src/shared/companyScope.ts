/** Selection scope for company operations. Profiles are shared selections, not credentials. */
export type CompanyScope =
  | { readonly kind: 'player'; readonly playerId: string }
  | { readonly kind: 'unassigned' };

/** The persisted owner key used by the trusted company store. */
export function companyOwnerId(scope: CompanyScope): string {
  return scope.kind === 'player' ? `player:${scope.playerId.toLowerCase()}` : 'unassigned';
}

/** Keep browser recovery records separate for each selectable scope. */
export function companyScopeStorageKey(scope: CompanyScope): string {
  return scope.kind === 'player' ? `player-${scope.playerId.toLowerCase()}` : 'unassigned';
}
