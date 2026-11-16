import type { CompanyState, DomainEvent, GameCommand } from '../game/core';

/** Version 1 is a new 05 format; it is not a Winemaker04 save format. */
export const COMPANY_SAVE_VERSION = 1 as const;

export interface CompanySnapshot {
  readonly schemaVersion: typeof COMPANY_SAVE_VERSION;
  readonly companyId: string;
  readonly revision: number;
  readonly state: CompanyState;
}

export interface CommandEnvelope {
  readonly companyId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly command: GameCommand;
}

export interface CommandReceipt {
  readonly companyId: string;
  readonly commandId: string;
  /** Versioned canonical semantic command, excluding expectedRevision. */
  readonly fingerprint: string;
  readonly revision: number;
}

/** A durable, owner-scoped reservation for one trusted command attempt. */
export interface PendingAttempt {
  readonly companyId: string;
  readonly commandId: string;
  readonly fingerprint: string;
  readonly attemptId: string;
}

export type LoadFailure =
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid'; readonly details: string }
  | { readonly kind: 'unsupported'; readonly version: number }
  | { readonly kind: 'unavailable'; readonly details: string };

export type LoadResult =
  | { readonly kind: 'loaded'; readonly snapshot: CompanySnapshot; readonly pending?: PendingAttempt }
  | LoadFailure;

export type ReceiptResult =
  | { readonly kind: 'found'; readonly receipt: CommandReceipt }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable'; readonly details: string };

export type CommitResult =
  | { readonly kind: 'committed' }
  | { readonly kind: 'already-committed'; readonly receipt: CommandReceipt }
  | { readonly kind: 'command-id-mismatch' }
  | { readonly kind: 'conflict'; readonly currentRevision: number }
  | { readonly kind: 'pending'; readonly pending: PendingAttempt }
  | { readonly kind: 'failed'; readonly details: string }
  | { readonly kind: 'unknown' };

export type AttemptResolution =
  | { readonly kind: 'committed'; readonly receipt: CommandReceipt }
  | { readonly kind: 'command-id-mismatch'; readonly receipt: CommandReceipt }
  | { readonly kind: 'not-committed' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unavailable'; readonly details: string };

/**
 * Internal trusted-authority-to-storage boundary, not a client API.
 *
 * The host must authenticate the caller and authorize each company operation.
 * Bind the provider to that trusted identity and enforce ownership at every
 * load, receipt, commit and resolution; a company ID is not authorization.
 * The host must run the rules itself, never accept `next` from a client.
 * A provider must validate the entire versioned state on load, preserve invalid
 * data, and return a coherent authoritative revision. Receipt lookup and load
 * must observe authoritative data rather than an eventually consistent cache.
 *
 * load returns the pending reservation, if any, from the same authoritative
 * view as the snapshot. commit checks receipts before pending reservations and
 * reserves the attempt durably before applying a mutation. Under the same
 * company serialization boundary it compares the revision and atomically
 * writes candidate, next revision and receipt while clearing that reservation.
 * A competing reservation returns `pending` with its identity; it must never
 * be canceled merely because a different intent arrived.
 * A duplicate fingerprint returns its receipt even when expectedRevision is
 * stale; a different fingerprint is an error. Receipts must remain available
 * throughout the supported retry period. `failed` guarantees that this attempt
 * did not commit; uncertainty must return `unknown` instead.
 *
 * Attempt IDs are unique trusted-service-generated IDs, distinct from the
 * player's stable command ID. A commit must check a durable attempt fence as
 * part of its transaction. resolveAttempt's `not-committed` is stronger than
 * an absent receipt: it must atomically fence that attempt and guarantee it
 * cannot reserve or commit later, even if its original request has not started yet. A new
 * attempt may retry the same command ID after such a fence. A resolution that
 * finds a different command under the same ID must also fence this attempt
 * before returning `command-id-mismatch`.
 * An absent receipt or pending row alone does not establish a fence. A failed
 * or unacknowledged reservation/apply commit must remain `unknown` until the
 * receipt or a durably acknowledged fence resolves the attempt.
 * The interface itself does not provide a transaction or cross-device CAS.
 */
export interface CompanySavePort {
  load(companyId: string): Promise<LoadResult>;
  getReceipt(companyId: string, commandId: string): Promise<ReceiptResult>;
  commit(input: {
    readonly companyId: string;
    readonly attemptId: string;
    readonly expectedRevision: number;
    readonly next: CompanyState;
    readonly receipt: CommandReceipt;
  }): Promise<CommitResult>;
  resolveAttempt(input: {
    readonly companyId: string;
    readonly commandId: string;
    readonly fingerprint: string;
    readonly attemptId: string;
  }): Promise<AttemptResolution>;
}

export type DispatchResult =
  | { readonly kind: 'committed'; readonly revision: number; readonly events: readonly DomainEvent[] }
  | { readonly kind: 'already-committed'; readonly revision: number }
  | { readonly kind: 'rejected'; readonly reasons: readonly string[] }
  | { readonly kind: 'conflict'; readonly currentRevision: number; readonly reload?: LoadFailure }
  | { readonly kind: 'command-id-mismatch' }
  | { readonly kind: 'failed'; readonly details: string }
  | { readonly kind: 'unavailable'; readonly details: string }
  | { readonly kind: 'unknown'; readonly commandId: string }
  | { readonly kind: 'sync-required'; readonly commandId: string; readonly load: LoadFailure }
  | { readonly kind: 'blocked'; readonly reason: 'unresolved' | 'sync-required' }
  | { readonly kind: 'inactive-company' }
  | { readonly kind: 'invalid-input'; readonly details: string };

export type SwitchResult = LoadResult | { readonly kind: 'blocked'; readonly reason: 'unresolved' | 'sync-required' };

export type ResolutionResult =
  | { readonly kind: 'nothing-to-resolve' }
  | { readonly kind: 'committed'; readonly revision: number }
  | { readonly kind: 'not-committed' }
  | { readonly kind: 'command-id-mismatch'; readonly reload?: LoadFailure }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unavailable'; readonly details: string }
  | { readonly kind: 'sync-required'; readonly commandId: string; readonly load: LoadFailure }
  | { readonly kind: 'invalid-receipt'; readonly details: string };
