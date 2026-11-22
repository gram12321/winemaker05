import type { CompanySnapshot, CompanySummary } from '../authority/contracts';
import { readCompanyState } from '../game/core/CompanyState';
import { readGameCommand, type GameCommand } from '../game/core/Commands';
import { companyScopeStorageKey, type CompanyScope } from '../shared/companyScope';
import { isGameId } from '../shared/identifiers';
import { isValidName } from '../shared/names';
import { withBrowserLock } from './browserLock';

type Result = Record<string, unknown> & { kind: string };
export interface PendingCommand { commandId: string; expectedRevision: number; command: GameCommand }
export type PendingCommandRecord =
  | { readonly kind: 'none' }
  | { readonly kind: 'valid'; readonly raw: string; readonly intent: PendingCommand }
  | { readonly kind: 'invalid'; readonly raw: string; readonly commandId?: string };

/** Keep an unreadable intent intact while recovering any independently valid ID. */
export function readPendingCommand(raw: string | null): PendingCommandRecord {
  if (raw === null) return { kind: 'none' };
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const commandId = isGameId(record.commandId) ? record.commandId : undefined;
      const command = readGameCommand(record.command);
      if (commandId && Number.isSafeInteger(record.expectedRevision) && (record.expectedRevision as number) >= 0 && command &&
          Object.keys(record).length === 3 && ['commandId', 'expectedRevision', 'command'].every(key => Object.hasOwn(record, key))) {
        return { kind: 'valid', raw, intent: { commandId, expectedRevision: record.expectedRevision as number, command } };
      }
      return { kind: 'invalid', raw, ...(commandId ? { commandId } : {}) };
    }
  } catch { /* Preserve malformed data rather than overwrite it. */ }
  return { kind: 'invalid', raw };
}
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
    if (pending && !isGameId(pending.commandId)) throw new Error('Invalid pending command.');
    return { snapshot, ...(pending ? { pendingId: pending.commandId as string } : {}) };
  }
  pendingRaw(companyId: string): string | null { return this.storage.getItem(this.key(companyId)); }
  private async withCommandLock<T>(companyId: string, action: () => Promise<T>): Promise<T> {
    return withBrowserLock(`winemaker05.command.${JSON.stringify([this.ownerKey, companyId])}`, action);
  }
  async prepareToSwitch(companyId: string): Promise<void> {
    return this.withCommandLock(companyId, async () => {
      if (readPendingCommand(this.pendingRaw(companyId)).kind === 'valid') throw new Error('Resolve the pending command first.');
      // Another service can have a reservation even when this browser's record
      // is unreadable. Confirm that no server-known attempt remains before leaving.
      const loaded = await this.load(companyId);
      if (loaded.pendingId || readPendingCommand(this.pendingRaw(companyId)).kind === 'valid') throw new Error('Resolve the pending command first.');
    });
  }
  async advance(snapshot: CompanySnapshot): Promise<void> {
    return this.dispatch(snapshot, { type: 'time.advance' });
  }
  async dispatch(snapshot: CompanySnapshot, input: GameCommand): Promise<void> {
    const command = readGameCommand(input);
    if (!command) throw new Error('Invalid gameplay command.');
    return this.withCommandLock(snapshot.companyId, async () => {
      const saved = readPendingCommand(this.pendingRaw(snapshot.companyId));
      if (saved.kind === 'invalid') throw new Error('A saved pending command is invalid. It has been preserved.');
      if (saved.kind === 'valid') throw new Error('Resolve the pending command first.');
      const pending: PendingCommand = { commandId: crypto.randomUUID(), expectedRevision: snapshot.revision, command };
      // Persist before sending; if storage fails, no command is sent.
      const raw = JSON.stringify(pending);
      this.storage.setItem(this.key(snapshot.companyId), raw);
      await this.send(snapshot.companyId, pending, raw);
    });
  }
  private async send(companyId: string, pending: PendingCommand, raw: string): Promise<void> {
    const result = await this.request(`/companies/${encodeURIComponent(companyId)}/commands`, pending);
    if (['committed', 'already-committed', 'rejected', 'conflict', 'failed', 'invalid-input'].includes(result.kind)) {
      if (this.pendingRaw(companyId) === raw) this.storage.removeItem(this.key(companyId));
      if (!['committed', 'already-committed'].includes(result.kind)) {
        const reasons = Array.isArray(result.reasons) && result.reasons.every(v => typeof v === 'string') ? result.reasons.join(' ') : '';
        throw new Error(reasons || `The action was not committed (${result.kind}). Reload the company.`);
      }
      return;
    }
    throw new Error('The command outcome is not yet known. Resolve it before continuing.');
  }
  async recover(companyId: string, serverPendingId?: string): Promise<void> {
    return this.withCommandLock(companyId, async () => {
      if (serverPendingId !== undefined && !isGameId(serverPendingId)) throw new Error('The server pending command ID is invalid.');
      const local = readPendingCommand(this.pendingRaw(companyId));
      const localId = local.kind === 'valid' ? local.intent.commandId : local.kind === 'invalid' ? local.commandId : undefined;
      const id = serverPendingId ?? localId;
      if (!id) {
        if (local.kind === 'invalid') throw new Error('A saved pending command is invalid. It has been preserved.');
        return;
      }
      const result = await this.request(`/companies/${encodeURIComponent(companyId)}/resolve`, { commandId: id });
      if (result.kind === 'committed' || result.kind === 'not-committed') {
        if (local.kind !== 'none' && localId === id && this.pendingRaw(companyId) === local.raw) this.storage.removeItem(this.key(companyId));
        return;
      }
      if (result.kind === 'pending' && result.retry === 'original-command' && local.kind === 'valid' && localId === id) return this.send(companyId, local.intent, local.raw);
      if (result.kind === 'pending' && result.retry === 'original-command' && local.kind === 'invalid' && localId === id) {
        throw new Error('The saved command is unreadable and cannot be replayed. It has been preserved.');
      }
      throw new Error('A command is still unresolved. Retry recovery before advancing time.');
    });
  }
  hasPending(companyId: string): boolean { return this.pendingRaw(companyId) !== null; }

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
