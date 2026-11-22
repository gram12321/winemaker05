import { describe, expect, it } from 'vitest';
import { decideCommand } from '../../src/game/core/decideCommand';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { CompanySession } from '../../src/authority/session';
import { forecastLot } from '../../src/game/queries/CompanyView';
import { previewCommand } from '../../src/game/queries/ActionPreviews';
import { apply, createBottledScenario, createHarvestedScenario } from '../helpers/CoreScenario';
import { InMemorySave } from '../authority/inMemorySave';
import { companyStateAt } from '../helpers/CompanyState';
import { resolveWeather } from '../../src/game/vineyard/Rules';
import { planCalendarAdvance } from '../../src/game/calendar/Calendar';
import { HARVEST_RAIN_STOP_MM } from '../../src/game/work/Rules';

describe('integrated core production and sale loop', () => {
  it('can pause harvest for generated heavy rain without awarding material or experience', () => {
    const harvested = createHarvestedScenario();
    let state = harvested.state;
    for (let weeks = 0; weeks < 8; weeks++) {
      const planned = planCalendarAdvance(state.calendar);
      if (planned.kind !== 'planned') throw new Error('Calendar did not advance.');
      if (resolveWeather(planned.next, state.week + 1).rainMm >= HARVEST_RAIN_STOP_MM) break;
      state = apply(state, { type: 'time.advance' });
    }
    state = apply(state, { type: 'harvest.start', vineyardId: harvested.vineyardId, kilograms: 10, staffIds: state.work.staff.map(s => s.id) });
    const next = apply(state, { type: 'time.advance' });
    expect(next.estate.weather.rainMm).toBeGreaterThanOrEqual(HARVEST_RAIN_STOP_MM);
    expect(next.work.activities[0].blockedReason).toContain('rain');
    expect(next.work.staff).toEqual(state.work.staff);
    expect(next.winery.lots.map(lot => lot.id)).toEqual(state.winery.lots.map(lot => lot.id));
  });

  it('resets an existing crop to the planned year even for a one-week year', () => {
    let state = companyStateAt({ year: 4, season: 1, week: 1 }, { weeksPerSeason: 1, seasonsPerYear: 1 });
    state = apply(state, { type: 'vineyard.establish', name: 'Annual crop', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 0.1 });
    state = apply(state, { type: 'time.advance' });
    expect(state.calendar.date.year).toBe(5);
    expect(state.estate.vineyards[0]).toMatchObject({ cropYear: 5, cropKg: 0, ripeness: 0 });
  });

  it('grows, harvests, ferments and bottles deterministically through public commands', () => {
    const first = createBottledScenario();
    expect(first).toEqual(createBottledScenario());
    const bulk = first.state.winery.lots.find(lot => lot.id === first.bulkId)!;
    const bottled = first.state.winery.lots.find(lot => lot.id === first.bottledId)!;
    expect(bottled.anchors).toEqual(bulk.anchors);
    expect(bottled.physical).toEqual(bulk.physical);
    expect(bottled.bottling?.week).toBe(first.state.week);
    expect(first.state.inventory.holdings.find(h => h.lotId === bottled.id)).toMatchObject({ quantity: 100, unit: 'bottle', vesselId: null });
    expect(readCompanyState(first.state).kind).toBe('valid');
  });

  it('creates harvest output at the week boundary and develops it in the next interval', () => {
    const { state, lotId } = createHarvestedScenario();
    expect(state.winery.lots.find(lot => lot.id === lotId)?.physical.ageDays).toBe(0);
    const next = apply(state, { type: 'time.advance' });
    expect(next.winery.lots.find(lot => lot.id === lotId)?.physical.ageDays).toBe(7);
    expect(state.winery.lots.find(lot => lot.id === lotId)?.physical.ageDays).toBe(0);
  });

  it('continues bottled development while preserving the historical bottling assessment', () => {
    const { state, bottledId } = createBottledScenario();
    const bottled = state.winery.lots.find(lot => lot.id === bottledId)!;
    const before = structuredClone(state);
    const forecast = forecastLot(state, bottled, 12);
    expect(Number.isFinite(forecast.quality)).toBe(true);
    expect(state).toEqual(before);
    const next = apply(state, { type: 'time.advance' });
    const after = next.winery.lots.find(lot => lot.id === bottledId)!;
    expect(after.physical.ageDays).toBe(bottled.physical.ageDays + 7);
    expect(after.bottling).toEqual(bottled.bottling);
    expect(after.anchors).toEqual(bottled.anchors);
  });

  it('previews the same stock/cash outcome constraints and cannot oversell', () => {
    const { state, bottledId } = createBottledScenario();
    const command = { type: 'wine.sell' as const, lotId: bottledId, buyerId: 'local-merchant' as const, bottles: 101 };
    const before = structuredClone(state);
    const preview = previewCommand(state, command);
    const decision = decideCommand(state, command);
    expect(preview.allowed).toBe(false);
    expect(decision.kind).toBe('rejected');
    expect(state).toEqual(before);
    const sold = apply(state, { ...command, bottles: 20 });
    expect(sold.inventory.holdings.find(h => h.lotId === bottledId)?.quantity).toBe(80);
    expect(sold.finance.cashCents).toBeGreaterThan(state.finance.cashCents);
    expect(sold.commercial.sales).toHaveLength(1);
  });

  it('commits a retried sale once and rejects a stale competing sale', async () => {
    const { state, bottledId } = createBottledScenario();
    const saves = new InMemorySave();
    saves.seed('core-company', state);
    let attempt = 0;
    const session = new CompanySession(saves, () => `core-attempt-${++attempt}`);
    await session.switchCompany('core-company');
    const envelope = { companyId: 'core-company', commandId: 'one-sale', expectedRevision: 0, command: { type: 'wine.sell' as const, lotId: bottledId, buyerId: 'local-merchant' as const, bottles: 20 } };
    saves.nextCommit = 'commit-then-unknown';
    expect((await session.dispatch(envelope)).kind).toBe('unknown');
    expect((await session.resolve()).kind).toBe('committed');
    expect((await session.dispatch(envelope)).kind).toBe('already-committed');
    expect((await session.dispatch({ ...envelope, commandId: 'stale-sale' })).kind).toBe('conflict');
    const saved = saves.companies.get('core-company')!;
    expect(saved.state.inventory.holdings.find(h => h.lotId === bottledId)?.quantity).toBe(80);
    expect(saved.state.commercial.sales).toHaveLength(1);
    expect(saved.state.finance.postings.filter(p => p.category === 'sale')).toHaveLength(1);
  });

  it('can explicitly discard a remainder or failed lot and free its vessel without creating cash', () => {
    const { state, bulkId } = createBottledScenario();
    const amount = state.inventory.holdings.find(holding => holding.lotId === bulkId)!.quantity;
    const next = apply(state, { type: 'wine.discard', lotId: bulkId, quantity: amount });
    expect(next.inventory.holdings.some(holding => holding.lotId === bulkId)).toBe(false);
    expect(next.winery.archivedLots.some(lot => lot.id === bulkId)).toBe(true);
    expect(next.finance).toEqual(state.finance);
    expect(readCompanyState(next).kind).toBe('valid');
  });
});
