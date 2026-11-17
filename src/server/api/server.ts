import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { CompanySession, type CompanySavePort, type DispatchResult, type LoadResult, type ResolutionResult, type SwitchResult } from '../../authority';
import { createCompanyState, type CompanyState, type GameCommand, type NewCompanyInput } from '../../game/core';
import type { Authenticate } from './auth';

const MAX_BODY_BYTES = 16 * 1024;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface CompanyStore extends CompanySavePort {
  listCompanies(): Promise<{ readonly kind: 'listed'; readonly companyIds: readonly string[] } | { readonly kind: 'unavailable' }>;
  createCompany(input: { readonly companyId: string; readonly state: CompanyState }): Promise<
    | { readonly kind: 'created' }
    | { readonly kind: 'not-created' }
    | { readonly kind: 'invalid'; readonly details: string }
    | { readonly kind: 'unknown' }
  >;
}

export interface ApiOptions {
  readonly authenticate: Authenticate;
  /** The trusted verified subject is the only source of this ownership binding. */
  readonly storeForOwner: (ownerId: string) => CompanyStore;
  /** Trusted, explicitly selected calendar rules and date for a new company. */
  readonly newCompany: NewCompanyInput;
}

interface SessionEntry {
  readonly session: CompanySession;
  tail: Promise<void>;
}

type PublicResponse = { readonly status: number; readonly body: object };

function reply(response: ServerResponse, result: PublicResponse): void {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(result.body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function readCommand(value: unknown): GameCommand | null {
  if (!isRecord(value) || !exactKeys(value, ['type']) || value.type !== 'time.advance') return null;
  return { type: 'time.advance' };
}

type ParsedBody = { readonly kind: 'parsed'; readonly value: unknown } | { readonly kind: 'invalid' | 'too-large' };

/** Bound memory while reading even when content-length is missing or false. */
async function readBody(request: IncomingMessage): Promise<ParsedBody> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    request.resume();
    return { kind: 'invalid' };
  }
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    request.resume();
    return { kind: 'too-large' };
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let finished = false;
    const finish = (result: ParsedBody) => {
      if (finished) return;
      finished = true;
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onError);
      resolve(result);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        finish({ kind: 'too-large' });
        request.resume();
      } else chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        finish({ kind: 'parsed', value: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown });
      } catch {
        finish({ kind: 'invalid' });
      }
    };
    const onError = () => finish({ kind: 'invalid' });
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('aborted', onError);
  });
}

function publicLoad(result: LoadResult | SwitchResult): PublicResponse {
  switch (result.kind) {
    case 'loaded': return {
      status: 200,
      body: { kind: 'loaded', snapshot: result.snapshot, ...(result.pending ? { pending: { commandId: result.pending.commandId } } : {}) },
    };
    case 'missing': return { status: 404, body: { kind: 'missing' } };
    case 'invalid': return { status: 422, body: { kind: 'invalid', details: 'The company save is invalid.' } };
    case 'unsupported': return { status: 422, body: { kind: 'unsupported', version: result.version } };
    case 'unavailable': return { status: 503, body: { kind: 'unavailable' } };
    case 'blocked': return { status: 409, body: result };
  }
}

function safeLoadFailure(load: Exclude<LoadResult, { kind: 'loaded' }>): object {
  return publicLoad(load).body;
}

function publicDispatch(result: DispatchResult, pendingCommandId?: string): PublicResponse {
  switch (result.kind) {
    case 'committed':
    case 'already-committed': return { status: 200, body: result };
    case 'rejected': return { status: 422, body: result };
    case 'conflict': return { status: 409, body: { kind: result.kind, currentRevision: result.currentRevision, ...(result.reload ? { reload: safeLoadFailure(result.reload) } : {}) } };
    case 'command-id-mismatch': return { status: 409, body: result };
    case 'blocked': return { status: 409, body: { ...result, ...(result.reason === 'unresolved' && pendingCommandId ? { pending: { commandId: pendingCommandId } } : {}) } };
    case 'sync-required': return { status: 409, body: { kind: result.kind, commandId: result.commandId, load: safeLoadFailure(result.load) } };
    case 'unknown': return { status: 202, body: result };
    case 'inactive-company': return { status: 404, body: { kind: 'missing' } };
    case 'invalid-input': return { status: 400, body: { kind: 'invalid-input' } };
    case 'failed': return { status: 503, body: { kind: 'failed' } };
    case 'unavailable': return { status: 503, body: { kind: 'unavailable' } };
  }
}

