// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyClient } from '../../src/client/CompanyClient';
import type { CompanySnapshot } from '../../src/authority/contracts';

const snapshot: CompanySnapshot = { companyId: 'company', revision: 0, state: { calendar: { rules: { weeksPerSeason: 3, seasonsPerYear: 4 }, date: { year: 1, season: 1, week: 1 } } } };
beforeEach(() => {
  const held = new Set<string>();
  vi.stubGlobal('navigator', { locks: {
    async request<T>(name: string, _options: unknown, callback: (lock: object | null) => Promise<T> | T): Promise<T> {
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name }); } finally { held.delete(name); }
    },
  } });
});
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
function reply(value: object) { return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }); }

describe('company creation recovery', () => {
  it('retries the same creation after a lost response and confirms its scope and name', async () => {
    const attempts: { companyId: string; name: string }[] = [];
    const fetcher = vi.fn(async (path: string, options: RequestInit) => {
      expect(options.headers).toMatchObject({ 'x-winemaker-player-id': 'owner' });
      if (path === '/api/companies' && options.method === 'POST') {
        attempts.push(JSON.parse(options.body as string));
        if (attempts.length === 1) throw new Error('response lost');
        return reply({ kind: 'not-created' });
      }
      if (path === '/api/companies') return reply({ kind: 'listed', companies: [{ id: attempts[0].companyId, name: attempts[0].name, date: null }] });
      return reply({ kind: 'loaded', snapshot: { ...snapshot, companyId: attempts[0].companyId } });
    });
    vi.stubGlobal('fetch', fetcher);
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.create('Winery')).rejects.toThrow('response lost');
    expect(client.getPendingCreation()).toMatchObject({ kind: 'pending', name: 'Winery' });
    const loaded = await client.create('another name');
    expect(attempts[1]).toEqual(attempts[0]);
    expect(loaded.snapshot.companyId).toBe(attempts[0].companyId);
    expect(client.getPendingCreation()).toEqual({ kind: 'none' });
  });

  it('does not mistake a different company with the same ID for a recovered creation', async () => {
    localStorage.setItem('winemaker05.creation.player-owner', JSON.stringify({ id: 'collision', name: 'Winery' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ kind: 'not-created' }))
      .mockResolvedValueOnce(reply({ kind: 'listed', companies: [{ id: 'collision', name: 'Other', date: null }] })));
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.create('')).rejects.toThrow('conflicts with an existing company');
    expect(client.getPendingCreation()).toEqual({ kind: 'none' });
  });

  it('preserves malformed creation records until explicitly discarded', async () => {
    const key = 'winemaker05.creation.unassigned';
    localStorage.setItem(key, '{invalid');
    const client = new CompanyClient({ kind: 'unassigned' });
    expect(client.getPendingCreation()).toEqual({ kind: 'invalid' });
    await expect(client.create('Winery')).rejects.toThrow('saved company request is invalid');
    expect(localStorage.getItem(key)).toBe('{invalid');
    await client.discardInvalidCreation();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('prevents two tabs from overwriting the same creation intent', async () => {
    let otherAttempt: Promise<unknown> | undefined;
    let interleave = true;
    const storage: Storage = {
      get length() { return localStorage.length; },
      clear: () => localStorage.clear(),
      key: (index) => localStorage.key(index),
      getItem: (key) => {
        const previous = localStorage.getItem(key);
        if (interleave) { interleave = false; otherAttempt = second.create('Other'); void otherAttempt.catch(() => undefined); }
        return previous;
      },
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('response lost')));
    const first = new CompanyClient({ kind: 'unassigned' }, storage);
    const second = new CompanyClient({ kind: 'unassigned' }, storage);
    await expect(first.create('First')).rejects.toThrow('response lost');
    await expect(otherAttempt).rejects.toThrow('Another tab');
    expect(first.getPendingCreation()).toMatchObject({ kind: 'pending', name: 'First' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('company client command recovery', () => {
  it('retains an uncertain command and retries its original ID and revision after a lost response', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network lost')).mockResolvedValueOnce(reply({ kind: 'pending', retry: 'original-command' })).mockResolvedValueOnce(reply({ kind: 'already-committed', revision: 1 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.advance(snapshot)).rejects.toThrow();
    expect(client.hasPending('company')).toBe(true);
    await client.recover('company');
    expect(client.hasPending('company')).toBe(false);
    const original = JSON.parse(fetcher.mock.calls[0][1].body);
    const retry = JSON.parse(fetcher.mock.calls[2][1].body);
    expect(retry).toEqual(original);
    expect(original.expectedRevision).toBe(0);
  });
  it('blocks writes and preserves malformed pending data for recovery', async () => {
    const key = 'winemaker05.pending.player-owner.company';
    localStorage.setItem(key, '{invalid');
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    expect(client.hasPending('company')).toBe(true);
    await expect(client.recover('company')).rejects.toThrow('saved pending command is invalid');
    await expect(client.advance(snapshot)).rejects.toThrow('saved pending command is invalid');
    expect(localStorage.getItem(key)).toBe('{invalid');
  });
  it('blocks new commands while another attempt remains unresolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ kind: 'unknown' })));
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.advance(snapshot)).rejects.toThrow();
    await expect(client.advance(snapshot)).rejects.toThrow('Resolve the pending command first');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not discard a local intent when resolving a different device command', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(reply({ kind: 'not-committed' })));
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.advance(snapshot)).rejects.toThrow();
    await client.recover('company', 'other-command');
    expect(client.hasPending('company')).toBe(true);
  });
  it('keeps simultaneous tabs from overwriting an uncertain command intent', async () => {
    const fetcher = vi.fn().mockImplementation(async () => reply({ kind: 'unknown' }));
    vi.stubGlobal('fetch', fetcher);
    let otherAttempt: Promise<void> | undefined;
    let interleave = true;
    const storage: Storage = {
      get length() { return localStorage.length; },
      clear: () => localStorage.clear(),
      key: (index) => localStorage.key(index),
      getItem: (key) => {
        const previous = localStorage.getItem(key);
        if (interleave) {
          interleave = false;
          otherAttempt = second.advance(snapshot);
          void otherAttempt.catch(() => undefined);
        }
        return previous;
      },
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    };
    const first = new CompanyClient({ kind: 'player', playerId: 'owner' }, storage);
    const second = new CompanyClient({ kind: 'player', playerId: 'owner' }, storage);

    const firstAttempt = first.advance(snapshot);
    await expect(firstAttempt).rejects.toThrow('outcome is not yet known');
    expect(otherAttempt).toBeDefined();
    await expect(otherAttempt).rejects.toThrow('Another tab');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(localStorage.getItem('winemaker05.pending.player-owner.company')!).commandId).toBe(sent.commandId);
  });
  it('does not send a command when cross-tab locking is unavailable', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('navigator', {});
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });

    await expect(client.advance(snapshot)).rejects.toThrow('cross-tab');
    expect(fetcher).not.toHaveBeenCalled();
    expect(client.hasPending('company')).toBe(false);
  });
  it('refuses to leave a company with a retained command', async () => {
    localStorage.setItem('winemaker05.pending.player-owner.company', JSON.stringify({ commandId: 'pending', expectedRevision: 0, command: { type: 'time.advance' } }));
    const client = new CompanyClient({ kind: 'player', playerId: 'owner' });
    await expect(client.prepareToSwitch('company')).rejects.toThrow('Resolve the pending command first');
  });
});
