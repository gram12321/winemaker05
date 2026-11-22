import { describe, expect, it } from 'vitest';

import { assessWine } from '../../src/game/evaluation/Assessment';
import { deriveTaste } from '../../src/game/evaluation/Taste';
import { acceptContract, contractEligibility, createContractOffers, quoteWine } from '../../src/game/commercial/Rules';
import { readCompanyState } from '../../src/game/core/CompanyState';
import { forecastLot } from '../../src/game/queries/CompanyView';
import { companyStateAt } from '../helpers/CompanyState';
import { createWineOrigin } from '../../src/game/vineyard/Origin';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import { developLot } from '../../src/game/wine/Development';
import { bottleLot, configureFermentation, pressLot } from '../../src/game/wine/Operations';
import type { PhysicalLot, WineEnvironment } from '../../src/game/wine/types';

const stillEnvironment: WineEnvironment = {
  temperatureC: 15,
  oxygenIngress: 0,
  oakStrength: 0,
  contaminationRisk: 0,
};

function harvestedGrapes(id: string): PhysicalLot {
  const created = createVineyard({
    id: `vineyard-${id}`,
    name: 'North Slope',
    siteId: 'hillside',
    grapeId: 'pinot-noir',
    areaHa: 1,
    year: 2030,
  });
  if (!created.ok) throw new Error(created.reason);
  const vineyard = { ...created.value.vineyard, ripeness: 1, condition: 0.9, cropKg: 1_000 };
  const grapes = createHarvestLot({
    id,
    wineId: `wine-${id}`,
    name: 'Pinot Noir 2030',
    origin: createWineOrigin(vineyard),
    vineyard,
    week: 0,
  });
  return grapes;
}

function pressedMust(id = 'lot-age'): PhysicalLot {
  const pressed = pressLot(harvestedGrapes(id), 0.4, true, false, 0);
  if (!pressed.ok) throw new Error(pressed.reason);
  return {
    ...pressed.value.lot,
    physical: { ...pressed.value.lot.physical, greenCharacter: 0 },
  };
}

function fermentAndBottle(source: PhysicalLot, newId: string): PhysicalLot {
  const configured = configureFermentation(source, {
    temperatureC: 20,
    skinContact: false,
    leesContact: false,
  }, 0);
  if (!configured.ok) throw new Error(configured.reason);
  let wine = configured.value;
  let days = 0;
  while (wine.processes.fermenting && days < 90) {
    wine = developLot(wine, stillEnvironment, 1).lot;
    days += 1;
  }
  if (wine.processes.fermenting || wine.form !== 'wine') throw new Error('Fermentation did not finish.');
  const current = assessWine(wine);
  const bottled = bottleLot(wine, newId, 0, {
    week: 0,
    structure: current.structure.score,
    taste: current.taste.score,
    quality: current.quality,
  });
  if (!bottled.ok) throw new Error(bottled.reason);
  return bottled.value;
}

function snapshotWithMust(lot: PhysicalLot) {
  const state = companyStateAt();
  const snapshot = readCompanyState({
    ...state,
    sequence: 2,
    winery: { lots: [lot], archivedLots: [] },
    inventory: {
      holdings: [{ lotId: lot.id, quantity: 500_000, unit: 'ml', location: 'vessel', vesselId: 'starter-tank' }],
      reservations: [],
    },
  });
  if (snapshot.kind !== 'valid') throw new Error(snapshot.reasons.join(' '));
  return snapshot.state;
}

