import {
  type AttemptResolution,
  type CommandReceipt,
  type CommitResult,
  type CompanySavePort,
  type CompanySnapshot,
  type LoadResult,
  type PendingAttempt,
  type ReceiptResult,
} from '../../src/authority';
import { readCompanyState, type CompanyState } from '../../src/game/core';

type CommitInput = Parameters<CompanySavePort['commit']>[0];

/** Shared deterministic model of the two durable transaction boundaries. */
export class InMemorySave implements CompanySavePort {
  readonly companies = new Map<string, CompanySnapshot>();
  readonly receipts = new Map<string, CommandReceipt>();
  readonly receiptAttempts = new Map<string, string>();
  readonly pending = new Map<string, PendingAttempt>();
  readonly fences = new Map<string, PendingAttempt>();
  readonly commandFences = new Set<string>();
  readonly loadOverrides = new Map<string, LoadResult>();
  beforeCommit?: () => Promise<void>;
  beforeApply?: () => Promise<void>;
  nextCommit: 'normal' | 'fail' | 'commit-then-unknown' | 'late-unknown' | 'reservation-then-unknown' = 'normal';
  resolution: 'normal' | 'pending' | 'unavailable' = 'normal';
  lateAttempt?: CommitInput;
  writes = 0;

  seed(companyId: string, state: CompanyState): void {
    this.companies.set(companyId, { companyId, revision: 0, state: structuredClone(state) });
  }

  async load(companyId: string): Promise<LoadResult> {
    const override = this.loadOverrides.get(companyId);
    if (override) return structuredClone(override);
    const snapshot = this.companies.get(companyId);
    const pending = this.pending.get(companyId);
    if (!snapshot) return { kind: 'missing' };
    return pending ? { kind: 'loaded', snapshot: structuredClone(snapshot), pending: structuredClone(pending) }
      : { kind: 'loaded', snapshot: structuredClone(snapshot) };
  }

  async getReceipt(companyId: string, commandId: string): Promise<ReceiptResult> {
    const receipt = this.receipts.get(this.receiptKey(companyId, commandId));
    return receipt ? { kind: 'found', receipt: structuredClone(receipt) } : { kind: 'absent' };
  }

  async commit(input: CommitInput): Promise<CommitResult> {
    if (this.beforeCommit) await this.beforeCommit();
    const mode = this.nextCommit;
    this.nextCommit = 'normal';
    if (mode === 'fail') return { kind: 'failed', details: 'Injected failure before commit.' };
    if (mode === 'late-unknown') {
      this.lateAttempt = structuredClone(input);
      return { kind: 'unknown' };
    }
    const reserved = this.reserve(input);
    if (reserved.kind !== 'reserved') return reserved;
    if (mode === 'reservation-then-unknown') {
      this.lateAttempt = structuredClone(input);
      return { kind: 'unknown' };
    }
    if (this.beforeApply) await this.beforeApply();
    const result = this.apply(input);
    return mode === 'commit-then-unknown' && result.kind === 'committed' ? { kind: 'unknown' } : result;
  }

  async resolveAttempt(input: Parameters<CompanySavePort['resolveAttempt']>[0]): Promise<AttemptResolution> {
    if (this.resolution === 'unavailable') return { kind: 'unavailable', details: 'Injected resolution failure.' };
    if (this.resolution === 'pending') return { kind: 'pending' };
    if (!this.companies.has(input.companyId)) return { kind: 'unavailable', details: 'Company is missing.' };
    const receipt = this.receipts.get(this.receiptKey(input.companyId, input.commandId));
    if (receipt && receipt.fingerprint === input.fingerprint) return { kind: 'committed', receipt: structuredClone(receipt) };
    const key = this.fenceKey(input.companyId, input.attemptId);
    if (this.receiptAttempts.has(key)) return { kind: 'unavailable', details: 'The attempt ID belongs to another command.' };
    const fence = this.fences.get(key);
    const pending = this.pending.get(input.companyId);
    if ((fence && (fence.commandId !== input.commandId || fence.fingerprint !== input.fingerprint)) ||
        (pending?.attemptId === input.attemptId && (pending.commandId !== input.commandId || pending.fingerprint !== input.fingerprint))) {
      return { kind: 'unavailable', details: 'The attempt ID belongs to another command.' };
    }
    if (!receipt && pending?.commandId === input.commandId && pending.fingerprint !== input.fingerprint) return { kind: 'pending' };
    this.fences.set(key, structuredClone(input));
    if (!receipt) this.commandFences.add(this.receiptKey(input.companyId, input.commandId));
    if (pending?.commandId === input.commandId && pending.fingerprint === input.fingerprint) {
      this.fences.set(this.fenceKey(input.companyId, pending.attemptId), structuredClone(pending));
      this.pending.delete(input.companyId);
    }
    if (receipt) return { kind: 'command-id-mismatch', receipt: structuredClone(receipt) };
    return { kind: 'not-committed' };
  }

