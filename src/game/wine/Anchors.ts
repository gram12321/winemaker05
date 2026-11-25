import { clamp } from '../core/Numbers';
import { GRAPES } from '../vineyard/Catalog';
import type { GrapeDefinition, Vineyard } from '../vineyard/types';
import type { RawMaterialAnchors, PhysicalLot, WineOrigin } from './types';
import { WINE_MATERIAL_LIMITS } from './MaterialLimits';
import { formatPercent } from '../../shared/numberFormat';

/** Provisional anchor balance values. These describe harvest inheritance, not quality scores. */
export const BASE_GRAPE_SUGAR_G_PER_L = 170;
export const GRAPE_SUGAR_POTENTIAL_G_PER_L = 90;
export const RIPENESS_SUGAR_FACTOR_MIN = 0.76;
export const RIPENESS_SUGAR_FACTOR_SPAN = 0.33;
export const NOBLE_ROT_SUGAR_CONCENTRATION = 0.12;
export const ROT_SUGAR_LOSS = 0.2;
export const TERROIR_ANCHOR_FACTOR_MIN = 0.9;
export const TERROIR_ANCHOR_FACTOR_SPAN = 0.2;
export const RIPENESS_ACIDITY_BASE = 1.15;
export const RIPENESS_ACIDITY_REDUCTION = 0.28;
export const CONDITION_ACIDITY_BASE = 0.94;
export const CONDITION_ACIDITY_FACTOR = 0.06;
export const RIPENESS_PHENOLIC_BASE = 0.65;
export const RIPENESS_PHENOLIC_SPAN = 0.35;
export const ROT_PHENOLIC_LOSS = 0.18;
export const NOBLE_ROT_PHENOLIC_BONUS = 0.06;
export const CONDITION_AROMA_BASE = 0.55;
export const CONDITION_AROMA_SPAN = 0.45;
export const TERROIR_AROMA_BASE = 0.82;
export const TERROIR_AROMA_SPAN = 0.18;
export const CONDITION_BODY_BASE = 0.7;
export const CONDITION_BODY_SPAN = 0.3;
export const TERROIR_BODY_BASE = 0.88;
export const TERROIR_BODY_SPAN = 0.12;
export const TERROIR_AGING_BASE = 0.82;
export const TERROIR_AGING_SPAN = 0.18;
export const ROT_AGING_LOSS = 0.4;
export const NOBLE_ROT_AGING_BONUS = 0.04;
export const FLAVOR_RETENTION_MIN = 0.45;
export const FLAVOR_RETENTION_MAX = 1.08;
export const NOBLE_ROT_EFFECTIVE_ROT_REDUCTION = 0.25;
export const ROT_FLAVOR_LOSS = 0.35;
export const NOBLE_ROT_FLAVOR_BONUS = 0.12;

const MIN_SUGAR_G_PER_L = 0;
const MAX_SUGAR_G_PER_L = WINE_MATERIAL_LIMITS.sugarGPerL;

function isFiniteBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function assertHarvestInputs(vineyard: Vineyard, grape: GrapeDefinition, terroirPotential: number): void {
  if (!vineyard || typeof vineyard !== 'object') throw new TypeError('Vineyard must be an object.');
  if (!grape || typeof grape !== 'object') throw new TypeError('Grape definition must be an object.');
  if (vineyard.grapeId !== grape.id) throw new RangeError('Vineyard and grape definition must identify the same variety.');
  if (!isFiniteBetween(vineyard.ripeness, 0, 1)) throw new RangeError('Vineyard ripeness must be between 0 and 1.');
  if (!isFiniteBetween(vineyard.condition, 0, 1)) throw new RangeError('Vineyard condition must be between 0 and 1.');
  if (!isFiniteBetween(vineyard.rot, 0, 1)) throw new RangeError('Vineyard rot must be between 0 and 1.');
  if (!isFiniteBetween(vineyard.nobleRot, 0, 1)) throw new RangeError('Noble rot must be between 0 and 1.');
  if (!isFiniteBetween(terroirPotential, 0, 1)) throw new RangeError('Terroir Potential must be between 0 and 1.');
  for (const [label, value] of Object.entries({
    sugar: grape.sugar,
    acidity: grape.acidity,
    phenolics: grape.phenolics,
    aromatics: grape.aromatics,
    body: grape.body,
    aging: grape.aging,
  })) {
    if (!isFiniteBetween(value, 0, 1)) throw new RangeError(`Grape ${label} potential must be between 0 and 1.`);
  }
}

