import { clamp, failure, success, type RuleResult } from '../core/Numbers';
import { deriveTaste } from '../evaluation/Taste';
import type { TasteFamily, TasteProfile, WineAssessment } from '../evaluation/types';
import type { PhysicalLot } from '../wine/types';
import type { BuyerId, CommercialState, Sale, WineContract } from './types';
import { formatNumber, formatPercent as displayPercent } from '../../shared/numberFormat';

interface BuyerPricingProfile {
  readonly name: string;
  readonly basePricePerBottleCents: number;
  readonly qualityFloor: number;
  readonly qualityRange: number;
  readonly styleFloor: number;
  readonly styleRange: number;
  readonly preferredDevelopment: number;
  readonly maturityFloor: number;
  readonly maturityRange: number;
  readonly originPrestigePremium: number;
  readonly relationshipRange: number;
  readonly tastePreference: TasteProfile;
  readonly tasteWeights: TasteProfile;
}

/** Provisional commercial balance. Origin Prestige affects market value, never wine quality. */
export const COMMERCIAL_BALANCE = Object.freeze({
  offerDurationWeeks: 16,
  offerExpiryRelationshipLoss: 0.01,
  defaultRelationshipLoss: 0.04,
  saleRelationshipGainPerBottle: 0.00025,
  maturityPreferenceSpan: 0.7,
  severeFaultRefusalThreshold: 0.95,
});

/** Buyers value different styles and maturity windows; these are 05 tuning values, not 04 formulas. */
export const BUYER_PRICING_PROFILES: Readonly<Record<BuyerId, BuyerPricingProfile>> = Object.freeze({
  'local-merchant': Object.freeze({
    name: 'Local merchant', basePricePerBottleCents: 460,
    qualityFloor: 0.68, qualityRange: 0.75,
    styleFloor: 0.94, styleRange: 0.14,
    preferredDevelopment: 0.42, maturityFloor: 0.86, maturityRange: 0.22,
    originPrestigePremium: 0.08, relationshipRange: 0.16,
    tastePreference: Object.freeze({ redFruit: 0.48, darkFruit: 0.48, citrus: 0.48, floral: 0.48, herbal: 0.48, earth: 0.48, oak: 0.48, aged: 0.48 }),
    tasteWeights: Object.freeze({ redFruit: 1, darkFruit: 1, citrus: 1, floral: 1, herbal: 1, earth: 1, oak: 1, aged: 1 }),
  }),
  restaurant: Object.freeze({
    name: 'Restaurant', basePricePerBottleCents: 820,
    qualityFloor: 0.58, qualityRange: 0.92,
    styleFloor: 0.78, styleRange: 0.44,
    preferredDevelopment: 0.58, maturityFloor: 0.78, maturityRange: 0.4,
    originPrestigePremium: 0.2, relationshipRange: 0.18,
    tastePreference: Object.freeze({ redFruit: 0.34, darkFruit: 0.3, citrus: 0.72, floral: 0.68, herbal: 0.58, earth: 0.38, oak: 0.34, aged: 0.4 }),
    tasteWeights: Object.freeze({ redFruit: 0.55, darkFruit: 0.45, citrus: 1.45, floral: 1.25, herbal: 1.05, earth: 0.6, oak: 0.65, aged: 0.75 }),
  }),
  collector: Object.freeze({
    name: 'Collector', basePricePerBottleCents: 1_480,
    qualityFloor: 0.48, qualityRange: 1.16,
    styleFloor: 0.75, styleRange: 0.48,
    preferredDevelopment: 0.72, maturityFloor: 0.72, maturityRange: 0.5,
    originPrestigePremium: 0.34, relationshipRange: 0.22,
    tastePreference: Object.freeze({ redFruit: 0.56, darkFruit: 0.62, citrus: 0.28, floral: 0.36, herbal: 0.34, earth: 0.58, oak: 0.66, aged: 0.76 }),
    tasteWeights: Object.freeze({ redFruit: 0.9, darkFruit: 1.2, citrus: 0.35, floral: 0.45, herbal: 0.4, earth: 1.1, oak: 1.35, aged: 1.55 }),
  }),
});

