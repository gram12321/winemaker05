import { describe, expect, it } from 'vitest';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createWineOrigin } from '../../src/game/vineyard/Origin';
import { MAX_SNAPSHOT_TEXT_LENGTH } from '../../src/game/core/Numbers';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import { configureFermentation, pressLot } from '../../src/game/wine/Operations';
import { developLot } from '../../src/game/wine/Development';
import { resolveWineEnvironment } from '../../src/game/equipment/Rules';
import { developStoredLot } from '../../src/game/simulation/DevelopStoredLot';
import type { Holding } from '../../src/game/inventory/types';
import type { Vessel } from '../../src/game/equipment/types';

function nearCompletion() {
  const made = createVineyard({ id: 'vineyard', name: 'Slope', siteId: 'hillside', grapeId: 'pinot-noir', areaHa: 1, year: 1 });
  if (!made.ok) throw new Error(made.reason);
  const vineyard = { ...made.value.vineyard, ripeness: 0.9, cropKg: 1000 };
  const grapes = createHarvestLot({ id: 'lot', wineId: 'wine', name: 'Pinot', origin: createWineOrigin(vineyard), vineyard, week: 0 });
  const pressed = pressLot(grapes, 0.4, true, true, 0);
  if (!pressed.ok) throw new Error(pressed.reason);
  const configured = configureFermentation(pressed.value.lot, { temperatureC: 20, skinContact: true, leesContact: true }, 0);
  if (!configured.ok) throw new Error(configured.reason);
  const lot = { ...configured.value, physical: { ...configured.value.physical, sugarGPerL: 4.1, alcoholPct: 12, yeastActivity: 1 } };
  const holding: Holding = { lotId: lot.id, quantity: 500_000, unit: 'ml', location: 'vessel', vesselId: 'tank' };
  const vessel: Vessel = { id: 'tank', name: 'Tank', material: 'steel', capacityMl: 1_000_000, condition: 1, uses: 1 };
  return { lot, holding, vessel, cellarTemperatureC: 10, occupiedMl: holding.quantity };
}

describe('daily environment handover', () => {
  it('returns completed fermentation to cellar temperature during the same week', () => {
    const input = nearCompletion();
    const before = structuredClone(input);
    const controlled = resolveWineEnvironment(input.lot, input.holding, input.vessel, input.cellarTemperatureC, input.occupiedMl);
    const firstDay = developLot(input.lot, controlled, 1).lot;
    expect(firstDay.processes.fermenting).toBe(false);
    const resting = resolveWineEnvironment(firstDay, input.holding, input.vessel, input.cellarTemperatureC, input.occupiedMl);
    expect(resting.temperatureC).toBe(10);
    const expected = developLot(firstDay, resting, 2).lot;
    const actual = developStoredLot({ ...input, days: 3 });
    expect(actual.lot).toEqual(expected);
    expect(actual.lot.physical.maturation).toBeLessThan(developLot(input.lot, controlled, 3).lot.physical.maturation);
    expect(input).toEqual(before);
    expect(actual.causes.length).toBeGreaterThan(0);
  });

  it('attributes risk changes to the actual environment on each side of fermentation completion', () => {
    const input = nearCompletion();
    const result = developStoredLot({ ...input, days: 3 });
    const oxidation = result.causes.filter(cause => cause.startsWith('Oxygen exposure/oxidation:'));
    const rot = result.causes.find(cause => cause.startsWith('Rot:'));

    expect(oxidation.map(cause => cause.includes('20°C fermenting'))).toContain(true);
    expect(oxidation.map(cause => cause.includes('10°C cellar'))).toContain(true);
    expect(rot).toContain('contamination 0.05');
    expect(rot).toContain('20°C');
    expect(rot).toContain('sugar ≤4 g/L (fermenting)');
    expect(rot).not.toContain('10°C');
    expect(result.causes.every(cause => cause.length <= MAX_SNAPSHOT_TEXT_LENGTH)).toBe(true);
  });

  it('handles zero days without progression and rejects unsupported intervals', () => {
    const input = nearCompletion();
    expect(developStoredLot({ ...input, days: 0 }).lot).toEqual(input.lot);
    expect(() => developStoredLot({ ...input, days: 0.5 })).toThrow(RangeError);
    expect(() => developStoredLot({ ...input, days: -1 })).toThrow(RangeError);
  });
});
