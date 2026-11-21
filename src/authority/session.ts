import { decideCommand, readCompanyState } from '../game/core';
import {
  type CommandEnvelope,
  type CommandReceipt,
  type CompanySavePort,
  type CompanySnapshot,
  type DispatchResult,
  type LoadResult,
  type PendingAttempt,
  type ResolutionResult,
  type SwitchResult,
} from './contracts';
import { canonicalize, commandFingerprint, immutableCopy } from './jsonSnapshot';

interface UnresolvedCommand {
  readonly companyId: string;
  readonly commandId: string;
  readonly fingerprint: string;
  readonly attemptId?: string;
  readonly receipt?: CommandReceipt;
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validPending(value: unknown, companyId: string): value is PendingAttempt {
  if (!value || typeof value !== 'object') return false;
  const pending = value as PendingAttempt;
  return pending.companyId === companyId && typeof pending.attemptId === 'string' && pending.attemptId.length > 0 &&
    typeof pending.commandId === 'string' && pending.commandId.length > 0 &&
    typeof pending.fingerprint === 'string' && pending.fingerprint.length > 0;
}

function details(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

function receiptProblem(receipt: CommandReceipt, expected: UnresolvedCommand): string | undefined {
  if (
    !receipt || typeof receipt !== 'object' ||
    receipt.companyId !== expected.companyId ||
    receipt.commandId !== expected.commandId ||
    !validRevision(receipt.revision) || receipt.revision === 0 ||
    typeof receipt.fingerprint !== 'string' || receipt.fingerprint.length === 0
  ) return 'The storage authority returned an invalid command receipt.';
  if (receipt.fingerprint !== expected.fingerprint) return 'The command ID belongs to a different payload.';
  return undefined;
}

/**
 * A trusted-side session. This class does not authenticate users, provide a
 * server, or turn a storage adapter into an atomic transaction provider.
 */
export class CompanySession {
  private snapshot: CompanySnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private unresolved: UnresolvedCommand | undefined;
  private durablePending: PendingAttempt | undefined;
  private needsRefresh = false;
  private minimumRefreshRevision = 0;

  /** The trusted host supplies a globally unique ID for every commit attempt. */
  constructor(
    private readonly saves: CompanySavePort,
    private readonly createAttemptId: () => string,
  ) {}

  getSnapshot(): CompanySnapshot | null {
    return this.snapshot;
  }

  /** Trusted recovery identity; never infer a fence from its absence. */
  getPendingAttempt(): PendingAttempt | undefined {
    const pending = this.unresolved;
    if (pending?.attemptId) {
      return immutableCopy({ companyId: pending.companyId, commandId: pending.commandId, fingerprint: pending.fingerprint, attemptId: pending.attemptId });
    }
    return this.durablePending;
  }

  /** Includes receipt-only recovery when an authoritative reload failed. */
  getUnresolvedCommand(): Pick<PendingAttempt, 'companyId' | 'commandId' | 'fingerprint'> | undefined {
    const pending = this.unresolved ?? this.durablePending;
    return pending && immutableCopy({ companyId: pending.companyId, commandId: pending.commandId, fingerprint: pending.fingerprint });
  }

  /** An idle host may release this session only when no recovery state would be lost. */
  canDispose(): boolean {
    return !this.unresolved && !this.durablePending && !this.needsRefresh;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  switchCompany(companyId: string): Promise<SwitchResult> {
    return this.enqueue(async () => {
      if (this.unresolved || this.durablePending) return { kind: 'blocked', reason: 'unresolved' };
      if (this.needsRefresh) return { kind: 'blocked', reason: 'sync-required' };
      if (typeof companyId !== 'string' || companyId.length === 0) {
        return { kind: 'invalid', details: 'A company ID is required.' };
      }
      // Another service may have reserved after this session was activated.
      // Refresh the outgoing company before allowing a switch.
      if (this.snapshot && this.snapshot.companyId !== companyId) {
        const current = await this.loadAndPublish(this.snapshot.companyId);
        if (current.kind !== 'loaded') return current;
        if (this.durablePending) return { kind: 'blocked', reason: 'unresolved' };
      }
      return this.loadAndPublish(companyId);
    });
  }

  /** Reload after a conflict whose authoritative snapshot could not be read. */
  refresh(): Promise<SwitchResult> {
    return this.enqueue(async () => {
      if (this.unresolved || this.durablePending) return { kind: 'blocked', reason: 'unresolved' };
      if (!this.snapshot) return { kind: 'missing' };
      const result = await this.loadAndPublish(this.snapshot.companyId, this.minimumRefreshRevision);
      if (result.kind === 'loaded') {
        this.needsRefresh = false;
        this.minimumRefreshRevision = 0;
      }
      return result;
    });
  }

  dispatch(input: CommandEnvelope): Promise<DispatchResult> {
    // Copy before queueing: callers cannot change the intent during an await.
    let envelope: CommandEnvelope;
    let fingerprint: string;
    try {
      envelope = immutableCopy(input);
      if (
        typeof envelope.companyId !== 'string' || envelope.companyId.length === 0 ||
        typeof envelope.commandId !== 'string' || envelope.commandId.length === 0 ||
        !validRevision(envelope.expectedRevision) ||
        !envelope.command || typeof envelope.command !== 'object'
      ) return Promise.resolve({ kind: 'invalid-input', details: 'A company, command ID, revision and command are required.' });
      fingerprint = commandFingerprint(envelope.command);
    } catch (error) {
      return Promise.resolve({ kind: 'invalid-input', details: details(error) });
    }

    return this.enqueue(() => this.dispatchQueued(envelope, fingerprint));
  }

  /** Resolve an uncertain attempt before any further writes or company switch. */
  resolve(): Promise<ResolutionResult> {
    return this.enqueue(async () => {
      const pending: UnresolvedCommand | undefined = this.unresolved ?? this.durablePending;
      if (!pending) return { kind: 'nothing-to-resolve' };
      let receipt = pending.receipt;
      if (!receipt) {
        if (!pending.attemptId) return { kind: 'invalid-receipt', details: 'The uncertain attempt has no ID.' };
        let resolution;
        try {
          resolution = await this.saves.resolveAttempt({
            companyId: pending.companyId,
            commandId: pending.commandId,
            fingerprint: pending.fingerprint,
            attemptId: pending.attemptId,
          });
        } catch (error) {
          return { kind: 'unavailable', details: details(error) };
        }
        if (!resolution || typeof resolution !== 'object' || typeof resolution.kind !== 'string') {
          return { kind: 'unavailable', details: 'The storage authority returned an invalid attempt result.' };
        }
        if (resolution.kind === 'not-committed') {
          if (this.unresolved?.attemptId === pending.attemptId) this.unresolved = undefined;
          if (this.durablePending?.attemptId === pending.attemptId) this.durablePending = undefined;
          const loaded = await this.loadAndPublish(pending.companyId);
          if (loaded.kind !== 'loaded') this.needsRefresh = true;
          return { kind: 'not-committed' };
        }
        if (resolution.kind === 'pending' || resolution.kind === 'unavailable') return resolution;
        if (resolution.kind === 'command-id-mismatch') {
          const other = resolution.receipt;
          if (
            !other || typeof other !== 'object' || other.companyId !== pending.companyId ||
            other.commandId !== pending.commandId || !validRevision(other.revision) || other.revision === 0 ||
            typeof other.fingerprint !== 'string' || other.fingerprint.length === 0 || other.fingerprint === pending.fingerprint
          ) return { kind: 'invalid-receipt', details: 'The storage authority returned an invalid mismatch receipt.' };
          if (this.unresolved?.attemptId === pending.attemptId) this.unresolved = undefined;
          if (this.durablePending?.attemptId === pending.attemptId) this.durablePending = undefined;
          const loaded = await this.loadAndPublish(pending.companyId, other.revision);
          if (loaded.kind !== 'loaded') {
            this.needsRefresh = true;
            this.minimumRefreshRevision = other.revision;
            return { kind: 'command-id-mismatch', reload: loaded };
          }
          return { kind: 'command-id-mismatch' };
        }
        if (resolution.kind !== 'committed') {
          return { kind: 'unavailable', details: 'The storage authority returned an invalid attempt result.' };
        }
        receipt = resolution.receipt;
      }
      const problem = receiptProblem(receipt, pending);
      if (problem) return { kind: 'invalid-receipt', details: problem };
      this.unresolved = { ...pending, receipt: immutableCopy(receipt) };
      if (pending.attemptId && this.durablePending?.attemptId === pending.attemptId) this.durablePending = undefined;
      const loaded = await this.loadAndPublish(pending.companyId, receipt.revision);
      if (loaded.kind !== 'loaded') return { kind: 'sync-required', commandId: pending.commandId, load: loaded };
      this.unresolved = undefined;
      return { kind: 'committed', revision: receipt.revision };
    });
  }

  private async dispatchQueued(envelope: CommandEnvelope, fingerprint: string): Promise<DispatchResult> {
    const current = this.snapshot;
    if (!current || current.companyId !== envelope.companyId) return { kind: 'inactive-company' };

    let lookup;
    try {
      lookup = await this.saves.getReceipt(envelope.companyId, envelope.commandId);
    } catch (error) {
      return { kind: 'unavailable', details: details(error) };
    }
    if (!lookup || typeof lookup !== 'object' || typeof lookup.kind !== 'string') {
      return { kind: 'unavailable', details: 'The storage authority returned an invalid receipt result.' };
    }
    if (lookup.kind === 'unavailable') return lookup;
    if (lookup.kind === 'found') {
      return this.replayReceipt(envelope, fingerprint, lookup.receipt);
    }
    if (lookup.kind !== 'absent') return { kind: 'unavailable', details: 'The storage authority returned an invalid receipt result.' };

    if (this.unresolved || this.durablePending) return { kind: 'blocked', reason: 'unresolved' };
    if (this.needsRefresh) return { kind: 'blocked', reason: 'sync-required' };

    if (current.revision !== envelope.expectedRevision) return this.conflict(current.revision);
    if (current.revision === Number.MAX_SAFE_INTEGER) {
      return { kind: 'failed', details: 'The company revision cannot be incremented safely.' };
    }

    let decision;
    try {
      decision = decideCommand(current.state, envelope.command);
      if (decision.kind === 'rejected') {
        return { kind: 'rejected', reasons: immutableCopy(decision.reasons) };
      }
      // Neither the rules nor the adapter may retain a mutable published alias.
      decision = { ...decision, next: immutableCopy(decision.next), events: immutableCopy(decision.events) };
      const validation = readCompanyState(decision.next);
      if (validation.kind === 'invalid') return { kind: 'failed', details: validation.reasons.join(' ') };
    } catch (error) {
      return { kind: 'failed', details: details(error) };
    }

    const receipt: CommandReceipt = Object.freeze({
      companyId: envelope.companyId,
      commandId: envelope.commandId,
      fingerprint,
      revision: current.revision + 1,
    });
    let attemptId: string;
    try {
      attemptId = this.createAttemptId();
      if (typeof attemptId !== 'string' || attemptId.length === 0) throw new Error('A unique attempt ID is required.');
    } catch (error) {
      return { kind: 'failed', details: details(error) };
    }
    let commit;
    try {
      commit = await this.saves.commit({
        companyId: envelope.companyId,
        attemptId,
        expectedRevision: current.revision,
        next: decision.next,
        receipt,
      });
    } catch {
      commit = { kind: 'unknown' } as const;
    }

    if (!commit || typeof commit !== 'object' || typeof commit.kind !== 'string') {
      this.unresolved = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint, attemptId };
      return { kind: 'unknown', commandId: envelope.commandId };
    }
    switch (commit.kind) {
      case 'committed': {
        const next = immutableCopy({ ...current, revision: receipt.revision, state: decision.next });
        this.publish(next);
        return { kind: 'committed', revision: receipt.revision, events: decision.events };
      }
      case 'already-committed':
        if (
          !commit.receipt || typeof commit.receipt !== 'object' ||
          commit.receipt.companyId !== envelope.companyId || commit.receipt.commandId !== envelope.commandId ||
          !validRevision(commit.receipt.revision) || commit.receipt.revision === 0 || commit.receipt.fingerprint !== fingerprint
        ) {
          this.unresolved = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint, attemptId };
          return { kind: 'unknown', commandId: envelope.commandId };
        }
        return this.replayReceipt(envelope, fingerprint, commit.receipt);
      case 'command-id-mismatch':
      case 'failed':
        return commit;
      case 'conflict':
        if (!validRevision(commit.currentRevision)) {
          this.needsRefresh = true;
          return { kind: 'unavailable', details: 'The storage authority returned an invalid conflict revision.' };
        }
        return this.conflict(commit.currentRevision);
      case 'pending':
        if (!validPending(commit.pending, envelope.companyId)) {
          this.unresolved = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint, attemptId };
          return { kind: 'unknown', commandId: envelope.commandId };
        }
        this.durablePending = immutableCopy(commit.pending);
        return { kind: 'blocked', reason: 'unresolved' };
      case 'unknown':
        this.unresolved = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint, attemptId };
        return { kind: 'unknown', commandId: envelope.commandId };
    }
    this.unresolved = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint, attemptId };
    return { kind: 'unknown', commandId: envelope.commandId };
  }

  private async replayReceipt(envelope: CommandEnvelope, fingerprint: string, receipt: CommandReceipt): Promise<DispatchResult> {
    const pending = { companyId: envelope.companyId, commandId: envelope.commandId, fingerprint };
    const problem = receiptProblem(receipt, pending);
    if (problem) {
      return receipt && typeof receipt === 'object' && typeof receipt.fingerprint === 'string' &&
        !receiptProblem(receipt, { ...pending, fingerprint: receipt.fingerprint }) && receipt.fingerprint !== fingerprint
        ? { kind: 'command-id-mismatch' }
        : { kind: 'unavailable', details: problem };
    }
    const matches = (value: UnresolvedCommand | PendingAttempt | undefined) => value?.companyId === envelope.companyId &&
      value.commandId === envelope.commandId && value.fingerprint === fingerprint;
    const matchingUnresolved = matches(this.unresolved) ? this.unresolved : undefined;
    const matchingDurable = matches(this.durablePending) ? this.durablePending : undefined;
    // A matching receipt settles this command (including a late duplicate),
    // but it says nothing about an unrelated pending attempt. Clear only the
    // matching identity before loading so a newer reservation is discovered.
    if (matchingUnresolved) this.unresolved = undefined;
    if (matchingDurable) this.durablePending = undefined;
    const loaded = await this.loadAndPublish(envelope.companyId, receipt.revision);
    if (loaded.kind !== 'loaded') {
      if (matchingDurable) this.durablePending = matchingDurable;
      if (matchingUnresolved) this.unresolved = { ...matchingUnresolved, receipt: immutableCopy(receipt) };
      else if (!this.unresolved) this.unresolved = { ...pending, receipt: immutableCopy(receipt) };
      else {
        this.needsRefresh = true;
        this.minimumRefreshRevision = Math.max(this.minimumRefreshRevision, receipt.revision);
      }
      return { kind: 'sync-required', commandId: envelope.commandId, load: loaded };
    }
    // Original transient events are intentionally not replayed.
    return { kind: 'already-committed', revision: receipt.revision };
  }

  private async conflict(currentRevision: number): Promise<DispatchResult> {
    const loaded = await this.loadAndPublish(this.snapshot!.companyId, currentRevision);
    if (loaded.kind === 'loaded') return { kind: 'conflict', currentRevision: loaded.snapshot.revision };
    this.needsRefresh = true;
    this.minimumRefreshRevision = Math.max(this.minimumRefreshRevision, currentRevision);
    return { kind: 'conflict', currentRevision, reload: loaded };
  }

  private async loadAndPublish(companyId: string, minimumRevision = 0): Promise<LoadResult> {
    let loaded: LoadResult;
    try {
      loaded = await this.saves.load(companyId);
    } catch (error) {
      return { kind: 'unavailable', details: details(error) };
    }
    if (!loaded || typeof loaded !== 'object' || typeof loaded.kind !== 'string') {
      return { kind: 'unavailable', details: 'The storage authority returned an invalid load result.' };
    }
    if (loaded.kind !== 'loaded') return loaded;

    const candidate = loaded.snapshot;
    if (!candidate || typeof candidate !== 'object') {
      return { kind: 'invalid', details: 'The storage authority returned an invalid company snapshot.' };
    }
    let copy: CompanySnapshot;
    try {
      copy = immutableCopy(candidate);
    } catch (error) {
      return { kind: 'invalid', details: details(error) };
    }
    if (
      copy.companyId !== companyId ||
      !validRevision(copy.revision) || copy.revision < minimumRevision ||
      !copy.state || typeof copy.state !== 'object'
    ) return { kind: 'invalid', details: 'The storage authority returned an invalid company snapshot.' };
    const validation = readCompanyState(copy.state);
    if (validation.kind === 'invalid') return { kind: 'invalid', details: validation.reasons.join(' ') };
    if (loaded.pending !== undefined && !validPending(loaded.pending, companyId)) {
      return { kind: 'invalid', details: 'The storage authority returned an invalid pending attempt.' };
    }
    const loadedPending = loaded.pending && immutableCopy(loaded.pending);
    // A disappearing row is not evidence that our known attempt was fenced.
    // Keep it until resolve confirms a receipt or a durable fence; if a newer
    // reservation exists it will be discovered on the ensuing reload.
    const pending = this.durablePending && this.durablePending.companyId === companyId
      ? this.durablePending : loadedPending;
    const current = this.snapshot;
    if (current && current.companyId === companyId) {
      if (copy.revision < current.revision) return { kind: 'invalid', details: 'The loaded revision is older than the current snapshot.' };
      if (copy.revision === current.revision) {
        if (canonicalize(copy.state) !== canonicalize(current.state)) {
          return { kind: 'invalid', details: 'The same company revision contains different state.' };
        }
        this.durablePending = pending;
        return pending ? { kind: 'loaded', snapshot: current, pending } : { kind: 'loaded', snapshot: current };
      }
    }
    this.durablePending = pending;
    this.publish(copy);
    return pending ? { kind: 'loaded', snapshot: copy, pending } : { kind: 'loaded', snapshot: copy };
  }

  private publish(snapshot: CompanySnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      try { listener(); } catch { /* A subscriber cannot undo a confirmed commit. */ }
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