describe('wine-development age', () => {
  it('keeps idle grapes and must on elapsed lot age until the exact maturation threshold', () => {
    const grapes = harvestedGrapes('lot-grapes');
    const idleGrapes = developLot(grapes, stillEnvironment, 7).lot;
    expect(idleGrapes.physical.ageDays).toBe(7);
    expect(idleGrapes.physical.developmentAgeDays).toBe(0);

    const must = pressedMust();
    const idleMust = developLot(must, stillEnvironment, 182).lot;
    expect(idleMust.physical.ageDays).toBe(182);
    expect(idleMust.physical.developmentAgeDays).toBe(0);
    expect(idleMust.physical.maturation).toBe(0);
    expect(deriveTaste(idleMust).families.aged).toBe(deriveTaste(must).families.aged);

    const belowThreshold = {
      ...must,
      physical: { ...must.physical, alcoholPct: 4.99 },
    };
    const notYetMaturing = developLot(belowThreshold, stillEnvironment, 1).lot;
    expect(notYetMaturing.physical.developmentAgeDays).toBe(0);
    expect(notYetMaturing.physical.maturation).toBe(0);

    const atThreshold = {
      ...must,
      physical: { ...must.physical, alcoholPct: 5 },
    };
    const maturing = developLot(atThreshold, stillEnvironment, 1).lot;
    expect(maturing.physical.developmentAgeDays).toBe(1);
    expect(maturing.physical.maturation).toBeGreaterThan(0);
  });

  it('does not reward 182 days of unfermented storage with aged taste, buyer maturity, or contract age', () => {
    const freshMust = pressedMust('lot-fresh');
    const storedMust = developLot(freshMust, stillEnvironment, 182).lot;
    const freshBottle = fermentAndBottle(freshMust, 'lot-fresh-bottle');
    const storedBottle = fermentAndBottle(storedMust, 'lot-stored-bottle');

    expect(storedBottle.physical.ageDays - freshBottle.physical.ageDays).toBe(182);
    expect(storedBottle.physical.developmentAgeDays).toBe(freshBottle.physical.developmentAgeDays);
    expect(storedBottle.physical.developmentAgeDays).toBeLessThan(180);
    expect(deriveTaste(storedBottle)).toEqual(deriveTaste(freshBottle));

    const freshAssessment = assessWine(freshBottle);
    const storedAssessment = assessWine(storedBottle);
    const freshQuote = quoteWine(freshBottle, freshAssessment, 'collector', 0.5, 1);
    const storedQuote = quoteWine(storedBottle, storedAssessment, 'collector', 0.5, 1);
    expect(storedQuote).toEqual(freshQuote);

    const offer = createContractOffers(1)[2];
    const accepted = acceptContract(offer, 1);
    if (!accepted.ok) throw new Error(accepted.reason);
    const isolatedAgeRequirement = { ...accepted.value, minimumStructure: 0, minimumTaste: 0 };
    const eligibility = contractEligibility(isolatedAgeRequirement, storedBottle, storedAssessment, 1, 1);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain('This contract requires wine at least 180 days old.');
  });

  it('forecasts idle stored must without turning elapsed lot time into wine-development age', () => {
    const fresh = pressedMust('lot-forecast');
    const stored = developLot(fresh, stillEnvironment, 182).lot;
    const freshBefore = structuredClone(fresh);
    const freshForecast = forecastLot(snapshotWithMust(fresh), fresh, 12);
    const storedForecast = forecastLot(snapshotWithMust(stored), stored, 12);

    expect(stored.physical.developmentAgeDays).toBe(0);
    expect(stored.physical.ageDays).toBe(182);
    expect(storedForecast).toEqual(freshForecast);
    expect(fresh).toEqual(freshBefore);
  });

  it('requires wine-development age in current snapshots and rejects impossible age ordering', () => {
    const lot = pressedMust('lot-validation');
    expect(snapshotWithMust(lot).winery.lots[0]?.physical.developmentAgeDays).toBe(0);

    const { developmentAgeDays: _requiredField, ...oldPhysicalShape } = lot.physical;
    const missingField = { ...lot, physical: oldPhysicalShape };
    expect(readCompanyState({
      ...companyStateAt(), sequence: 2,
      winery: { lots: [missingField], archivedLots: [] },
      inventory: { holdings: [{ lotId: lot.id, quantity: 500_000, unit: 'ml', location: 'vessel', vesselId: 'starter-tank' }], reservations: [] },
    }).kind).toBe('invalid');

    const impossible = { ...lot, physical: { ...lot.physical, ageDays: 10, developmentAgeDays: 11 } };
    expect(readCompanyState({
      ...companyStateAt(), sequence: 2,
      winery: { lots: [impossible], archivedLots: [] },
      inventory: { holdings: [{ lotId: lot.id, quantity: 500_000, unit: 'ml', location: 'vessel', vesselId: 'starter-tank' }], reservations: [] },
    }).kind).toBe('invalid');
  });
});
