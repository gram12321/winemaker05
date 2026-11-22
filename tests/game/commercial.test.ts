import { describe, expect, it } from 'vitest';
import { assessWine } from '../../src/game/evaluation/Assessment';
import { quoteWine, acceptContract, advanceContracts, contractEligibility, createContractOffers, recordSale } from '../../src/game/commercial/Rules';
import type { BuyerId, CommercialState, Sale, WineContract } from '../../src/game/commercial/types';
import type { GrapeId } from '../../src/game/vineyard/types';
import type { PhysicalLot } from '../../src/game/wine/types';

function lot(grapeId: GrapeId = 'pinot-noir', form: PhysicalLot['form'] = 'bottled'): PhysicalLot {
  const origin = {
    vineyardId: 'vineyard-slope', vineyardName: 'North Slope', region: 'Upper Valley',
    siteId: 'hillside', grapeId, vintage: 2030, terroirPotential: 0.7, originPrestige: 0.6,
  } as const;
  const anchors = { sugarGPerL: 215, acidity: 0.68, phenolics: 0.57, aromatics: 0.74, body: 0.54, agingPotential: 0.66 } as const;
  return {
    id: 'lot-pinot', wineId: 'wine-pinot', name: 'Pinot Noir 2030', form, origin, anchors,
    physical: {
      sugarGPerL: 20, alcoholPct: 12, acidity: 0.6, phenolics: 0.3, remainingPhenolics: 0.27,
      aroma: 0.7, yeastActivity: 0.35, oxygenExposure: 0, oxidation: 0, maturation: 0.58,
      oak: 0.12, lees: 0.18, greenCharacter: 0, rot: 0, ageDays: 360,
    },
    processes: { fermenting: false, skinContact: false, temperatureC: 18, leesContact: false },
    parentIds: [], sources: [{ origin, anchors, fraction: 1 }], history: [],
    bottling: { week: 10, structure: 0.7, taste: 0.7, quality: 0.7 },
  };
}

function state(contracts: readonly WineContract[] = []): CommercialState {
  return {
    customers: [
      { id: 'local-merchant', relationship: 0.5, bottlesBought: 0 },
      { id: 'restaurant', relationship: 0.5, bottlesBought: 0 },
      { id: 'collector', relationship: 0.5, bottlesBought: 0 },
    ],
    contracts,
    sales: [],
  };
}