  runLateAttempt(): CommitResult {
    if (!this.lateAttempt) throw new Error('No late attempt is waiting.');
    const reserved = this.reserve(this.lateAttempt);
    return reserved.kind === 'reserved' ? this.apply(this.lateAttempt) : reserved;
  }

  private reserve(input: CommitInput): CommitResult | { kind: 'reserved' } {
    const existing = this.receipts.get(this.receiptKey(input.companyId, input.receipt.commandId));
    if (existing) return existing.fingerprint === input.receipt.fingerprint
      ? { kind: 'already-committed', receipt: structuredClone(existing) } : { kind: 'command-id-mismatch' };
    if (this.commandFences.has(this.receiptKey(input.companyId, input.receipt.commandId))) return { kind: 'failed', details: 'Command was fenced.' };
    if (this.receiptAttempts.has(this.fenceKey(input.companyId, input.attemptId))) {
      return { kind: 'failed', details: 'The attempt ID was already used.' };
    }
    if (this.fences.has(this.fenceKey(input.companyId, input.attemptId))) return { kind: 'failed', details: 'Attempt was fenced.' };
    const pending = this.pending.get(input.companyId);
    if (pending) {
      if (pending.attemptId !== input.attemptId || pending.commandId !== input.receipt.commandId || pending.fingerprint !== input.receipt.fingerprint) {
        return { kind: 'pending', pending: structuredClone(pending) };
      }
      return { kind: 'reserved' };
    }
    const current = this.companies.get(input.companyId);
    if (!current) return { kind: 'failed', details: 'Company is missing.' };
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
        input.expectedRevision === Number.MAX_SAFE_INTEGER || input.receipt.revision !== input.expectedRevision + 1 ||
        input.receipt.companyId !== input.companyId || readCompanyState(current.state).kind === 'invalid') {
      return { kind: 'failed', details: 'Invalid company or revision.' };
    }
    if (current.revision !== input.expectedRevision) return { kind: 'conflict', currentRevision: current.revision };
    if (readCompanyState(input.next).kind === 'invalid') return { kind: 'failed', details: 'Invalid candidate.' };
    this.pending.set(input.companyId, {
      companyId: input.companyId, commandId: input.receipt.commandId, fingerprint: input.receipt.fingerprint, attemptId: input.attemptId,
    });
    return { kind: 'reserved' };
  }

  private apply(input: CommitInput): CommitResult {
    const existing = this.receipts.get(this.receiptKey(input.companyId, input.receipt.commandId));
    if (existing) return existing.fingerprint === input.receipt.fingerprint
      ? { kind: 'already-committed', receipt: structuredClone(existing) } : { kind: 'command-id-mismatch' };
    if (this.commandFences.has(this.receiptKey(input.companyId, input.receipt.commandId))) return { kind: 'failed', details: 'Command was fenced.' };
    if (this.fences.has(this.fenceKey(input.companyId, input.attemptId))) return { kind: 'failed', details: 'Attempt was fenced.' };
    const pending = this.pending.get(input.companyId);
    if (!pending || pending.attemptId !== input.attemptId || pending.commandId !== input.receipt.commandId || pending.fingerprint !== input.receipt.fingerprint) {
      return { kind: 'unknown' };
    }
    const current = this.companies.get(input.companyId);
    if (!current) return { kind: 'unknown' };
    if (current.revision !== input.expectedRevision) {
      this.fences.set(this.fenceKey(input.companyId, input.attemptId), pending);
      this.pending.delete(input.companyId);
      return { kind: 'conflict', currentRevision: current.revision };
    }
    this.companies.set(input.companyId, { ...current, revision: input.receipt.revision, state: structuredClone(input.next) });
    this.receipts.set(this.receiptKey(input.companyId, input.receipt.commandId), structuredClone(input.receipt));
    this.receiptAttempts.set(this.fenceKey(input.companyId, input.attemptId), input.receipt.commandId);
    this.pending.delete(input.companyId);
    this.writes += 1;
    return { kind: 'committed' };
  }

  private receiptKey(companyId: string, commandId: string): string {
    return JSON.stringify([companyId, commandId]);
  }

  private fenceKey(companyId: string, attemptId: string): string {
    return JSON.stringify([companyId, attemptId]);
  }
}
