import { describe, expect, it } from 'vitest';
import { assessWine } from '../../src/game/evaluation/Assessment';
import { deriveStructure } from '../../src/game/evaluation/Sensory';
import { GRAPES } from '../../src/game/vineyard/Catalog';
import type { GrapeId } from '../../src/game/vineyard/types';
import type { PhysicalLot } from '../../src/game/wine/types';
import { companyStateAt } from '../helpers/CompanyState';
import { apply } from '../helpers/CoreScenario';

function produceBottle(grapeId: GrapeId): { bottled: PhysicalLot; must: PhysicalLot } {
  let state = apply(companyStateAt(), {
    type: 'vineyard.establish', name: 'North slope', siteId: 'hillside', grapeId, areaHa: 0.1,
  });
  for (let weeks = 0; state.estate.vineyards[0].ripeness < 0.9 && weeks < 46; weeks++) {
    state = apply(state, { type: 'time.advance' });
  }
  const vineyard = state.estate.vineyards[0];
  if (vineyard.ripeness < 0.9) throw new Error(`${grapeId} did not ripen.`);
  state = apply(state, {
    type: 'harvest.start', vineyardId: vineyard.id, kilograms: 200, staffIds: state.work.staff.map(staff => staff.id),
  });
  for (let weeks = 0; weeks < 6 && !state.winery.lots.some(lot => lot.form === 'grapes'); weeks++) {
    state = apply(state, { type: 'time.advance' });
  }
  const grapes = state.winery.lots.find(lot => lot.form === 'grapes');
  if (!grapes) throw new Error(`${grapeId} produced no grapes.`);
  state = apply(state, { type: 'wine.press', lotId: grapes.id, vesselId: 'starter-tank', intensity: 0.35, destem: true, skinContact: false });
  const must = state.winery.lots.find(lot => lot.id === grapes.id)!;
  state = apply(state, { type: 'wine.ferment', lotId: grapes.id, temperatureC: 20, skinContact: false, leesContact: true });
  for (let weeks = 0; weeks < 20 && state.winery.lots.find(lot => lot.id === grapes.id)?.processes.fermenting; weeks++) {
    state = apply(state, { type: 'time.advance' });
  }
  const wine = state.winery.lots.find(lot => lot.id === grapes.id);
  if (wine?.form !== 'wine') throw new Error(`${grapeId} did not finish fermentation.`);
  state = apply(state, { type: 'wine.bottle', lotId: wine.id, bottles: 100 });
  const bottled = state.winery.lots.find(lot => lot.form === 'bottled');
  if (!bottled) throw new Error(`${grapeId} did not bottle.`);
  return { bottled, must };
}

describe('dry-wine sweetness targets', () => {
  it('makes each grape through public commands and places its bottleable sweetness in its distinct target', () => {
    const centers: number[] = [];
    for (const grapeId of Object.keys(GRAPES) as GrapeId[]) {
      const { bottled, must } = produceBottle(grapeId);
      const dry = assessWine(bottled).structure.axes.sweetness;
      const sweetMust = assessWine(must).structure.axes.sweetness;
      expect(bottled.physical.sugarGPerL, grapeId).toBeLessThanOrEqual(4);
      expect(dry.value, grapeId).toBeGreaterThanOrEqual(dry.low);
      expect(dry.value, grapeId).toBeLessThanOrEqual(dry.high);
      expect(dry.fit, grapeId).toBeGreaterThan(0.5);
      expect(sweetMust.value, grapeId).toBeGreaterThan(dry.value);
      expect(sweetMust.fit, grapeId).toBeLessThan(dry.fit);
      centers.push((dry.low + dry.high) / 2);
    }
    expect(new Set(centers.map(center => center.toFixed(3))).size).toBe(4);
  });

  it('distinguishes increasing residual sugar beyond the dry target', () => {
    const { bottled } = produceBottle('pinot-noir');
    // Assess physically possible concentrations directly: the current game intentionally bottles only dry wine.
    const samples = [4, 10, 20, 30].map(sugarGPerL => ({
      ...bottled, physical: { ...bottled.physical, sugarGPerL },
    }));
    const values = samples.map(sample => deriveStructure(sample).sweetness);
    const fits = samples.map(sample => assessWine(sample).structure.axes.sweetness.fit);
    for (let index = 1; index < samples.length; index++) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
      expect(fits[index]).toBeLessThan(fits[index - 1]);
    }
  });
});
