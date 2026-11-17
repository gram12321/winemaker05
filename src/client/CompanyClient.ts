import type { CompanySnapshot } from '../authority/contracts';
import { readCompanyState } from '../game/core';

type Result = Record<string, unknown> & { kind: string };
export interface PendingCommand { commandId: string; expectedRevision: number; command: { type: 'time.advance' } }

export class CompanyClient {
  constructor(private readonly token: () => Promise<string>, private readonly ownerId: string, private readonly storage: Storage = localStorage) {}
  private key(companyId: string) { return `winemaker05.pending.${this.ownerId}.${companyId}`; }
  private async request(path: string, body?: unknown): Promise<Result> {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${await this.token()}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('kind' in value) || typeof value.kind !== 'string') throw new Error('Invalid response from the company service.');
    return value as Result;
  }
  async list(): Promise<string[]> {
    const result = await this.request('/companies');
    if (result.kind !== 'listed' || !Array.isArray(result.companyIds) || !result.companyIds.every((id: unknown) => typeof id === 'string')) throw new Error('Could not load companies.');
    return result.companyIds;
  }
  async create(companyId: string): Promise<void> {
    const result = await this.request('/companies', { companyId });
    if (result.kind !== 'created' && result.kind !== 'not-created' && result.kind !== 'unknown') throw new Error('Could not create the company.');
    // Loading the owner-scoped ID confirms creation even after a lost response.
    await this.load(companyId);
  }
  async load(companyId: string): Promise<{ snapshot: CompanySnapshot; pendingId?: string }> {
    const result = await this.request(`/companies/${encodeURIComponent(companyId)}`);
    const snapshot = result.snapshot as CompanySnapshot | undefined;
    if (result.kind !== 'loaded' || !snapshot || snapshot.companyId !== companyId || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || readCompanyState(snapshot.state).kind !== 'valid') throw new Error(`Company could not be loaded (${result.kind}).`);
    const pending = result.pending as { commandId?: unknown } | undefined;
    if (pending && typeof pending.commandId !== 'string') throw new Error('Invalid pending command.');
    return { snapshot, ...(pending ? { pendingId: pending.commandId as string } : {}) };
  }
  private pending(companyId: string): PendingCommand | null {
    const raw = this.storage.getItem(this.key(companyId));
    if (!raw) return null;
    try {
      const p: unknown = JSON.parse(raw);
      if (p && typeof p === 'object' && 'commandId' in p && typeof p.commandId === 'string' && 'expectedRevision' in p && Number.isSafeInteger(p.expectedRevision) && 'command' in p && JSON.stringify(p.command) === '{"type":"time.advance"}') return p as PendingCommand;
    } catch { /* Preserve malformed records for recovery rather than overwrite them. */ }
    throw new Error('A saved pending command is invalid. It has been preserved.');
  }
  async advance(snapshot: CompanySnapshot): Promise<void> {
    if (this.pending(snapshot.companyId)) throw new Error('Resolve the pending command first.');
    const pending: PendingCommand = { commandId: crypto.randomUUID(), expectedRevision: snapshot.revision, command: { type: 'time.advance' } };
    // Persist before sending; if storage fails, no command is sent.
    this.storage.setItem(this.key(snapshot.companyId), JSON.stringify(pending));
    await this.send(snapshot.companyId, pending);
  }
  private async send(companyId: string, pending: PendingCommand): Promise<void> {
    const result = await this.request(`/companies/${encodeURIComponent(companyId)}/commands`, pending);
    if (['committed', 'already-committed', 'rejected', 'conflict', 'failed', 'invalid-input'].includes(result.kind)) {
      this.storage.removeItem(this.key(companyId));
      if (!['committed', 'already-committed'].includes(result.kind)) throw new Error(`Time was not advanced (${result.kind}). Reload the company.`);
      return;
    }
    throw new Error('The command outcome is not yet known. Resolve it before continuing.');
  }
  async recover(companyId: string, serverPendingId?: string): Promise<void> {
    const local = this.pending(companyId);
    const id = serverPendingId ?? local?.commandId;
    if (!id) return;
    const result = await this.request(`/companies/${encodeURIComponent(companyId)}/resolve`, { commandId: id });
    if (result.kind === 'committed' || result.kind === 'not-committed') {
      if (local?.commandId === id) this.storage.removeItem(this.key(companyId));
      return;
    }
    if (result.kind === 'pending' && result.retry === 'original-command' && local?.commandId === id) return this.send(companyId, local);
    throw new Error('A command is still unresolved. Retry recovery before advancing time.');
  }
  // A malformed record still blocks writes and can be reported by recover().
  hasPending(companyId: string): boolean { return this.storage.getItem(this.key(companyId)) !== null; }
}
