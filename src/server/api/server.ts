import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { CompanyStore, DispatchResult, LoadResult, ResolutionResult, SwitchResult } from '../../authority';
import { createCompanyState, type GameCommand, type NewCompanyInput } from '../../game/core';
import { companyOwnerId, type CompanyScope } from '../../shared/companyScope';
import { isGameId, isPlayerId } from '../../shared/identifiers';
import { isValidName } from '../../shared/names';
import { CompanySessions } from '../companySessions';
import type { PlayerProfileStore } from '../playerProfiles';

const MAX_BODY_BYTES = 16 * 1024;

export interface ApiOptions {
  /** Bind every operation to its selected player or unassigned scope. */
  readonly storeForOwner: (ownerId: string) => CompanyStore;
  readonly playerProfiles: PlayerProfileStore;
  /** Trusted, explicitly selected calendar rules and date for a new company. */
  readonly newCompany: NewCompanyInput;
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
 * Requests use a selected database profile or the shared unassigned-company
 * scope. Selectable profiles and unassigned
 * companies intentionally have no password barrier, matching 04.
 */
export function createApiServer(options: ApiOptions): Server {
  const initial = createCompanyState(options.newCompany);
  if (initial.kind !== 'created') throw new Error('Invalid company startup configuration.');
  const initialState = initial.state;
  const sessions = new CompanySessions();

  async function handle(request: IncomingMessage): Promise<PublicResponse> {
    const url = new URL(request.url ?? '/', 'http://authority.invalid');
    if (url.pathname === '/players' && request.method === 'GET') {
      try { return { status: 200, body: { kind: 'players-listed', players: await options.playerProfiles.list() } }; }
      catch { return { status: 503, body: { kind: 'unavailable' } }; }
    }
    if (url.pathname === '/players' && request.method === 'POST') {
      const body = await readBody(request);
      if (body.kind === 'too-large') return { status: 413, body: { kind: 'too-large' } };
      if (body.kind !== 'parsed' || !isRecord(body.value) || !exactKeys(body.value, ['id', 'name']) || !isPlayerId(body.value.id) || !isValidName(body.value.name)) return badRequest();
      try {
        const player = await options.playerProfiles.create({ id: body.value.id.toLowerCase(), name: body.value.name });
        return player ? { status: 201, body: { kind: 'player-created', player } } : { status: 409, body: { kind: 'not-created' } };
      } catch { return { status: 503, body: { kind: 'unavailable' } }; }
    }
    const profileRoute = /^\/players\/([^/]+)$/.exec(url.pathname);
    if (profileRoute && request.method === 'PATCH') {
      if (!isPlayerId(profileRoute[1])) return badRequest();
      const body = await readBody(request);
      if (body.kind === 'too-large') return { status: 413, body: { kind: 'too-large' } };
      if (body.kind !== 'parsed' || !isRecord(body.value) || !exactKeys(body.value, ['name']) || !isValidName(body.value.name)) return badRequest();
      try {
        const player = await options.playerProfiles.rename({ id: profileRoute[1], name: body.value.name });
        return player ? { status: 200, body: { kind: 'player-updated', player } } : { status: 404, body: { kind: 'missing' } };
      } catch { return { status: 503, body: { kind: 'unavailable' } }; }
    }
    const playerId = request.headers['x-winemaker-player-id'];
    const unassigned = request.headers['x-winemaker-unassigned'];
    if (playerId !== undefined && unassigned !== undefined) {
      request.resume();
      return badRequest();
    }
    let scope: CompanyScope | undefined;
    if (isPlayerId(playerId)) {
      try {
        if (await options.playerProfiles.get(playerId)) scope = { kind: 'player', playerId };
      } catch {
        request.resume();
        return { status: 503, body: { kind: 'unavailable' } };
      }
    } else if (playerId === undefined && unassigned === '1') {
      scope = { kind: 'unassigned' };
    }
    if (!scope) {
      request.resume();
      return { status: 401, body: { kind: 'unauthorized' } };
    }

    const ownerId = companyOwnerId(scope);
    const store = options.storeForOwner(ownerId);
    if (request.method === 'GET' && url.pathname === '/companies') {
      const result = await store.listCompanies();
      return result.kind === 'listed' ? { status: 200, body: result } : { status: 503, body: result };
    }
    if (request.method === 'POST' && url.pathname === '/companies') {
      const body = await readBody(request);
      if (body.kind === 'too-large') return { status: 413, body: { kind: 'too-large' } };
      if (body.kind !== 'parsed' || !isRecord(body.value) || !exactKeys(body.value, ['companyId', 'name']) || !isGameId(body.value.companyId) || !isValidName(body.value.name)) return badRequest();
      try {
        const result = await store.createCompany({ companyId: body.value.companyId, name: body.value.name, state: initialState });
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
    if (!isGameId(companyId)) return badRequest();
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
      if (!exactKeys(value, keys) || !isGameId(value.commandId)) return badRequest();
      if (action === 'commands') {
        command = readCommand(value.command);
        if (!command || typeof value.expectedRevision !== 'number' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) return badRequest();
      }
    }

    // Enforce ownership using a fresh owner-bound store on every operation,
    // including resolution and accesses to an existing in-memory session.
    const access = await store.load(companyId);
    if (access.kind !== 'loaded') return publicLoad(access);

    return sessions.run(ownerId, companyId, store, async (session) => {
      // Sessions holding an unresolved operation cannot switch, even to the
      // same company. Otherwise reload here so this instance discovers a
      // reservation made by another instance before handling the request.
      if (!session.getUnresolvedCommand()) {
        let loaded = await session.switchCompany(companyId);
        if (loaded.kind === 'blocked' && loaded.reason === 'sync-required') loaded = await session.refresh();
        if (loaded.kind !== 'loaded') return publicLoad(loaded);
      }

      const unresolved = session.getUnresolvedCommand();
      if (action === 'resolve') {
        if (!unresolved) {
          // A receipt proves success; its absence alone never proves rollback.
          const receipt = await store.getReceipt(companyId, value!.commandId as string);
          if (receipt.kind === 'unavailable') return { status: 503, body: { kind: 'unavailable' } };
          if (receipt.kind === 'absent') return { status: 202, body: { kind: 'pending', retry: 'original-command' } };
          const saved = receipt.receipt;
          const snapshot = session.getSnapshot();
          if (
            saved.companyId !== companyId || saved.commandId !== value!.commandId ||
            typeof saved.fingerprint !== 'string' || saved.fingerprint.length === 0 ||
            !Number.isSafeInteger(saved.revision) || saved.revision < 1 ||
            !snapshot || snapshot.revision < saved.revision
          ) return { status: 503, body: { kind: 'unavailable' } };
          return { status: 200, body: { kind: 'committed', revision: saved.revision } };
        }
        if (unresolved.commandId !== value!.commandId) return badRequest();
        const result = await session.resolve();
        return publicResolution(result);
      }

      if (!action) {
        const snapshot = session.getSnapshot();
        if (!snapshot) return { status: 503, body: { kind: 'unavailable' } };
        return { status: 200, body: { kind: 'loaded', snapshot, ...(unresolved ? { pending: { commandId: unresolved.commandId } } : {}) } };
      }

      const commandId = value!.commandId as string;
      const result = await session.dispatch({ companyId, commandId, expectedRevision: value!.expectedRevision as number, command: command! });
      return publicDispatch(result, session.getUnresolvedCommand()?.commandId);
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