function unwrapQuote(result: ReturnType<typeof quoteWine>) {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

describe('commercial NPC buyers and contracts', () => {
  it('creates deterministic offers with fixed differentiated terms and planning time', () => {
    const first = createContractOffers(4);
    expect(createContractOffers(4)).toEqual(first);
    expect(first.map(contract => contract.buyerId)).toEqual(['local-merchant', 'restaurant', 'collector']);
    expect(first.map(contract => contract.bottles)).toEqual([24, 48, 12]);
    expect(first.every(contract => contract.status === 'offered' && contract.dueWeek === 20)).toBe(true);
    expect(first.every(contract => Number.isSafeInteger(contract.pricePerBottleCents) && contract.pricePerBottleCents > 0)).toBe(true);
    expect(new Set(first.map(contract => contract.id)).size).toBe(3);
    expect(createContractOffers(8).map(contract => contract.id)).not.toEqual(first.map(contract => contract.id));
  });

  it('allows acceptance and delivery through the exact due week, then resolves missed deadlines once', () => {
    const [offer] = createContractOffers(2);
    const accepted = acceptContract(offer, offer.dueWeek);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(acceptContract(offer, offer.dueWeek + 1)).toMatchObject({ ok: false });

    const dueState = advanceContracts(state([accepted.value]), offer.dueWeek);
    expect(dueState.contracts[0].status).toBe('accepted');
    expect(contractEligibility(accepted.value, lot(), assessWine(lot()), 6, offer.dueWeek).eligible).toBe(true);

    const defaulted = advanceContracts(dueState, offer.dueWeek + 1);
    expect(defaulted.contracts[0].status).toBe('defaulted');
    expect(defaulted.customers[0].relationship).toBeLessThan(0.5);
    expect(advanceContracts(defaulted, offer.dueWeek + 2)).toBe(defaulted);
  });

  it('expires unaccepted offers and applies the offer relationship consequence only on transition', () => {
    const [offer] = createContractOffers(1);
    const beforeDeadline = advanceContracts(state([offer]), offer.dueWeek);
    expect(beforeDeadline.contracts[0].status).toBe('offered');
    const expired = advanceContracts(beforeDeadline, offer.dueWeek + 1);
    expect(expired.contracts[0].status).toBe('expired');
    expect(expired.customers[0].relationship).toBeLessThan(0.5);
    expect(advanceContracts(expired, offer.dueWeek + 3)).toBe(expired);
  });

  it('checks current assessment thresholds and allows partial allocations within the contract target', () => {
    const merchant = createContractOffers(1)[0];
    const accepted = acceptContract(merchant, 1);
    if (!accepted.ok) throw new Error(accepted.reason);
    const bottled = lot();
    const assessment = assessWine(bottled);
    expect(contractEligibility(accepted.value, bottled, assessment, 1, 1).eligible).toBe(true);
    expect(contractEligibility(accepted.value, bottled, assessment, merchant.bottles + 1, 1).eligible).toBe(false);
    expect(contractEligibility(accepted.value, { ...bottled, form: 'wine' }, assessment, 1, 1).reasons).toContain('Contracts require bottled wine.');

    const demanding = { ...accepted.value, minimumStructure: 1, minimumTaste: 1, minimumAgeDays: 500 };
    const refusal = contractEligibility(demanding, bottled, assessment, 1, 1);
    expect(refusal.eligible).toBe(false);
    expect(refusal.reasons.join(' ')).toMatch(/Structure.*requires/);
    expect(refusal.reasons.join(' ')).toMatch(/Taste fit.*requires/);
    expect(refusal.reasons.join(' ')).toMatch(/at least 500 days old/);
  });

  it('requires every source of a specified-grape contract blend to match', () => {
    const collector = createContractOffers(1)[2];
    const accepted = acceptContract(collector, 1);
    if (!accepted.ok) throw new Error(accepted.reason);
    const pinot = lot();
    const chardonnay = lot('chardonnay');
    const mixed = {
      ...pinot,
      sources: [
        { ...pinot.sources[0], fraction: 0.75 },
        { ...chardonnay.sources[0], fraction: 0.25 },
      ],
    };
    const result = contractEligibility(accepted.value, mixed, assessWine(mixed), 4, 1);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('This contract requires Pinot Noir, and every source in the blend must match.');
  });

  it('weights Origin Prestige across all blend sources exactly once and ignores Terroir Potential for price', () => {
    const pinot = lot();
    const chardonnay = lot('chardonnay');
    const mixed = {
      ...pinot,
      sources: [
        { ...pinot.sources[0], fraction: 0.75, origin: { ...pinot.origin, originPrestige: 0.2 } },
        { ...chardonnay.sources[0], fraction: 0.25, origin: { ...chardonnay.origin, originPrestige: 0.8 } },
      ],
    };
    const blendedQuote = unwrapQuote(quoteWine(mixed, assessWine(mixed), 'local-merchant', 0.5, 1));
    const differentPrimaryOrigin = {
      ...mixed,
      origin: { ...mixed.origin, originPrestige: 1, terroirPotential: 0 },
    };
    expect(unwrapQuote(quoteWine(differentPrimaryOrigin, assessWine(differentPrimaryOrigin), 'local-merchant', 0.5, 1)).pricePerBottleCents)
      .toBe(blendedQuote.pricePerBottleCents);

    const allHigh = {
      ...mixed,
      sources: mixed.sources.map(source => ({ ...source, origin: { ...source.origin, originPrestige: 1 } })),
    };
    const highQuote = unwrapQuote(quoteWine(allHigh, assessWine(allHigh), 'local-merchant', 0.5, 1));
    const expectedRatio = (1 + 0.08) / (1 + 0.08 * (0.75 * 0.2 + 0.25 * 0.8));
    expect(highQuote.pricePerBottleCents / blendedQuote.pricePerBottleCents).toBeCloseTo(expectedRatio, 2);
    expect(blendedQuote.reasons.some(reason => reason.includes('all blend sources') && reason.includes('applied once'))).toBe(true);
  });

  it('quotes only physical bottles with safe whole-cent totals and rejects invalid inputs', () => {
    const bottled = lot();
    const assessment = assessWine(bottled);
    for (const form of ['grapes', 'must', 'wine'] as const) {
      expect(quoteWine({ ...bottled, form }, assessment, 'local-merchant', 0.5, 1)).toMatchObject({ ok: false });
    }
    expect(quoteWine(bottled, assessment, 'invalid' as BuyerId, 0.5, 1)).toMatchObject({ ok: false });
    expect(quoteWine(bottled, assessment, 'local-merchant', 0.5, 0)).toMatchObject({ ok: false });
    expect(quoteWine(bottled, assessment, 'local-merchant', 0.5, 1.5)).toMatchObject({ ok: false });
    expect(quoteWine(bottled, assessment, 'local-merchant', 0.5, Number.MAX_SAFE_INTEGER)).toMatchObject({ ok: false });

    const quote = unwrapQuote(quoteWine(bottled, assessment, 'local-merchant', 0.5, 3));
    expect(Number.isSafeInteger(quote.pricePerBottleCents)).toBe(true);
    expect(Number.isSafeInteger(quote.totalCents)).toBe(true);
    expect(quote.totalCents).toBe(quote.pricePerBottleCents * 3);
    expect(quote.reasons.length).toBeGreaterThanOrEqual(4);
  });

  it('rewards different buyer style preferences without requiring one universal taste profile', () => {
    const pinot = lot('pinot-noir');
    const sauvignon = lot('sauvignon-blanc');
    const pinotAssessment = assessWine(pinot);
    const sauvignonAssessment = assessWine(sauvignon);
    const restaurantPinot = unwrapQuote(quoteWine(pinot, pinotAssessment, 'restaurant', 0.5, 1)).pricePerBottleCents;
    const restaurantSauvignon = unwrapQuote(quoteWine(sauvignon, sauvignonAssessment, 'restaurant', 0.5, 1)).pricePerBottleCents;
    const collectorPinot = unwrapQuote(quoteWine(pinot, pinotAssessment, 'collector', 0.5, 1)).pricePerBottleCents;
    const collectorSauvignon = unwrapQuote(quoteWine(sauvignon, sauvignonAssessment, 'collector', 0.5, 1)).pricePerBottleCents;
    expect(restaurantSauvignon).toBeGreaterThan(restaurantPinot);
    expect(collectorPinot).toBeGreaterThan(collectorSauvignon);
  });

  it('uses the assessment fault reduction once, refuses extreme faults, and lets maturity value decline', () => {
    const moderateFaultLot = { ...lot(), physical: { ...lot().physical, oxidation: 0.72, oxygenExposure: 1.2 } };
    const assessedFault = assessWine(moderateFaultLot);
    expect(assessedFault.faults.some(fault => fault.code === 'oxidation')).toBe(true);
    const withFaults = unwrapQuote(quoteWine(moderateFaultLot, assessedFault, 'local-merchant', 0.5, 1));
    const sameQualityWithoutFaultInput = unwrapQuote(quoteWine(
      moderateFaultLot,
      { ...assessedFault, faults: [] },
      'local-merchant',
      0.5,
      1,
    ));
    expect(withFaults.pricePerBottleCents).toBe(sameQualityWithoutFaultInput.pricePerBottleCents);

    const severeLot = { ...moderateFaultLot, physical: { ...moderateFaultLot.physical, oxidation: 0.97 } };
    expect(quoteWine(severeLot, assessWine(severeLot), 'local-merchant', 0.5, 1)).toMatchObject({ ok: false });
    const accepted = acceptContract(createContractOffers(1)[0], 1);
    if (!accepted.ok) throw new Error(accepted.reason);
    expect(contractEligibility({ ...accepted.value, minimumStructure: 0, minimumTaste: 0 }, severeLot, assessWine(severeLot), 1, 1).reasons.join(' ')).toContain('severe oxidation');

    const atEarlierMaturity = {
      ...lot(),
      physical: { ...lot().physical, ageDays: 400, maturation: 1.2 },
    };
    const pastPreferredWindow = {
      ...atEarlierMaturity,
      physical: { ...atEarlierMaturity.physical, ageDays: 730 },
    };
    const earlierQuote = unwrapQuote(quoteWine(atEarlierMaturity, assessWine(atEarlierMaturity), 'local-merchant', 0.5, 1));
    const olderQuote = unwrapQuote(quoteWine(pastPreferredWindow, assessWine(pastPreferredWindow), 'local-merchant', 0.5, 1));
    expect(olderQuote.pricePerBottleCents).toBeLessThan(earlierQuote.pricePerBottleCents);
  });

  it('records a sale immutably and makes repeated sale IDs idempotent', () => {
    const original = state();
    const sale: Sale = { id: 'sale-1', week: 8, lotId: 'lot-pinot', buyerId: 'local-merchant', bottles: 6, revenueCents: 3_000, contractId: null };
    const before = structuredClone(original);
    const recorded = recordSale(original, sale);
    expect(original).toEqual(before);
    expect(recorded.sales).toEqual([sale]);
    expect(recorded.customers[0].bottlesBought).toBe(6);
    expect(recorded.customers[0].relationship).toBeGreaterThan(0.5);
    expect(recordSale(recorded, sale)).toBe(recorded);
    expect(recorded.sales).toHaveLength(1);
    expect(recorded.customers[0].bottlesBought).toBe(6);
    expect(recorded.customers[0].relationship).toBeGreaterThan(0.5);
  });

  it('keeps relationship gains independent of sale splitting and credits a contract only once', () => {
    const offer = createContractOffers(1)[0];
    const accepted = acceptContract(offer, 1);
    if (!accepted.ok) throw new Error(accepted.reason);

    const oneContractLine = recordSale(state([accepted.value]), {
      id: 'contract-sale-whole', week: 4, lotId: 'lot-pinot', buyerId: 'local-merchant',
      bottles: offer.bottles, revenueCents: offer.pricePerBottleCents * offer.bottles, contractId: offer.id,
    });
    const firstContractLot = recordSale(state([accepted.value]), {
      id: 'contract-sale-part-a', week: 4, lotId: 'lot-pinot-a', buyerId: 'local-merchant',
      bottles: 9, revenueCents: offer.pricePerBottleCents * 9, contractId: offer.id,
    });
    const splitContractLines = recordSale(firstContractLot, {
      id: 'contract-sale-part-b', week: 4, lotId: 'lot-pinot-b', buyerId: 'local-merchant',
      bottles: offer.bottles - 9, revenueCents: offer.pricePerBottleCents * (offer.bottles - 9), contractId: offer.id,
    });
    expect(splitContractLines.customers[0].relationship).toBe(oneContractLine.customers[0].relationship);
    expect(splitContractLines.customers[0].bottlesBought).toBe(offer.bottles);
    expect(splitContractLines.sales).toHaveLength(2);

    const directWhole = recordSale(state(), {
      id: 'direct-sale-whole', week: 4, lotId: 'lot-pinot', buyerId: 'local-merchant',
      bottles: offer.bottles, revenueCents: 4_000, contractId: null,
    });
    const directPartA = recordSale(state(), {
      id: 'direct-sale-part-a', week: 4, lotId: 'lot-pinot-a', buyerId: 'local-merchant',
      bottles: 9, revenueCents: 1_500, contractId: null,
    });
    const directSplit = recordSale(directPartA, {
      id: 'direct-sale-part-b', week: 4, lotId: 'lot-pinot-b', buyerId: 'local-merchant',
      bottles: offer.bottles - 9, revenueCents: 2_500, contractId: null,
    });
    expect(directSplit.customers[0].relationship).toBe(directWhole.customers[0].relationship);
  });
});