interface ContractOfferTerms {
  readonly grapeId: WineContract['grapeId'];
  readonly bottles: number;
  readonly minimumStructure: number;
  readonly minimumTaste: number;
  readonly minimumAgeDays: number;
  readonly pricePerBottleCents: number;
}

const CONTRACT_OFFER_TERMS: Readonly<Record<BuyerId, ContractOfferTerms>> = Object.freeze({
  'local-merchant': Object.freeze({ grapeId: null, bottles: 24, minimumStructure: 0.35, minimumTaste: 0.25, minimumAgeDays: 0, pricePerBottleCents: 510 }),
  restaurant: Object.freeze({ grapeId: null, bottles: 48, minimumStructure: 0.52, minimumTaste: 0.42, minimumAgeDays: 28, pricePerBottleCents: 930 }),
  collector: Object.freeze({ grapeId: 'pinot-noir', bottles: 12, minimumStructure: 0.67, minimumTaste: 0.6, minimumAgeDays: 180, pricePerBottleCents: 1_760 }),
});

const BUYER_IDS: readonly BuyerId[] = ['local-merchant', 'restaurant', 'collector'];
const TASTE_FAMILIES: readonly TasteFamily[] = ['redFruit', 'darkFruit', 'citrus', 'floral', 'herbal', 'earth', 'oak', 'aged'];
const GRAPE_NAMES: Readonly<Record<WineContract['grapeId'] & string, string>> = {
  'pinot-noir': 'Pinot Noir',
  tempranillo: 'Tempranillo',
  'sauvignon-blanc': 'Sauvignon Blanc',
  chardonnay: 'Chardonnay',
};

