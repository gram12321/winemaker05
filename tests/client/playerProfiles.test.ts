// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProfile, discardInvalidPlayerCreation, pendingPlayerCreation } from '../../src/client/playerProfiles';

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

describe('player creation recovery', () => {
  it('retains the ID and name after a lost response and retries the same profile', async () => {
    const requests: { id: string; name: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_path: string, options: RequestInit) => {
      const request = JSON.parse(options.body as string) as { id: string; name: string };
      requests.push(request);
      if (requests.length === 1) throw new Error('response lost');
      return new Response(JSON.stringify({ kind: 'player-created', player: { ...request, createdAt: '2026-01-01T00:00:00.000Z' } }));
    }));
    await expect(createProfile('Ada')).rejects.toThrow('response lost');
    expect(pendingPlayerCreation()).toMatchObject({ kind: 'pending', name: 'Ada' });
    expect(await createProfile('Other')).toMatchObject({ id: requests[0].id, name: 'Ada' });
    expect(requests[1]).toEqual(requests[0]);
    expect(pendingPlayerCreation()).toEqual({ kind: 'none' });
  });

  it('preserves malformed requests until explicitly discarded', async () => {
    localStorage.setItem('winemaker05.creation.player', '{invalid');
    await expect(createProfile('Ada')).rejects.toThrow('saved player request is invalid');
    expect(localStorage.getItem('winemaker05.creation.player')).toBe('{invalid');
    await discardInvalidPlayerCreation();
    expect(pendingPlayerCreation()).toEqual({ kind: 'none' });
  });

  it('clears a definitively conflicting ID without overwriting an existing player', async () => {
    localStorage.setItem('winemaker05.creation.player', JSON.stringify({ id: '33333333-3333-4333-8333-333333333333', name: 'Ada' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: 'not-created' }), { status: 409 })));
    await expect(createProfile('Ada')).rejects.toThrow('conflicts with an existing player');
    expect(pendingPlayerCreation()).toEqual({ kind: 'none' });
  });
});