function publicResolution(result: ResolutionResult): PublicResponse {
  switch (result.kind) {
    case 'committed':
    case 'not-committed': return { status: 200, body: result };
    case 'command-id-mismatch': return { status: 409, body: { kind: result.kind, ...(result.reload ? { reload: safeLoadFailure(result.reload) } : {}) } };
    case 'pending':
    // A missing in-memory session is not evidence of rollback.
    case 'nothing-to-resolve': return { status: 202, body: { kind: 'pending' } };
    case 'sync-required': return { status: 409, body: { kind: result.kind, commandId: result.commandId, load: safeLoadFailure(result.load) } };
    case 'unavailable':
    case 'invalid-receipt': return { status: 503, body: { kind: 'unavailable' } };
  }
}

function badRequest(): PublicResponse {
  return { status: 400, body: { kind: 'invalid-input' } };
}

/**
 * Minimal trusted HTTP host. The save provider supplies durable pending
 * reservations; local sessions retain uncertainty that has not been persisted.
 */
export function createApiServer(options: ApiOptions): Server {
  const initial = createCompanyState(options.newCompany);
  if (initial.kind !== 'created') throw new Error('Invalid company startup configuration.');
  const initialState = initial.state;
  const entries = new Map<string, SessionEntry>();

  function getEntry(ownerId: string, companyId: string, store: CompanyStore): SessionEntry {
    const key = JSON.stringify([ownerId, companyId]);
    let entry = entries.get(key);
    if (!entry) {
      entry = { session: new CompanySession(store, randomUUID), tail: Promise.resolve() };
      entries.set(key, entry);
    }
    return entry;
  }

  function enqueue<T>(entry: SessionEntry, run: () => Promise<T>): Promise<T> {
    const result = entry.tail.then(run);
    entry.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function handle(request: IncomingMessage): Promise<PublicResponse> {
    let ownerId: string | null;
    try {
      ownerId = await options.authenticate(request.headers.authorization);
    } catch {
      request.resume();
      return { status: 503, body: { kind: 'unavailable' } };
    }
    if (typeof ownerId !== 'string' || ownerId.length === 0) {
      request.resume();
      return { status: 401, body: { kind: 'unauthorized' } };
    }

    const url = new URL(request.url ?? '/', 'http://authority.invalid');
    const store = options.storeForOwner(ownerId);
    if (request.method === 'GET' && url.pathname === '/companies') {
      const result = await store.listCompanies();
      return result.kind === 'listed' ? { status: 200, body: result } : { status: 503, body: result };
    }
    if (request.method === 'POST' && url.pathname === '/companies') {
      const body = await readBody(request);
      if (body.kind === 'too-large') return { status: 413, body: { kind: 'too-large' } };
      if (body.kind !== 'parsed' || !isRecord(body.value) || !exactKeys(body.value, ['companyId']) || !validId(body.value.companyId)) return badRequest();
      try {
        const result = await store.createCompany({ companyId: body.value.companyId, state: initialState });
        switch (result.kind) {
          case 'created': return { status: 201, body: { kind: 'created' } };
          case 'not-created': return { status: 409, body: { kind: 'not-created' } };
          case 'invalid': return { status: 422, body: { kind: 'invalid' } };
          case 'unknown': return { status: 202, body: { kind: 'unknown' } };
        }
      } catch {
        // A failed connection may have lost the response to a committed creation.
        return { status: 202, body: { kind: 'unknown' } };
      }
    }

    const route = /^\/companies\/([^/]+)(?:\/(commands|resolve))?$/.exec(url.pathname);
    if (!route) return { status: 404, body: { kind: 'missing' } };
    let companyId: string;
    try { companyId = decodeURIComponent(route[1]); } catch { return badRequest(); }
    if (!validId(companyId)) return badRequest();
    const action = route[2];
    if (!((request.method === 'GET' && !action) || (request.method === 'POST' && (action === 'commands' || action === 'resolve')))) {
      return { status: 404, body: { kind: 'missing' } };
    }

    let value: Record<string, unknown> | undefined;
    let command: GameCommand | null = null;
    if (request.method === 'POST') {
      const body = await readBody(request);
      if (body.kind === 'too-large') return { status: 413, body: { kind: 'too-large' } };
      if (body.kind !== 'parsed' || !isRecord(body.value)) return badRequest();
      value = body.value;
      const keys = action === 'commands' ? ['commandId', 'expectedRevision', 'command'] : ['commandId'];
      if (!exactKeys(value, keys) || !validId(value.commandId)) return badRequest();
      if (action === 'commands') {
        command = readCommand(value.command);
        if (!command || typeof value.expectedRevision !== 'number' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) return badRequest();
      }
    }

    // Enforce ownership using a fresh owner-bound store on every operation,
    // including resolution and accesses to an existing in-memory session.
    const access = await store.load(companyId);
    if (access.kind !== 'loaded') return publicLoad(access);

    const key = JSON.stringify([ownerId, companyId]);
    const existing = entries.get(key);
    const entry = existing ?? getEntry(ownerId, companyId, store);
    return enqueue(entry, async () => {
      // Sessions holding an unresolved operation cannot switch, even to the
      // same company. Otherwise reload here so this instance discovers a
      // reservation made by another instance before handling the request.
      if (!entry.session.getUnresolvedCommand()) {
        let loaded = await entry.session.switchCompany(companyId);
        if (loaded.kind === 'blocked' && loaded.reason === 'sync-required') loaded = await entry.session.refresh();
        if (loaded.kind !== 'loaded') return publicLoad(loaded);
      }

      const unresolved = entry.session.getUnresolvedCommand();
      if (action === 'resolve') {
        if (!unresolved) {
          // A receipt proves success; its absence alone never proves rollback.
          const receipt = await store.getReceipt(companyId, value!.commandId as string);
          if (receipt.kind === 'unavailable') return { status: 503, body: { kind: 'unavailable' } };
          if (receipt.kind === 'absent') return { status: 202, body: { kind: 'pending', retry: 'original-command' } };
          const saved = receipt.receipt;
          const snapshot = entry.session.getSnapshot();
          if (
            saved.companyId !== companyId || saved.commandId !== value!.commandId ||
            typeof saved.fingerprint !== 'string' || saved.fingerprint.length === 0 ||
            !Number.isSafeInteger(saved.revision) || saved.revision < 1 ||
            !snapshot || snapshot.revision < saved.revision
          ) return { status: 503, body: { kind: 'unavailable' } };
          return { status: 200, body: { kind: 'committed', revision: saved.revision } };
        }
        if (unresolved.commandId !== value!.commandId) return badRequest();
        const result = await entry.session.resolve();
        return publicResolution(result);
      }

      if (!action) {
        const snapshot = entry.session.getSnapshot();
        if (!snapshot) return { status: 503, body: { kind: 'unavailable' } };
        return { status: 200, body: { kind: 'loaded', snapshot, ...(unresolved ? { pending: { commandId: unresolved.commandId } } : {}) } };
      }

      const commandId = value!.commandId as string;
      const result = await entry.session.dispatch({ companyId, commandId, expectedRevision: value!.expectedRevision as number, command: command! });
      return publicDispatch(result, entry.session.getUnresolvedCommand()?.commandId);
    });
  }

  const server = createServer((request, response) => {
    void handle(request).then((result) => reply(response, result)).catch(() => {
      reply(response, { status: 503, body: { kind: 'unavailable' } });
    });
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  return server;
}
