import { describe, expect, it } from 'vitest';

import { createCompanyState, decideCommand, readCompanyState, type CompanyState, type GameCommand } from '../../src/game/core';
import { initialGameplay } from '../../src/game/core/CompanyState';

describe('time.advance', () => {
  it('advances one week as a deterministic, independent candidate', () => {
    const created = createCompanyState({
      rules: { weeksPerSeason: 12, seasonsPerYear: 4 },
      initialDate: { year: 2030, season: 2, week: 3 },
    });
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') throw new Error('Expected a valid company');

    const first = decideCommand(created.state, { type: 'time.advance' });
    const second = decideCommand(created.state, { type: 'time.advance' });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: 'accepted',
      next: {
        calendar: {
          rules: { weeksPerSeason: 12, seasonsPerYear: 4 },
          date: { year: 2030, season: 2, week: 4 },
        },
      },
      events: [
        {
          type: 'time.advanced',
          from: { year: 2030, season: 2, week: 3 },
          to: { year: 2030, season: 2, week: 4 },
          crossedSeason: false,
          crossedYear: false,
        },
      ],
    });
    expect(created.state.calendar.date).toEqual({ year: 2030, season: 2, week: 3 });
  });

  it.each([
    {
      rules: { weeksPerSeason: 3, seasonsPerYear: 4 },
      from: { year: 2030, season: 2, week: 3 },
      to: { year: 2030, season: 3, week: 1 },
      crossedSeason: true,
      crossedYear: false,
    },
    {
      rules: { weeksPerSeason: 3, seasonsPerYear: 4 },
      from: { year: 2030, season: 4, week: 3 },
      to: { year: 2031, season: 1, week: 1 },
      crossedSeason: true,
      crossedYear: true,
    },
    {
      rules: { weeksPerSeason: 1, seasonsPerYear: 1 },
      from: { year: 0, season: 1, week: 1 },
      to: { year: 1, season: 1, week: 1 },
      crossedSeason: true,
      crossedYear: true,
    },
  ])('reports boundary facts for $from', ({ rules, from, to, crossedSeason, crossedYear }) => {
    const created = createCompanyState({ rules, initialDate: from });
    if (created.kind !== 'created') throw new Error('Expected a valid company');

    const decision = decideCommand(created.state, { type: 'time.advance' });
    expect(decision.kind).toBe('accepted');
    if (decision.kind !== 'accepted') throw new Error('Expected a valid advance');
    expect(decision.next.calendar.date).toEqual(to);
    expect(decision.events).toEqual([{ type: 'time.advanced', from, to, crossedSeason, crossedYear }]);
    expect(created.state.calendar.date).toEqual(from);
  });

  it('reports each configured boundary once across a full year of advances', () => {
    const created = createCompanyState({
      rules: { weeksPerSeason: 2, seasonsPerYear: 2 },
      initialDate: { year: 9, season: 1, week: 1 },
    });
    if (created.kind !== 'created') throw new Error('Expected a valid company');

    let state = created.state;
    const boundaries: Array<{ season: boolean; year: boolean }> = [];
    for (let week = 0; week < 4; week += 1) {
      const decision = decideCommand(state, { type: 'time.advance' });
      if (decision.kind !== 'accepted') throw new Error('Expected a valid advance');
      const [event] = decision.events;
      if (!event) throw new Error('Expected an advance event');
      boundaries.push({ season: event.crossedSeason, year: event.crossedYear });
      state = decision.next;
    }

    expect(boundaries).toEqual([
      { season: false, year: false },
      { season: true, year: false },
      { season: false, year: false },
      { season: true, year: true },
    ]);
    expect(state.calendar.date).toEqual({ year: 10, season: 1, week: 1 });
    expect(created.state.calendar.date).toEqual({ year: 9, season: 1, week: 1 });
  });

  it('copies input data and returns deeply frozen state and event facts', () => {
    const input = {
      rules: { weeksPerSeason: 4, seasonsPerYear: 3 },
      initialDate: { year: 2030, season: 2, week: 3 },
    };
    const created = createCompanyState(input);
    if (created.kind !== 'created') throw new Error('Expected a valid company');
    const decision = decideCommand(created.state, { type: 'time.advance' });
    if (decision.kind !== 'accepted') throw new Error('Expected a valid advance');
    const [event] = decision.events;
    if (!event) throw new Error('Expected an advance event');

    input.rules.weeksPerSeason = 20;
    input.initialDate.week = 1;
    expect(created.state.calendar.rules.weeksPerSeason).toBe(4);
    expect(created.state.calendar.date.week).toBe(3);
    expect(decision.next.calendar.date.week).toBe(4);
    expect(event.from.week).toBe(3);
    expect(event.to.week).toBe(4);
    expect(decision.next.calendar.rules).not.toBe(created.state.calendar.rules);
    expect(event.from).not.toBe(created.state.calendar.date);
    expect(event.to).not.toBe(decision.next.calendar.date);
    for (const value of [
      created.state,
      created.state.calendar,
      created.state.calendar.rules,
      created.state.calendar.date,
      decision.next,
      decision.next.calendar,
      decision.next.calendar.rules,
      decision.next.calendar.date,
      decision.events,
      event,
      event.from,
      event.to,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it('validates and copies a serialized company before it is published', () => {
    const raw = {
      ...initialGameplay(),
      calendar: {
        rules: { weeksPerSeason: 4, seasonsPerYear: 3 },
        date: { year: 2030, season: 2, week: 3 },
      },
    };
    const result = readCompanyState(raw);
    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') throw new Error('Expected a valid snapshot');
    raw.calendar.date.week = 4;
    expect(result.state.calendar.date.week).toBe(3);
    expect(Object.isFrozen(result.state.calendar.date)).toBe(true);
  });

  it.each([
    null,
    { calendar: null },
    { calendar: { rules: { weeksPerSeason: 4, seasonsPerYear: 3 }, date: { year: 2030, season: 4, week: 1 } } },
    { calendar: { rules: { weeksPerSeason: 4, seasonsPerYear: 3 }, date: { year: 2030, season: 1, week: 1 } }, extra: 1 },
    { calendar: { rules: { weeksPerSeason: 4, seasonsPerYear: 3 }, date: { year: 2030, season: 1, week: 1 }, extra: 1 } },
    { calendar: { rules: { weeksPerSeason: 4, seasonsPerYear: 3, extra: 1 }, date: { year: 2030, season: 1, week: 1 } } },
    { calendar: { rules: { weeksPerSeason: 4, seasonsPerYear: 3 }, date: { year: 2030, season: 1, week: 1, extra: 1 } } },
  ])('rejects malformed or unrecognized serialized company data %#', (raw) => {
    expect(readCompanyState(raw).kind).toBe('invalid');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects %s as a calendar length',
    (invalidLength) => {
      const result = createCompanyState({
        rules: { weeksPerSeason: invalidLength, seasonsPerYear: invalidLength },
        initialDate: { year: 2030, season: 1, week: 1 },
      });
      expect(result.kind).toBe('rejected');
      if (result.kind !== 'rejected') throw new Error('Expected invalid calendar rules');
      expect(result.reasons).toEqual([
        'Weeks per season must be a positive safe integer.',
        'Seasons per year must be a positive safe integer.',
      ]);
    },
  );

  it.each([
    { year: 2030, season: 0, week: 1 },
    { year: 2030, season: 5, week: 1 },
    { year: 2030, season: 1, week: 0 },
    { year: 2030, season: 1, week: 13 },
    { year: 2030, season: 1.5, week: 1 },
    { year: Number.NaN, season: 1, week: 1 },
    { year: Number.MAX_SAFE_INTEGER + 1, season: 1, week: 1 },
  ])('rejects an out-of-bounds initial date $year/$season/$week', (initialDate) => {
    const result = createCompanyState({
      rules: { weeksPerSeason: 12, seasonsPerYear: 4 },
      initialDate,
    });
    expect(result.kind).toBe('rejected');
  });

  it('rejects invalid source state without modifying it', () => {
    const state: CompanyState = {
      ...initialGameplay(),
      calendar: {
        rules: { weeksPerSeason: 3, seasonsPerYear: 2 },
        date: { year: 2029, season: 2, week: 4 },
      },
    };
    const original = structuredClone(state);
    expect(decideCommand(state, { type: 'time.advance' })).toEqual({
      kind: 'rejected',
      reasons: ['Week exceeds the configured weeks per season.'],
    });
    expect(state).toEqual(original);
    expect(decideCommand({ calendar: null } as unknown as CompanyState, { type: 'time.advance' })).toEqual({
      kind: 'rejected',
      reasons: ['Calendar must be an object.'],
    });
  });

  it('rejects a year overflow without changing the source date', () => {
    const created = createCompanyState({
      rules: { weeksPerSeason: 1, seasonsPerYear: 1 },
      initialDate: { year: Number.MAX_SAFE_INTEGER, season: 1, week: 1 },
    });
    if (created.kind !== 'created') throw new Error('Expected a valid company');
    expect(decideCommand(created.state, { type: 'time.advance' })).toEqual({
      kind: 'rejected',
      reasons: ['Advancing would exceed the supported year.'],
    });
    expect(created.state.calendar.date).toEqual({ year: Number.MAX_SAFE_INTEGER, season: 1, week: 1 });
  });

  it('rejects an unsupported runtime command without changing the source', () => {
    const created = createCompanyState({
      rules: { weeksPerSeason: 1, seasonsPerYear: 1 },
      initialDate: { year: 2030, season: 1, week: 1 },
    });
    if (created.kind !== 'created') throw new Error('Expected a valid company');
    const result = decideCommand(created.state, { type: 'unknown' } as unknown as GameCommand);
    expect(result).toEqual({ kind: 'rejected', reasons: ['Unsupported command.'] });
    expect(created.state.calendar.date).toEqual({ year: 2030, season: 1, week: 1 });
  });

  it('rejects unknown fields rather than treating them as part of the command identity', () => {
    const created = createCompanyState({
      rules: { weeksPerSeason: 1, seasonsPerYear: 1 },
      initialDate: { year: 2030, season: 1, week: 1 },
    });
    if (created.kind !== 'created') throw new Error('Expected a valid company');
    const command = { type: 'time.advance', ignored: true } as unknown as GameCommand;
    expect(decideCommand(created.state, command)).toEqual({
      kind: 'rejected', reasons: ['Unsupported command.'],
    });
    expect(created.state.calendar.date).toEqual({ year: 2030, season: 1, week: 1 });
  });
});
