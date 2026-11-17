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

describe('company client command recovery', () => {
  it('retains an uncertain command and retries its original ID and revision after a lost response', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network lost')).mockResolvedValueOnce(reply({ kind: 'pending', retry: 'original-command' })).mockResolvedValueOnce(reply({ kind: 'already-committed', revision: 1 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new CompanyClient(async () => 'token', 'owner');
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
    const key = 'winemaker05.pending.owner.company';
    localStorage.setItem(key, '{invalid');
    const client = new CompanyClient(async () => 'token', 'owner');
    expect(client.hasPending('company')).toBe(true);
    await expect(client.recover('company')).rejects.toThrow('saved pending command is invalid');
    await expect(client.advance(snapshot)).rejects.toThrow('saved pending command is invalid');
    expect(localStorage.getItem(key)).toBe('{invalid');
  });
  it('blocks new commands while another attempt remains unresolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ kind: 'unknown' })));
    const client = new CompanyClient(async () => 'token', 'owner');
    await expect(client.advance(snapshot)).rejects.toThrow();
    await expect(client.advance(snapshot)).rejects.toThrow('Resolve the pending command first');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not discard a local intent when resolving a different device command', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(reply({ kind: 'not-committed' })));
    const client = new CompanyClient(async () => 'token', 'owner');
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
    const first = new CompanyClient(async () => 'token', 'owner', storage);
    const second = new CompanyClient(async () => 'token', 'owner', storage);

    const firstAttempt = first.advance(snapshot);
    await expect(firstAttempt).rejects.toThrow('outcome is not yet known');
    expect(otherAttempt).toBeDefined();
    await expect(otherAttempt).rejects.toThrow('Another tab');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(localStorage.getItem('winemaker05.pending.owner.company')!).commandId).toBe(sent.commandId);
  });
  it('does not send a command when cross-tab locking is unavailable', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('navigator', {});
    const client = new CompanyClient(async () => 'token', 'owner');

    await expect(client.advance(snapshot)).rejects.toThrow('cross-tab');
    expect(fetcher).not.toHaveBeenCalled();
    expect(client.hasPending('company')).toBe(false);
  });
  it('refuses to leave a company with a retained command', async () => {
    localStorage.setItem('winemaker05.pending.owner.company', JSON.stringify({ commandId: 'pending', expectedRevision: 0, command: { type: 'time.advance' } }));
    const client = new CompanyClient(async () => 'token', 'owner');
    await expect(client.prepareToSwitch('company')).rejects.toThrow('Resolve the pending command first');
  });
});