/** Capture a harvest-time baseline. Later operations must never rewrite this snapshot. */
export function deriveHarvestAnchors(
  vineyard: Vineyard,
  grape: GrapeDefinition,
  terroirPotential: number,
): RawMaterialAnchors {
  assertHarvestInputs(vineyard, grape, terroirPotential);

  const ripeness = vineyard.ripeness;
  const condition = vineyard.condition;
  const rot = clamp(vineyard.rot - vineyard.nobleRot * NOBLE_ROT_EFFECTIVE_ROT_REDUCTION);
  const terroirFactor = TERROIR_ANCHOR_FACTOR_MIN + TERROIR_ANCHOR_FACTOR_SPAN * terroirPotential;
  const healthyVineFactor = CONDITION_BODY_BASE + CONDITION_BODY_SPAN * condition;
  const ripeSugarFactor = RIPENESS_SUGAR_FACTOR_MIN + RIPENESS_SUGAR_FACTOR_SPAN * ripeness;
  const flavorRetention = clamp(1 - rot * ROT_FLAVOR_LOSS + vineyard.nobleRot * NOBLE_ROT_FLAVOR_BONUS, FLAVOR_RETENTION_MIN, FLAVOR_RETENTION_MAX);

  const sugarGPerL = clamp(
    (BASE_GRAPE_SUGAR_G_PER_L + grape.sugar * GRAPE_SUGAR_POTENTIAL_G_PER_L)
      * ripeSugarFactor
      * (1 + vineyard.nobleRot * NOBLE_ROT_SUGAR_CONCENTRATION)
      * (1 - rot * ROT_SUGAR_LOSS),
    MIN_SUGAR_G_PER_L,
    MAX_SUGAR_G_PER_L,
  );
  const acidity = clamp(grape.acidity
    * (RIPENESS_ACIDITY_BASE - RIPENESS_ACIDITY_REDUCTION * ripeness)
    * (CONDITION_ACIDITY_BASE + CONDITION_ACIDITY_FACTOR * condition));
  const phenolics = clamp(grape.phenolics
    * (RIPENESS_PHENOLIC_BASE + RIPENESS_PHENOLIC_SPAN * ripeness)
    * (1 - rot * ROT_PHENOLIC_LOSS + vineyard.nobleRot * NOBLE_ROT_PHENOLIC_BONUS)
    * terroirFactor);
  const aromatics = clamp(grape.aromatics
    * (CONDITION_AROMA_BASE + CONDITION_AROMA_SPAN * condition)
    * (TERROIR_AROMA_BASE + TERROIR_AROMA_SPAN * terroirPotential)
    * flavorRetention);
  const body = clamp(grape.body * healthyVineFactor * (TERROIR_BODY_BASE + TERROIR_BODY_SPAN * terroirPotential));
  const agingPotential = clamp(grape.aging * healthyVineFactor
    * (TERROIR_AGING_BASE + TERROIR_AGING_SPAN * terroirPotential)
    * (1 - rot * ROT_AGING_LOSS + vineyard.nobleRot * NOBLE_ROT_AGING_BONUS));

  return Object.freeze({ sugarGPerL, acidity, phenolics, aromatics, body, agingPotential });
}

/** Create the physical grape material at harvest; inventory owns its quantity. */
export function createHarvestLot(input: {
  readonly id: string;
  readonly wineId: string;
  readonly name: string;
  readonly origin: WineOrigin;
  readonly vineyard: Vineyard;
  readonly week: number;
}): PhysicalLot {
  if (!input || typeof input !== 'object') throw new TypeError('Harvest lot details must be an object.');
  const { id, wineId, name, origin, vineyard, week } = input;
  if (typeof id !== 'string' || id.trim().length === 0) throw new RangeError('Lot ID must not be empty.');
  if (typeof wineId !== 'string' || wineId.trim().length === 0) throw new RangeError('Wine ID must not be empty.');
  if (typeof name !== 'string' || name.trim().length === 0) throw new RangeError('Lot name must not be empty.');
  if (!Number.isSafeInteger(week) || week < 0) throw new RangeError('Harvest week must be a non-negative safe integer.');
  if (!origin || typeof origin !== 'object') throw new TypeError('Wine origin must be an object.');
  if (origin.vineyardId !== vineyard.id || origin.vineyardName !== vineyard.name) {
    throw new RangeError('Wine origin must identify the harvested vineyard.');
  }
  if (origin.siteId !== vineyard.siteId || origin.grapeId !== vineyard.grapeId || origin.vintage !== vineyard.cropYear) {
    throw new RangeError('Wine origin site, grape and vintage must match the harvested vineyard.');
  }
  if (!Number.isSafeInteger(origin.vintage)) throw new RangeError('Wine vintage must be a safe integer.');
  if (!isFiniteBetween(origin.terroirPotential, 0, 1) || !isFiniteBetween(origin.originPrestige, 0, 1)) {
    throw new RangeError('Wine origin potential and prestige must be between 0 and 1.');
  }
  const grape = GRAPES[vineyard.grapeId];
  if (!grape) throw new RangeError('The vineyard grape is not present in the current catalogue.');
  const anchors = deriveHarvestAnchors(vineyard, grape, origin.terroirPotential);
  const greenCharacter = clamp(1 - vineyard.ripeness);
  const effectiveRot = clamp(vineyard.rot - vineyard.nobleRot * NOBLE_ROT_EFFECTIVE_ROT_REDUCTION);
  const lotOrigin = Object.freeze({ ...origin });
  const source = Object.freeze({ origin: lotOrigin, anchors, fraction: 1 });

  return Object.freeze({
    id: id.trim(),
    wineId: wineId.trim(),
    name: name.trim(),
    form: 'grapes',
    origin: lotOrigin,
    anchors,
    physical: Object.freeze({
      sugarGPerL: anchors.sugarGPerL,
      alcoholPct: 0,
      acidity: anchors.acidity,
      phenolics: 0,
      remainingPhenolics: anchors.phenolics,
      aroma: anchors.aromatics,
      yeastActivity: 0.12 + 0.18 * vineyard.condition,
      oxygenExposure: 0,
      oxidation: 0,
      maturation: 0,
      oak: 0,
      lees: 0,
      greenCharacter,
      rot: effectiveRot,
      ageDays: 0,
      developmentAgeDays: 0,
    }),
    processes: Object.freeze({
      fermenting: false,
      skinContact: false,
      temperatureC: grape.preferredTemperatureC,
      leesContact: false,
    }),
    parentIds: Object.freeze([]),
    sources: Object.freeze([source]),
    history: Object.freeze([{ week, action: 'harvested', detail: `Harvested from ${vineyard.name} at ${formatPercent(vineyard.ripeness, { fractionDigits: 0 })} ripeness, ${formatPercent(vineyard.nobleRot, { fractionDigits: 0 })} noble rot and ${formatPercent(vineyard.rot, { fractionDigits: 0 })} grey rot; raw material anchors were fixed at harvest.` }]),
    bottling: null,
  });
}
