import { describe, expect, it } from 'vitest';
import { planCalendarAdvance, type CalendarState } from '../../src/game/calendar/Calendar';
import { GRAPES, SITES } from '../../src/game/vineyard/Catalog';
import { advanceVineyard, createVineyard, harvestVineyard, resolveWeather } from '../../src/game/vineyard/Rules';
import type { GrapeId, SiteId, Vineyard, Weather } from '../../src/game/vineyard/types';

const RULES = Object.freeze({ weeksPerSeason: 12, seasonsPerYear: 4 });
const CLEAR_WEATHER: Weather = Object.freeze({ temperatureC: 22, rainMm: 9, humidity: 0.55 });

function makeVineyard(siteId: SiteId = 'hillside', grapeId: GrapeId = 'pinot-noir'): Vineyard {
  const result = createVineyard({ id: `${siteId}-${grapeId}`, name: 'Test block', siteId, grapeId, areaHa: 1, year: 2028 });
  if (!result.ok) throw new Error(result.reason);
  return result.value.vineyard;
}

function calendarForWeek(index: number, year = 2028): CalendarState {
  const season = Math.floor(index / RULES.weeksPerSeason) + 1;
  const week = (index % RULES.weeksPerSeason) + 1;
  return Object.freeze({ rules: RULES, date: Object.freeze({ year, season, week }) });
}

function matureFirstYear(vineyard = makeVineyard()): Vineyard {
  let result = vineyard;
  for (let weekIndex = 0; weekIndex < RULES.weeksPerSeason * RULES.seasonsPerYear; weekIndex += 1) {
    result = advanceVineyard(result, CLEAR_WEATHER, calendarForWeek(weekIndex), false);
  }
  return result;
}

describe('vineyard rules', () => {
  it('provides immutable 05 prototype catalogs and creates initially unripe vineyards at whole-cent cost', () => {
    expect(Object.isFrozen(GRAPES)).toBe(true);
    expect(Object.isFrozen(GRAPES['pinot-noir'])).toBe(true);
    expect(Object.isFrozen(SITES)).toBe(true);

    const result = createVineyard({ id: '  block-1 ', name: '  North Block ', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 1.25, year: 2028 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.costCents).toBe(3_000_000);
    expect(result.value.vineyard).toMatchObject({ id: 'block-1', name: 'North Block', cropYear: 2028, ripeness: 0, condition: 1, cropKg: 0, harvestedKg: 0 });
  });

  it('resolves identical deterministic weather for the same explicit game-time key', () => {
    const calendar = calendarForWeek(15);
    expect(resolveWeather(calendar, 15)).toEqual(resolveWeather(calendar, 15));
    expect(resolveWeather(calendar, 15)).not.toEqual(resolveWeather(calendar, 16));
  });

  it('builds a first-year crop and resets annual crop state only when crossing into a new crop year', () => {
    const mature = matureFirstYear();
    expect(mature.cropKg).toBeGreaterThan(0);
    expect(mature.ripeness).toBeGreaterThanOrEqual(0.5);
    expect(mature.cropKg).toBeLessThanOrEqual(8_000);

    const nextYearCalendar = calendarForWeek(0, 2029);
    const annualReset = advanceVineyard(mature, CLEAR_WEATHER, nextYearCalendar, true);
    expect(annualReset.cropYear).toBe(2029);
    expect(annualReset.cropKg).toBe(0);
    expect(annualReset.harvestedKg).toBe(0);
    expect(annualReset.ripeness).toBe(0);
    expect(annualReset.rot).toBe(0);
    expect(annualReset.nobleRot).toBe(0);

    const repeatedBoundary = advanceVineyard(annualReset, CLEAR_WEATHER, nextYearCalendar, true);
    expect(repeatedBoundary.cropYear).toBe(2029);
    expect(repeatedBoundary.cropKg).toBe(0);
    expect(repeatedBoundary.harvestedKg).toBe(0);
  });

  it('rejects early harvest and caps partial harvest at ripe, unspoiled crop without overdraw', () => {
    const early = { ...makeVineyard(), cropKg: 100, ripeness: 0.49 };
    const rejected = harvestVineyard(early, 10);
    expect(rejected.ok).toBe(false);

    const green = { ...early, ripeness: 0.5 };
    const first = harvestVineyard(green, 50);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.harvestedKg).toBe(24);
    expect(first.value.vineyard.harvestedKg).toBe(24);

    const late = { ...green, ripeness: 1, rot: 0.3, nobleRot: 0 };
    const capped = harvestVineyard(late, 500);
    expect(capped.ok).toBe(true);
    if (!capped.ok) return;
    expect(capped.value.harvestedKg).toBe(70);
    expect(capped.value.vineyard.harvestedKg).toBe(70);
    expect(capped.value.vineyard.harvestedKg).toBeLessThanOrEqual(capped.value.vineyard.cropKg);
  });

  it('changes crop and ripening response across selected grape-site combinations', () => {
    const calendar = calendarForWeek(25);
    const pinot = advanceVineyard(makeVineyard('hillside', 'pinot-noir'), CLEAR_WEATHER, calendar, false);
    const tempranillo = advanceVineyard(makeVineyard('riverbend', 'tempranillo'), CLEAR_WEATHER, calendar, false);
    expect(pinot.cropKg).not.toBe(tempranillo.cropKg);
    expect(pinot.ripeness).not.toBe(tempranillo.ripeness);
  });

  it('does not mutate vineyard or weather inputs', () => {
    const vineyard = Object.freeze({ ...matureFirstYear(), harvestedKg: 5 });
    const weather = Object.freeze({ ...CLEAR_WEATHER });
    const originalVineyard = { ...vineyard };
    const originalWeather = { ...weather };

    advanceVineyard(vineyard, weather, calendarForWeek(36), false);
    const harvested = harvestVineyard(vineyard, 2);

    expect(vineyard).toEqual(originalVineyard);
    expect(weather).toEqual(originalWeather);
    expect(Object.isFrozen(vineyard)).toBe(true);
    expect(harvested.ok).toBe(true);
  });

  it('uses the shared calendar planner for a year-boundary fixture', () => {
    const lastWeek: CalendarState = Object.freeze({
      rules: RULES,
      date: Object.freeze({ year: 2028, season: 4, week: 12 }),
    });
    const planned = planCalendarAdvance(lastWeek);
    expect(planned.kind).toBe('planned');
    if (planned.kind !== 'planned') return;
    expect(planned.interval.crossedYear).toBe(true);
    expect(planned.next.date).toEqual({ year: 2029, season: 1, week: 1 });
  });
});