function isBuyerId(value: unknown): value is BuyerId {
  return typeof value === 'string' && (BUYER_IDS as readonly string[]).includes(value);
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validAssessment(assessment: WineAssessment): boolean {
  return !!assessment
    && isUnitInterval(assessment.quality)
    && isUnitInterval(assessment.structure?.score)
    && isUnitInterval(assessment.taste?.score)
    && Array.isArray(assessment.faults)
    && assessment.faults.every(fault => typeof fault.code === 'string' && isUnitInterval(fault.severity));
}

function sourceOrigins(lot: PhysicalLot): readonly { readonly origin: PhysicalLot['origin']; readonly fraction: number }[] {
  return lot.sources.length > 0
    ? lot.sources.map(source => ({ origin: source.origin, fraction: source.fraction }))
    : [{ origin: lot.origin, fraction: 1 }];
}

function weightedOriginValue(lot: PhysicalLot, value: (origin: PhysicalLot['origin']) => number): number | null {
  const sources = sourceOrigins(lot);
  let weightedTotal = 0;
  let totalFraction = 0;
  for (const source of sources) {
    if (!Number.isFinite(source.fraction) || source.fraction <= 0 || !isUnitInterval(value(source.origin))) return null;
    weightedTotal += source.fraction * value(source.origin);
    totalFraction += source.fraction;
  }
  return totalFraction > 0 && Number.isFinite(weightedTotal)
    ? weightedTotal / totalFraction
    : null;
}

function buyerStyleFit(profile: BuyerPricingProfile, taste: TasteProfile): number {
  let weightedFit = 0;
  let totalWeight = 0;
  for (const family of TASTE_FAMILIES) {
    const weight = profile.tasteWeights[family];
    weightedFit += weight * (1 - Math.abs(taste[family] - profile.tastePreference[family]));
    totalWeight += weight;
  }
  return totalWeight > 0 ? clamp(weightedFit / totalWeight) : 0;
}

function refusedFault(assessment: WineAssessment) {
  return assessment.faults.find(fault =>
    (fault.code === 'oxidation' || fault.code === 'spoilage')
      && fault.severity >= COMMERCIAL_BALANCE.severeFaultRefusalThreshold);
}

/** Stable company-local NPC contract terms for a calendar week. */
export function createContractOffers(week: number): readonly WineContract[] {
  if (!Number.isSafeInteger(week) || week < 0 || !Number.isSafeInteger(week + COMMERCIAL_BALANCE.offerDurationWeeks)) return Object.freeze([]);
  return Object.freeze(BUYER_IDS.map(buyerId => {
    const terms = CONTRACT_OFFER_TERMS[buyerId];
    return Object.freeze({
      id: `${buyerId}-offer-w${week}`,
      buyerId,
      ...terms,
      dueWeek: week + COMMERCIAL_BALANCE.offerDurationWeeks,
      status: 'offered' as const,
    });
  }));
}

/** Apply deadline transitions once; terminal contracts never receive repeated relationship losses. */
export function advanceContracts(state: CommercialState, week: number): CommercialState {
  if (!Number.isSafeInteger(week) || week < 0) return state;

  const relationshipLosses = new Map<BuyerId, number>();
  let changed = false;
  const contracts = state.contracts.map(contract => {
    if (week <= contract.dueWeek) return contract;
    if (contract.status === 'offered') {
      changed = true;
      relationshipLosses.set(contract.buyerId, (relationshipLosses.get(contract.buyerId) ?? 0) + COMMERCIAL_BALANCE.offerExpiryRelationshipLoss);
      return Object.freeze({ ...contract, status: 'expired' as const });
    }
    if (contract.status === 'accepted') {
      changed = true;
      relationshipLosses.set(contract.buyerId, (relationshipLosses.get(contract.buyerId) ?? 0) + COMMERCIAL_BALANCE.defaultRelationshipLoss);
      return Object.freeze({ ...contract, status: 'defaulted' as const });
    }
    return contract;
  });

  if (!changed) return state;
  const customers = state.customers.map(customer => {
    const loss = relationshipLosses.get(customer.id) ?? 0;
    return loss > 0 ? Object.freeze({ ...customer, relationship: clamp(customer.relationship - loss) }) : customer;
  });
  return Object.freeze({ ...state, customers: Object.freeze(customers), contracts: Object.freeze(contracts) });
}

/** Accept an open offer through its exact due week. */
export function acceptContract(contract: WineContract, week: number): RuleResult<WineContract> {
  if (contract.status !== 'offered') return failure('This contract is no longer an open offer.');
  if (!Number.isSafeInteger(week) || week < 0) return failure('The current week is invalid.');
  if (week > contract.dueWeek) return failure('This offer has expired.');
  return success(Object.freeze({ ...contract, status: 'accepted' }));
}

/** Price only finished bottles using live evaluation, buyer taste, maturity and source-weighted prestige. */
export function quoteWine(
  lot: PhysicalLot,
  assessment: WineAssessment,
  buyerId: BuyerId,
  relationship: number,
  bottles: number,
): RuleResult<{ readonly pricePerBottleCents: number; readonly totalCents: number; readonly reasons: readonly string[] }> {
  if (!isBuyerId(buyerId)) return failure('Choose a valid wine buyer.');
  if (lot.form !== 'bottled') return failure('Only bottled wine can be sold.');
  if (!validAssessment(assessment)) return failure('The current wine assessment is invalid.');
  if (!Number.isFinite(relationship) || relationship < 0 || relationship > 1) return failure('Buyer relationship must be between 0 % and 100 %.');
  if (!Number.isSafeInteger(bottles) || bottles <= 0) return failure('Enter a positive whole number of bottles.');

  const severeFault = refusedFault(assessment);
  if (severeFault) return failure(`This wine cannot be sold because of a severe ${severeFault.code === 'spoilage' ? 'spoilage' : 'oxidation'} fault.`);

  const buyer = BUYER_PRICING_PROFILES[buyerId];
  const prestige = weightedOriginValue(lot, origin => origin.originPrestige);
  if (prestige === null || !Number.isSafeInteger(lot.physical.ageDays) || lot.physical.ageDays < 0
    || !Number.isSafeInteger(lot.physical.developmentAgeDays) || lot.physical.developmentAgeDays < 0
    || lot.physical.developmentAgeDays > lot.physical.ageDays || !Number.isFinite(lot.physical.maturation) || lot.physical.maturation < 0) {
    return failure('The wine has invalid origin or maturity information.');
  }

  const taste = deriveTaste(lot);
  const styleFit = buyerStyleFit(buyer, taste.families);
  const development = taste.development.progress;
  const maturityFit = clamp(1 - Math.abs(development - buyer.preferredDevelopment) / COMMERCIAL_BALANCE.maturityPreferenceSpan);
  const qualityFactor = buyer.qualityFloor + buyer.qualityRange * assessment.quality;
  const styleFactor = buyer.styleFloor + buyer.styleRange * styleFit;
  const maturityFactor = buyer.maturityFloor + buyer.maturityRange * maturityFit;
  const originFactor = 1 + buyer.originPrestigePremium * prestige;
  const relationshipFactor = 1 + buyer.relationshipRange * (relationship - 0.5);
  const computedPrice = Math.round(
    buyer.basePricePerBottleCents * qualityFactor * styleFactor * maturityFactor * originFactor * relationshipFactor,
  );
  const totalCents = computedPrice * bottles;
  if (!Number.isSafeInteger(computedPrice) || computedPrice <= 0 || !Number.isSafeInteger(totalCents)) {
    return failure('This quantity is too large to price safely in whole cents.');
  }

  const developmentLabel = development < buyer.preferredDevelopment - COMMERCIAL_BALANCE.maturityPreferenceSpan
    ? 'still developing'
    : development > buyer.preferredDevelopment + COMMERCIAL_BALANCE.maturityPreferenceSpan
      ? 'past this buyer’s preferred maturity window'
      : 'within this buyer’s preferred maturity window';
  const reasons = [
    `Current assessed quality is ${displayPercent(assessment.quality, { fractionDigits: 0 })}; the assessment already accounts for the strongest physical fault once.`,
    `${buyer.name} style fit is ${displayPercent(styleFit, { fractionDigits: 0 })} from the wine’s current taste profile.`,
    `The wine is ${developmentLabel}.`,
    `Origin Prestige is ${displayPercent(prestige, { fractionDigits: 0 })} across all blend sources by their fractions and is applied once.`,
    `Buyer relationship adjusts the quote to ${formatNumber(relationshipFactor, { fractionDigits: 2 })}×.`,
  ];
  return success(Object.freeze({
    pricePerBottleCents: computedPrice,
    totalCents,
    reasons: Object.freeze(reasons),
  }));
}

/** Validate one allocation; the command owner checks aggregate contract quantity and reservations. */
export function contractEligibility(
  contract: WineContract,
  lot: PhysicalLot,
  assessment: WineAssessment,
  bottles: number,
  week: number,
): { readonly eligible: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  if (contract.status !== 'accepted') reasons.push('Accept this contract before reserving or delivering wine.');
  if (!Number.isSafeInteger(week) || week < 0) reasons.push('The current week is invalid.');
  else if (week > contract.dueWeek) reasons.push('This contract is past its delivery week.');
  if (lot.form !== 'bottled') reasons.push('Contracts require bottled wine.');
  if (!Number.isSafeInteger(bottles) || bottles <= 0) reasons.push('Allocate a positive whole number of bottles.');
  else if (!Number.isSafeInteger(contract.bottles) || bottles > contract.bottles) reasons.push(`This allocation cannot exceed the contract target of ${formatNumber(contract.bottles, { fractionDigits: 0 })} bottles.`);
  if (!validAssessment(assessment)) reasons.push('The current wine assessment is invalid.');
  else {
    const severeFault = refusedFault(assessment);
    if (severeFault) reasons.push(`The buyer refuses wine with severe ${severeFault.code}.`);
    if (assessment.structure.score < contract.minimumStructure) reasons.push(`Structure is ${displayPercent(assessment.structure.score, { fractionDigits: 0 })}; this contract requires ${displayPercent(contract.minimumStructure, { fractionDigits: 0 })}.`);
    if (assessment.taste.score < contract.minimumTaste) reasons.push(`Taste fit is ${displayPercent(assessment.taste.score, { fractionDigits: 0 })}; this contract requires ${displayPercent(contract.minimumTaste, { fractionDigits: 0 })}.`);
  }
  if (!Number.isSafeInteger(lot.physical.ageDays) || lot.physical.ageDays < 0
    || !Number.isSafeInteger(lot.physical.developmentAgeDays) || lot.physical.developmentAgeDays < 0
    || lot.physical.developmentAgeDays > lot.physical.ageDays
    || lot.physical.developmentAgeDays < contract.minimumAgeDays) {
    reasons.push(`This contract requires wine at least ${formatNumber(contract.minimumAgeDays, { fractionDigits: 0 })} days old.`);
  }
  if (contract.grapeId !== null) {
    const requiredGrape = GRAPE_NAMES[contract.grapeId];
    const sources = lot.sources.length > 0 ? lot.sources : [{ origin: lot.origin, anchors: lot.anchors, fraction: 1 }];
    if (!sources.every(source => source.origin.grapeId === contract.grapeId)) {
      reasons.push(`This contract requires ${requiredGrape}, and every source in the blend must match.`);
    }
  }
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/** Append one sale and its customer outcome, rejecting any record that cannot be applied. */
export function recordSale(state: CommercialState, sale: Sale): RuleResult<CommercialState> {
  if (state.sales.some(existing => existing.id === sale.id)) return failure('This sale has already been recorded.');
  if (typeof sale.id !== 'string' || sale.id.length === 0 || !isBuyerId(sale.buyerId)
    || !Number.isSafeInteger(sale.week) || sale.week < 0
    || typeof sale.lotId !== 'string' || sale.lotId.length === 0
    || !Number.isSafeInteger(sale.bottles) || sale.bottles <= 0
    || !Number.isSafeInteger(sale.revenueCents) || sale.revenueCents < 0
    || (sale.contractId !== null && (typeof sale.contractId !== 'string' || sale.contractId.length === 0))) {
    return failure('The sale record is invalid.');
  }

  const customerIndex = state.customers.findIndex(customer => customer.id === sale.buyerId);
  if (customerIndex < 0) return failure('The sale buyer is unavailable.');
  const customer = state.customers[customerIndex];
  const bottlesBought = customer.bottlesBought + sale.bottles;
  if (!Number.isSafeInteger(bottlesBought)) return failure('The customer bottle total exceeds supported whole-bottle precision.');
  if (!isUnitInterval(customer.relationship)) return failure('The customer relationship is invalid.');
  const contractAlreadyCredited = sale.contractId !== null
    && state.sales.some(existing => existing.contractId === sale.contractId);
  const relationshipBottles = sale.contractId === null
    ? sale.bottles
    : contractAlreadyCredited
      ? 0
      : state.contracts.find(contract => contract.id === sale.contractId)?.bottles ?? sale.bottles;

  const customers = state.customers.map((existing, index) => index === customerIndex
    ? Object.freeze({
      ...existing,
      // Direct sales scale with quantity. Contract credit uses the fixed target once,
      // so splitting delivery into multiple lot lines cannot create extra goodwill.
      relationship: clamp(existing.relationship + COMMERCIAL_BALANCE.saleRelationshipGainPerBottle * relationshipBottles),
      bottlesBought,
    })
    : existing);
  return success(Object.freeze({
    ...state,
    customers: Object.freeze(customers),
    sales: Object.freeze([...state.sales, Object.freeze({ ...sale })]),
  }));
}
