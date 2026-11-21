/** Player profiles are shared, name-only selections; they do not authenticate a user. */
export interface PlayerProfileRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface PlayerProfileStore {
  list(): Promise<readonly PlayerProfileRecord[]>;
  get(id: string): Promise<PlayerProfileRecord | null>;
  /** The same ID and name may be retried; a different name must not overwrite it. */
  create(input: { readonly id: string; readonly name: string }): Promise<PlayerProfileRecord | null>;
  rename(input: { readonly id: string; readonly name: string }): Promise<PlayerProfileRecord | null>;
}
