import { describe, expect, it } from 'vitest';

import { CompanySession, type CommandEnvelope, type CompanySnapshot } from '../../src/authority';
import { commandFingerprint } from '../../src/authority/jsonSnapshot';
import { createCompanyState, decideCommand, type GameCommand } from '../../src/game/core';
import { InMemorySave } from './inMemorySave';

let attemptCounter = 0;
const attemptId = () => `attempt-${++attemptCounter}`;

function state(year = 2030) {
  const result = createCompanyState({
    rules: { weeksPerSeason: 4, seasonsPerYear: 2 },
    initialDate: { year, season: 1, week: 1 },
  });
  if (result.kind !== 'created') throw new Error('Invalid test setup.');
  return result.state;
}

function envelope(commandId: string, expectedRevision = 0, companyId = 'alpha'): CommandEnvelope {
  return { companyId, commandId, expectedRevision, command: { type: 'time.advance' } };
}

function setup() {
  const saves = new InMemorySave();
  saves.seed('alpha', state());
  saves.seed('beta', state(2040));
  return { saves, session: new CompanySession(saves, attemptId) };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('trusted company session', () => {
  it('isolates immutable snapshots and publishes only after a confirmed commit', async () => {
    const { saves, session } = setup();
    expect((await session.switchCompany('alpha')).kind).toBe('loaded');
    const original = session.getSnapshot();
    expect(original).not.toBeNull();
    const gate = deferred();
    const started = deferred();
    saves.beforeCommit = async () => { started.resolve(); await gate.promise; };
    let notifications = 0;
    session.subscribe(() => { notifications += 1; });

    const pending = session.dispatch(envelope('advance'));
    await started.promise;
    expect(session.getSnapshot()).toBe(original);
    expect(notifications).toBe(0);
    expect(original?.state.calendar.date.week).toBe(1);
    expect(Object.isFrozen(original?.state.calendar.date)).toBe(true);
    expect(() => { (original!.state.calendar.date as { week: number }).week = 3; }).toThrow();
    gate.resolve();
    const result = await pending;
    expect(result.kind).toBe('committed');
    if (result.kind !== 'committed') throw new Error('Expected commit.');
    expect(result.events).toHaveLength(1);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(session.getSnapshot()?.state.calendar.date.week).toBe(2);
    expect(original?.state.calendar.date.week).toBe(1);
    expect(notifications).toBe(1);
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    expect(session.getSnapshot()).not.toBe(saves.companies.get('alpha'));
  });

  it('replays a receipt before checking stale revisions and rejects altered payloads', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    expect((await session.dispatch(envelope('same'))).kind).toBe('committed');
    const committed = session.getSnapshot();
    const replay = await session.dispatch(envelope('same', 999));
    expect(replay).toEqual({ kind: 'already-committed', revision: 1 });
    expect(session.getSnapshot()).toBe(committed);
    expect(saves.writes).toBe(1);
    const altered = { type: 'time.advance', additional: 'different' } as unknown as GameCommand;
    expect(await session.dispatch({ ...envelope('same', 999), command: altered })).toEqual({ kind: 'command-id-mismatch' });
    expect(saves.writes).toBe(1);
  });

  it('fingerprints the command consistently across object key order', async () => {
    const command = { type: 'future.command', meta: { a: 1, b: 2 } };
    const reordered = { meta: { b: 2, a: 1 }, type: 'future.command' };
    expect(commandFingerprint(command)).toBe(commandFingerprint(reordered));
  });

  it('deduplicates the same command across sessions at the atomic boundary', async () => {
    const { saves, session: first } = setup();
    const second = new CompanySession(saves, attemptId);
    await Promise.all([first.switchCompany('alpha'), second.switchCompany('alpha')]);
    const results = await Promise.all([first.dispatch(envelope('same')), second.dispatch(envelope('same'))]);
    expect(results.map((result) => result.kind).sort()).toEqual(['already-committed', 'committed']);
    expect(saves.writes).toBe(1);
    expect(first.getSnapshot()?.revision).toBe(1);
    expect(second.getSnapshot()?.revision).toBe(1);
  });

  it('isolates the queued command from caller mutation', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const gate = deferred();
    const started = deferred();
    saves.beforeCommit = async () => { started.resolve(); await gate.promise; };
    const first = session.dispatch(envelope('first'));
    await started.promise;
    const mutable = { companyId: 'alpha', commandId: 'second', expectedRevision: 1, command: { type: 'time.advance' as const } };
    const second = session.dispatch(mutable);
    mutable.commandId = 'changed';
    mutable.expectedRevision = 0;
    gate.resolve();
    expect((await first).kind).toBe('committed');
    expect((await second).kind).toBe('committed');
    expect((await saves.getReceipt('alpha', 'second')).kind).toBe('found');
    expect((await saves.getReceipt('alpha', 'changed')).kind).toBe('absent');
  });

  it('keeps the previous state on a known failure and allows retry', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const previous = session.getSnapshot();
    saves.nextCommit = 'fail';
    expect((await session.dispatch(envelope('retry'))).kind).toBe('failed');
    expect(session.getSnapshot()).toBe(previous);
    expect(saves.writes).toBe(0);
    expect((await session.dispatch(envelope('retry'))).kind).toBe('committed');
    expect(saves.writes).toBe(1);
  });

  it('holds writes and switches while a lost response is unresolved', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const original = session.getSnapshot();
    saves.nextCommit = 'commit-then-unknown';
    expect(await session.dispatch(envelope('lost'))).toEqual({ kind: 'unknown', commandId: 'lost' });
    expect(session.getSnapshot()).toBe(original);
    expect(await session.dispatch(envelope('other'))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(await session.switchCompany('beta')).toEqual({ kind: 'blocked', reason: 'unresolved' });
    saves.resolution = 'pending';
    expect(await session.resolve()).toEqual({ kind: 'pending' });
    saves.resolution = 'unavailable';
    expect((await session.resolve()).kind).toBe('unavailable');
    expect(session.getSnapshot()).toBe(original);
    saves.resolution = 'normal';
    expect(await session.resolve()).toEqual({ kind: 'committed', revision: 1 });
    expect(session.getSnapshot()?.state.calendar.date.week).toBe(2);
    expect((await session.dispatch(envelope('lost', 1))).kind).toBe('already-committed');
    expect(saves.writes).toBe(1);
    expect((await session.switchCompany('beta')).kind).toBe('loaded');
  });

  it('retains a confirmed receipt when recovery cannot yet load the committed state', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    saves.nextCommit = 'commit-then-unknown';
    await session.dispatch(envelope('lost'));
    saves.loadOverrides.set('alpha', { kind: 'unavailable', details: 'offline' });
    expect(await session.resolve()).toEqual({
      kind: 'sync-required', commandId: 'lost', load: { kind: 'unavailable', details: 'offline' },
    });
    expect(await session.dispatch(envelope('other'))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    saves.loadOverrides.delete('alpha');
    // A confirmed receipt is retained even if a later receipt query is unavailable.
    saves.resolution = 'unavailable';
    expect(await session.resolve()).toEqual({ kind: 'committed', revision: 1 });
    expect(session.getSnapshot()?.revision).toBe(1);
  });

  it('treats a malformed commit response as unknown until an authoritative receipt is read', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const realCommit = saves.commit.bind(saves);
    saves.commit = async (input) => {
      await realCommit(input);
      return { kind: 'already-committed', receipt: { ...input.receipt, companyId: 'wrong-company' } };
    };
    expect(await session.dispatch(envelope('uncertain'))).toEqual({ kind: 'unknown', commandId: 'uncertain' });
    expect(await session.dispatch(envelope('other'))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(await session.resolve()).toEqual({ kind: 'committed', revision: 1 });
    expect(saves.writes).toBe(1);
  });

  it('fences an uncertain command and requires a new ID for a later decision', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    saves.nextCommit = 'late-unknown';
    expect((await session.dispatch(envelope('retry'))).kind).toBe('unknown');
    expect(await session.resolve()).toEqual({ kind: 'not-committed' });
    expect(saves.runLateAttempt().kind).toBe('failed');
    expect(saves.writes).toBe(0);
    expect((await session.dispatch(envelope('retry'))).kind).toBe('failed');
    expect((await session.dispatch(envelope('new-decision'))).kind).toBe('committed');
    expect(saves.writes).toBe(1);
  });

  it('recovers a lost reservation in a fresh session and fences its delayed continuation', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    saves.nextCommit = 'reservation-then-unknown';
    expect(await session.dispatch(envelope('lost'))).toEqual({ kind: 'unknown', commandId: 'lost' });
    const restarted = new CompanySession(saves, attemptId);
    const loaded = await restarted.switchCompany('alpha');
    expect(loaded.kind).toBe('loaded');
    expect(restarted.getPendingAttempt()).toMatchObject({ companyId: 'alpha', commandId: 'lost', attemptId: saves.lateAttempt?.attemptId });
    expect(await restarted.dispatch(envelope('other'))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(await restarted.switchCompany('beta')).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(await restarted.resolve()).toEqual({ kind: 'not-committed' });
    expect(saves.runLateAttempt().kind).toBe('failed');
    expect((await restarted.dispatch(envelope('other'))).kind).toBe('committed');
    expect(saves.writes).toBe(1);
  });

  it('reports a competing live reservation without fencing it, and settles it through an exact receipt replay', async () => {
    const { saves, session: first } = setup();
    const second = new CompanySession(saves, attemptId);
    await Promise.all([first.switchCompany('alpha'), second.switchCompany('alpha')]);
    const gate = deferred();
    const reserved = deferred();
    saves.beforeApply = async () => { reserved.resolve(); await gate.promise; };
    const committing = first.dispatch(envelope('running'));
    await reserved.promise;
    expect(await second.dispatch(envelope('other'))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(second.getPendingAttempt()?.commandId).toBe('running');
    expect(saves.fences.size).toBe(0);
    gate.resolve();
    expect((await committing).kind).toBe('committed');
    expect(await second.dispatch(envelope('running', 999))).toEqual({ kind: 'already-committed', revision: 1 });
    expect(second.getPendingAttempt()).toBeUndefined();
    expect((await second.switchCompany('beta')).kind).toBe('loaded');
    expect(saves.writes).toBe(1);
  });

  it('replays an earlier receipt without clearing an unrelated durable pending attempt', async () => {
    const { saves, session: first } = setup();
    await first.switchCompany('alpha');
    expect((await first.dispatch(envelope('old'))).kind).toBe('committed');
    const gate = deferred();
    const reserved = deferred();
    saves.beforeApply = async () => { reserved.resolve(); await gate.promise; };
    const committing = first.dispatch(envelope('new', 1));
    await reserved.promise;
    const restarted = new CompanySession(saves, attemptId);
    await restarted.switchCompany('alpha');
    expect(await restarted.dispatch(envelope('old', 999))).toEqual({ kind: 'already-committed', revision: 1 });
    expect(restarted.getPendingAttempt()?.commandId).toBe('new');
    expect(await restarted.dispatch(envelope('another', 1))).toEqual({ kind: 'blocked', reason: 'unresolved' });
    expect(await restarted.switchCompany('beta')).toEqual({ kind: 'blocked', reason: 'unresolved' });
    gate.resolve();
    expect((await committing).kind).toBe('committed');
    expect(await restarted.resolve()).toEqual({ kind: 'committed', revision: 2 });
    expect(saves.writes).toBe(2);
  });

  it('fences a late old attempt without canceling a newer reservation', async () => {
    const { saves, session: first } = setup();
    const second = new CompanySession(saves, attemptId);
    await Promise.all([first.switchCompany('alpha'), second.switchCompany('alpha')]);
    saves.nextCommit = 'late-unknown';
    expect((await first.dispatch(envelope('old'))).kind).toBe('unknown');
    const gate = deferred();
    const reserved = deferred();
    saves.beforeApply = async () => { reserved.resolve(); await gate.promise; };
    const running = second.dispatch(envelope('new'));
    await reserved.promise;
    expect(await first.resolve()).toEqual({ kind: 'not-committed' });
    expect(first.getPendingAttempt()?.commandId).toBe('new');
    expect(saves.runLateAttempt().kind).toBe('failed');
    gate.resolve();
    expect((await running).kind).toBe('committed');
    expect(await first.resolve()).toEqual({ kind: 'committed', revision: 1 });
    expect(saves.writes).toBe(1);
  });

  it('does not settle an inconsistent duplicate response or accept zero-revision receipts', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const realCommit = saves.commit.bind(saves);
    saves.commit = async (input) => {
      await realCommit(input);
      return { kind: 'already-committed', receipt: { ...input.receipt, fingerprint: 'different' } };
    };
    expect(await session.dispatch(envelope('uncertain'))).toEqual({ kind: 'unknown', commandId: 'uncertain' });
    expect(await session.resolve()).toEqual({ kind: 'committed', revision: 1 });
    const realLookup = saves.getReceipt.bind(saves);
    saves.getReceipt = async (companyId, commandId) => commandId === 'zero'
      ? { kind: 'found', receipt: { companyId, commandId, fingerprint: commandFingerprint({ type: 'time.advance' }), revision: 0 } }
      : realLookup(companyId, commandId);
    expect((await session.dispatch(envelope('zero', 1))).kind).toBe('unavailable');
    expect(saves.writes).toBe(1);
  });

  it.each(['committed', 'command-id-mismatch'] as const)(
    'keeps an attempt unresolved when %s resolution supplies a zero-revision receipt',
    async (kind) => {
      const { saves, session } = setup();
      await session.switchCompany('alpha');
      saves.nextCommit = 'late-unknown';
      expect((await session.dispatch(envelope('uncertain'))).kind).toBe('unknown');
      saves.resolveAttempt = async (input) => ({
        kind,
        receipt: { companyId: input.companyId, commandId: input.commandId, revision: 0,
          fingerprint: kind === 'committed' ? input.fingerprint : 'different' },
      });
      expect((await session.resolve()).kind).toBe('invalid-receipt');
      expect(await session.switchCompany('beta')).toEqual({ kind: 'blocked', reason: 'unresolved' });
      expect(saves.writes).toBe(0);
    },
  );

  it('fences a lost attempt when another payload won the same command ID', async () => {
    const { saves, session } = setup();
    const other = new CompanySession(saves, attemptId);
    await Promise.all([session.switchCompany('alpha'), other.switchCompany('alpha')]);
    saves.nextCommit = 'late-unknown';
    expect((await session.dispatch(envelope('shared'))).kind).toBe('unknown');
    const different = { type: 'future.command', purpose: 'other' };
    const next = decideCommand(state(), { type: 'time.advance' });
    if (next.kind !== 'accepted') throw new Error('Invalid test setup.');
    expect((await saves.commit({ companyId: 'alpha', attemptId: attemptId(), expectedRevision: 0, next: next.next,
      receipt: { companyId: 'alpha', commandId: 'shared', fingerprint: commandFingerprint(different), revision: 1 },
    })).kind).toBe('committed');
    expect(await session.resolve()).toEqual({ kind: 'command-id-mismatch' });
    expect(session.getSnapshot()?.revision).toBe(1);
    expect(saves.runLateAttempt().kind).toBe('command-id-mismatch');
    expect(saves.writes).toBe(1);
  });

  it('reloads after a competing writer and requires a new player decision', async () => {
    const { saves, session: first } = setup();
    const second = new CompanySession(saves, attemptId);
    await Promise.all([first.switchCompany('alpha'), second.switchCompany('alpha')]);
    expect((await first.dispatch(envelope('first'))).kind).toBe('committed');
    expect(await second.dispatch(envelope('second'))).toEqual({ kind: 'conflict', currentRevision: 1 });
    expect(second.getSnapshot()?.revision).toBe(1);
    expect(saves.writes).toBe(1);
    expect((await second.dispatch(envelope('second', 1))).kind).toBe('committed');
    expect(saves.writes).toBe(2);
  });

  it('blocks further mutations after a conflict if reloading fails', async () => {
    const { saves, session: first } = setup();
    const second = new CompanySession(saves, attemptId);
    await Promise.all([first.switchCompany('alpha'), second.switchCompany('alpha')]);
    const stale = second.getSnapshot();
    await first.dispatch(envelope('first'));
    saves.loadOverrides.set('alpha', { kind: 'unavailable', details: 'offline' });
    expect(await second.dispatch(envelope('second'))).toEqual({
      kind: 'conflict', currentRevision: 1, reload: { kind: 'unavailable', details: 'offline' },
    });
    expect(await second.dispatch(envelope('third'))).toEqual({ kind: 'blocked', reason: 'sync-required' });
    expect(await second.switchCompany('beta')).toEqual({ kind: 'blocked', reason: 'sync-required' });
    saves.loadOverrides.set('alpha', { kind: 'loaded', snapshot: stale! });
    expect((await second.refresh()).kind).toBe('invalid');
    expect(await second.dispatch(envelope('third'))).toEqual({ kind: 'blocked', reason: 'sync-required' });
    saves.loadOverrides.delete('alpha');
    expect((await second.refresh()).kind).toBe('loaded');
    expect(second.getSnapshot()?.revision).toBe(1);
    expect((await second.switchCompany('beta')).kind).toBe('loaded');
  });

  it('waits for an in-flight commit before switching and rejects old-company dispatches', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const gate = deferred();
    const started = deferred();
    saves.beforeCommit = async () => { started.resolve(); await gate.promise; };
    const changes: Array<CompanySnapshot | null> = [];
    session.subscribe(() => changes.push(session.getSnapshot()));
    const pending = session.dispatch(envelope('advance'));
    await started.promise;
    const switching = session.switchCompany('beta');
    expect(session.getSnapshot()?.companyId).toBe('alpha');
    gate.resolve();
    expect((await pending).kind).toBe('committed');
    expect((await switching).kind).toBe('loaded');
    expect(changes.map((snapshot) => snapshot?.companyId)).toEqual(['alpha', 'beta']);
    expect(await session.dispatch(envelope('late', 1))).toEqual({ kind: 'inactive-company' });
    expect(session.getSnapshot()?.companyId).toBe('beta');
  });

  it.each([
    { kind: 'missing' } as const,
    { kind: 'invalid', details: 'corrupt' } as const,
    { kind: 'unavailable', details: 'offline' } as const,
  ])('preserves the active company on a $kind load', async (failure) => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const original = session.getSnapshot();
    saves.loadOverrides.set('beta', failure);
    expect(await session.switchCompany('beta')).toEqual(failure);
    expect(session.getSnapshot()).toBe(original);
    expect(saves.writes).toBe(0);
  });

  it('rejects a malformed loaded state without replacing or overwriting the existing company', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const original = session.getSnapshot();
    const invalid = { ...saves.companies.get('beta')!, state: { calendar: null } } as unknown as CompanySnapshot;
    saves.loadOverrides.set('beta', { kind: 'loaded', snapshot: invalid });
    expect((await session.switchCompany('beta')).kind).toBe('invalid');
    expect(session.getSnapshot()).toBe(original);
    expect(saves.writes).toBe(0);
  });

  it('does not commit a domain rejection', async () => {
    const { saves, session } = setup();
    await session.switchCompany('alpha');
    const original = session.getSnapshot();
    const badCommand = { type: 'unknown' } as unknown as GameCommand;
    expect(await session.dispatch({ ...envelope('bad'), command: badCommand })).toEqual({
      kind: 'rejected', reasons: ['Unsupported command.'],
    });
    expect(session.getSnapshot()).toBe(original);
    expect(saves.writes).toBe(0);
  });
});
