import { describe, expect, it } from 'vitest';
import { createCompanyState } from '../../src/game/core';
import { CompanySessions } from '../../src/server/companySessions';
import { InMemorySave } from '../authority/inMemorySave';

function setup() {
  const saves = new InMemorySave();
  const initial = createCompanyState({ rules: { weeksPerSeason: 3, seasonsPerYear: 4 }, initialDate: { year: 1, season: 1, week: 1 } });
  if (initial.kind !== 'created') throw new Error('Invalid test configuration.');
  saves.seed('company', initial.state);
  return { saves, sessions: new CompanySessions() };
}

describe('server company sessions', () => {
  it('serializes queued work and releases the settled session', async () => {
    const { saves, sessions } = setup();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const running = new Promise<void>(resolve => { started = resolve; });
    const first = sessions.run('owner', 'company', saves, async session => {
      started();
      await gate;
      return session;
    });
    await running;
    const second = sessions.run('owner', 'company', saves, async session => session);
    release();
    const [one, two] = await Promise.all([first, second]);
    expect(two).toBe(one);
    await Promise.resolve();
    expect(await sessions.run('owner', 'company', saves, async session => session)).not.toBe(one);
  });

  it('retains an unresolved session until recovery finishes', async () => {
    const { saves, sessions } = setup();
    saves.nextCommit = 'late-unknown';
    const first = await sessions.run('owner', 'company', saves, async session => {
      await session.switchCompany('company');
      expect((await session.dispatch({ companyId: 'company', commandId: 'lost', expectedRevision: 0, command: { type: 'time.advance' } })).kind).toBe('unknown');
      return session;
    });
    await Promise.resolve();
    const recovered = await sessions.run('owner', 'company', saves, async session => {
      expect(session).toBe(first);
      expect((await session.resolve()).kind).toBe('not-committed');
      return session;
    });
    expect(recovered).toBe(first);
    await Promise.resolve();
    expect(await sessions.run('owner', 'company', saves, async session => session)).not.toBe(first);
  });
});
