import { describe, expect, it } from 'vitest';
import { GRAPES, SITES } from '../../src/game/vineyard/Catalog';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createWineOrigin, landValueCents, originPrestige, terroirPotential } from '../../src/game/vineyard/Origin';
import type { GrapeId, SiteId, SiteDefinition, Vineyard } from '../../src/game/vineyard/types';

function makeVineyard(siteId: SiteId = 'hillside', grapeId: GrapeId = 'pinot-noir'): Vineyard {
  const result = createVineyard({ id: 'block-1', name: 'North Block', siteId, grapeId, areaHa: 1, year: 2028 });
  if (!result.ok) throw new Error(result.reason);
  return result.value.vineyard;
}

describe('vineyard origin rules', () => {
  it('preserves negative safe years from vineyard establishment through origin projection', () => {
    const result = createVineyard({ id: 'old-block', name: 'Old Block', siteId: 'heritage', grapeId: 'pinot-noir', areaHa: 1, year: -44 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.value.vineyard.plantedYear).toBe(-44);
    expect(createWineOrigin(result.value.vineyard).vintage).toBe(-44);
    expect(() => createWineOrigin({ ...result.value.vineyard, cropYear: Number.MIN_SAFE_INTEGER - 1 })).toThrow(RangeError);
  });

  it('keeps agricultural potential independent from commercial site price and prestige', () => {
    const site = SITES.hillside;
    const grape = GRAPES['pinot-noir'];
    const commercialVariant: SiteDefinition = { ...site, pricePerHaCents: 99_000_000, prestige: 0 };

    expect(terroirPotential(site, grape, 0.8)).toBe(terroirPotential(commercialVariant, grape, 0.8));
    expect(terroirPotential(site, grape, 0.8)).toBeGreaterThanOrEqual(0);
    expect(terroirPotential(site, grape, 0.8)).toBeLessThanOrEqual(1);
    expect(terroirPotential(site, grape, 0.8)).toBe(terroirPotential(site, grape, 0.8));
    expect(terroirPotential(site, grape, 1)).toBeGreaterThan(terroirPotential(site, grape, 0));
    expect(terroirPotential(site, grape, -1)).toBe(terroirPotential(site, grape, 0));
    expect(terroirPotential(site, grape, 2)).toBe(terroirPotential(site, grape, 1));
  });

  it('derives origin prestige from authored reputation alone', () => {
    const site = SITES.hillside;
    const physicalVariant: SiteDefinition = {
      ...site, drainage: 0, sunlight: 1, fertility: 0, altitudeM: 3_000,
      pricePerHaCents: 99_000_000,
    };

    expect(originPrestige(physicalVariant)).toBe(originPrestige(site));
    expect(originPrestige({ ...site, prestige: -1 })).toBe(0);
    expect(originPrestige({ ...site, prestige: 2 })).toBe(1);
    expect(originPrestige(site)).toBeGreaterThanOrEqual(0);
    expect(originPrestige(site)).toBeLessThanOrEqual(1);
  });

  it('values land by authored unit price and area only, rounded to whole cents', () => {
    const site = SITES.hillside;
    const unrelatedVariant: SiteDefinition = {
      ...site, drainage: 0, sunlight: 1, fertility: 0, altitudeM: 3_000, prestige: 0,
    };

    expect(landValueCents(site, 2.5)).toBe(6_000_000);
    expect(landValueCents(unrelatedVariant, 2.5)).toBe(landValueCents(site, 2.5));
    expect(landValueCents({ ...site, pricePerHaCents: 1 }, 1.4)).toBe(1);
    expect(landValueCents(site, 0)).toBe(0);
    expect(() => landValueCents(site, -1)).toThrow(RangeError);
    expect(() => landValueCents(site, Number.NaN)).toThrow(RangeError);
    expect(() => landValueCents({ ...site, pricePerHaCents: -1 }, 1)).toThrow(RangeError);
    expect(() => landValueCents(site, Number.MAX_VALUE)).toThrow(RangeError);
  });

  it('captures immutable origin potential, prestige and current crop year', () => {
    const vineyard = { ...makeVineyard(), cropYear: 2031, condition: 0.72 };
    const origin = createWineOrigin(vineyard);

    expect(origin).toEqual({
      vineyardId: vineyard.id,
      vineyardName: vineyard.name,
      region: SITES[vineyard.siteId].region,
      siteId: vineyard.siteId,
      grapeId: vineyard.grapeId,
      vintage: 2031,
      terroirPotential: terroirPotential(SITES[vineyard.siteId], GRAPES[vineyard.grapeId], vineyard.condition),
      originPrestige: originPrestige(SITES[vineyard.siteId]),
    });
    expect(Object.isFrozen(origin)).toBe(true);
    expect(origin.vintage).not.toBe(vineyard.plantedYear);
    const harvestSnapshot = { ...origin };
    const laterVineyardState = { ...vineyard, cropYear: 2032, condition: 0.2 };
    expect(origin).toEqual(harvestSnapshot);
    expect(createWineOrigin(laterVineyardState).vintage).toBe(2032);
    expect(createWineOrigin(laterVineyardState).terroirPotential).not.toBe(origin.terroirPotential);
  });

  it('produces deterministic bounded potential across the authored prototype catalog', () => {
    for (const site of Object.values(SITES)) {
      for (const grape of Object.values(GRAPES)) {
        for (const condition of [0, 0.25, 0.5, 0.75, 1]) {
          const potential = terroirPotential(site, grape, condition);
          expect(Number.isFinite(potential)).toBe(true);
          expect(potential).toBeGreaterThanOrEqual(0);
          expect(potential).toBeLessThanOrEqual(1);
          expect(potential).toBe(terroirPotential(site, grape, condition));
        }
      }
    }
  });
});
