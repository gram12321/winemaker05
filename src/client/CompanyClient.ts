import type { CompanySnapshot, CompanySummary } from '../authority/contracts';
import { readCompanyState } from '../game/core';
import { companyScopeStorageKey, type CompanyScope } from '../shared/companyScope';
import { isGameId } from '../shared/identifiers';
import { isValidName } from '../shared/names';
import { withBrowserLock } from './browserLock';

type Result = Record<string, unknown> & { kind: string };
export interface PendingCommand { commandId: string; expectedRevision: number; command: { type: 'time.advance' } }
export type { CompanySummary } from '../authority/contracts';
export type PendingCreation =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending'; readonly id: string; readonly name: string }
  | { readonly kind: 'invalid' };

export class CompanyClient {
  private readonly scope: CompanyScope;
  private readonly ownerKey: string;

  constructor(scope: CompanyScope, private readonly storage: Storage = localStorage) {
    this.scope = scope.kind === 'player' ? { kind: 'player', playerId: scope.playerId.toLowerCase() } : { kind: 'unassigned' };
    this.ownerKey = companyScopeStorageKey(this.scope);
  }
  private key(companyId: string) { return `winemaker05.pending.${this.ownerKey}.${companyId}`; }
  private get creationKey() { return `winemaker05.creation.${this.ownerKey}`; }
  private async request(path: string, body?: unknown): Promise<Result> {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(this.scope.kind === 'unassigned' ? { 'x-winemaker-unassigned': '1' } : { 'x-winemaker-player-id': this.scope.playerId }), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('kind' in value) || typeof value.kind !== 'string') throw new Error('Invalid response from the company service.');
    return value as Result;
  }
  async list(): Promise<CompanySummary[]> {
    const result = await this.request('/companies');
    if (result.kind !== 'listed' || !Array.isArray(result.companies) || !result.companies.every((company: CompanySummary) => company && typeof company.id === 'string' && typeof company.name === 'string' && (company.date === null || (company.date && Number.isSafeInteger(company.date.year) && Number.isSafeInteger(company.date.season) && Number.isSafeInteger(company.date.week))))) throw new Error('Could not load companies.');
    return result.companies;
  }
  getPendingCreation(): PendingCreation {
    const raw = this.storage.getItem(this.creationKey);
    if (raw === null) return { kind: 'none' };
    try {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object' && 'id' in value && isGameId(value.id) &&
          'name' in value && isValidName(value.name)) {
        return { kind: 'pending', id: value.id, name: value.name };
      }
    } catch { /* Keep an invalid record until the player explicitly discards it. */ }
    return { kind: 'invalid' };
  }
  async discardInvalidCreation(): Promise<void> {
    await withBrowserLock(`winemaker05.creation.${this.ownerKey}`, async () => {
      if (this.getPendingCreation().kind !== 'invalid') throw new Error('The saved company request changed. Refresh and try again.');
      this.storage.removeItem(this.creationKey);
    });
  }
  async create(name: string): Promise<{ snapshot: CompanySnapshot; pendingId?: string }> {
    return withBrowserLock(`winemaker05.creation.${this.ownerKey}`, async () => {
      const saved = this.getPendingCreation();
      if (saved.kind === 'invalid') throw new Error('The saved company request is invalid. Discard it before creating a company.');
      const intent = saved.kind === 'pending' ? saved : { kind: 'pending' as const, id: crypto.randomUUID(), name: name.trim() };
      if (!isValidName(intent.name)) throw new Error('Enter a company name.');
      this.storage.setItem(this.creationKey, JSON.stringify({ id: intent.id, name: intent.name }));
      const result = await this.request('/companies', { companyId: intent.id, name: intent.name });
      if (result.kind !== 'created' && result.kind !== 'not-created' && result.kind !== 'unknown') throw new Error('Could not create the company.');
      if (result.kind !== 'created') {
        const companies = await this.list();
        if (!companies.some(company => company.id === intent.id && company.name === intent.name)) {
          if (result.kind === 'not-created') {
            this.storage.removeItem(this.creationKey);
            throw new Error('The saved request conflicts with an existing company. Select it or create a new company.');
          }
          throw new Error('The company creation could not yet be confirmed. Retry the saved request.');
        }
      }
      const loaded = await this.load(intent.id);
      this.storage.removeItem(this.creationKey);
      return loaded;
    });
  }
  async load(companyId: string): Promise<{ snapshot: CompanySnapshot; pendingId?: string }> {
    const result = await this.request(`/companies/${encodeURIComponent(companyId)}`);
    const snapshot = result.snapshot as CompanySnapshot | undefined;
    if (result.kind !== 'loaded' || !snapshot || snapshot.companyId !== companyId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || readCompanyState(snapshot.state).kind !== 'valid') throw new Error(`Company could not be loaded (${result.kind}).`);
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
  private async withCommandLock<T>(companyId: string, action: () => Promise<T>): Promise<T> {
    return withBrowserLock(`winemaker05.command.${JSON.stringify([this.ownerKey, companyId])}`, action);
  }
  async prepareToSwitch(companyId: string): Promise<void> {
    return this.withCommandLock(companyId, async () => {
      if (this.hasPending(companyId)) throw new Error('Resolve the pending command first.');
    });
  }
  async advance(snapshot: CompanySnapshot): Promise<void> {
    return this.withCommandLock(snapshot.companyId, async () => {
      if (this.pending(snapshot.companyId)) throw new Error('Resolve the pending command first.');
      const pending: PendingCommand = { commandId: crypto.randomUUID(), expectedRevision: snapshot.revision, command: { type: 'time.advance' } };
      // Persist before sending; if storage fails, no command is sent.
      this.storage.setItem(this.key(snapshot.companyId), JSON.stringify(pending));
      await this.send(snapshot.companyId, pending);
    });
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
    return this.withCommandLock(companyId, async () => {
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
    });
  }
  // A malformed record still blocks writes and can be reported by recover().
  hasPending(companyId: string): boolean { return this.storage.getItem(this.key(companyId)) !== null; }

  /** Other tabs sharing this storage may start or settle a command. */
  subscribePending(companyId: string, onChange: (cleared: boolean) => void): () => void {
    const key = this.key(companyId);
    const changed = (event: StorageEvent) => {
      if (event.storageArea === this.storage && (event.key === key || event.key === null)) {
        onChange(event.key === null || event.newValue === null);
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }
}
