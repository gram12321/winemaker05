import { clamp, failure, success, type RuleResult } from '../core/Numbers';
import type { BottlingAssessment, PhysicalLot, PhysicalState, ProcessSettings, RawMaterialAnchors, WineOrigin } from './types';
import { WINE_MATERIAL_LIMITS } from './MaterialLimits';

/** Provisional cellar balance values. Inventory continues to own every amount. */
export const MIN_PRESS_INTENSITY = 0;
export const MAX_PRESS_INTENSITY = 1;
export const BASE_PRESS_YIELD_ML_PER_KG = 620;
export const PRESS_INTENSITY_YIELD_ML_PER_KG = 180;
export const DESTEM_PRESS_YIELD_DELTA_ML_PER_KG = 8;
export const SKIN_CONTACT_PRESS_YIELD_DELTA_ML_PER_KG = -20;
export const MIN_PRESS_YIELD_ML_PER_KG = 500;
export const MAX_PRESS_YIELD_ML_PER_KG = 850;
export const BASE_PHENOLIC_EXTRACTION_FRACTION = 0.22;
export const PRESS_INTENSITY_EXTRACTION_FRACTION = 0.52;
export const SKIN_CONTACT_EXTRACTION_FRACTION = 0.16;
export const DESTEM_EXTRACTION_REDUCTION = 0.05;
export const MAX_PRESS_EXTRACTION_FRACTION = 0.9;
export const PRESS_OXYGEN_BASE = 0.025;
export const PRESS_OXYGEN_INTENSITY_FACTOR = 0.12;
export const PRESS_OXYGEN_DESTEM_FACTOR = 0.02;
export const PRESS_OXIDATION_FACTOR = 0.04;
export const PRESS_GREEN_INTENSITY_FACTOR = 0.04;
export const PRESS_GREEN_STEM_FACTOR = 0.06;
export const BOTTLING_MAX_SUGAR_G_PER_L = 4;
export const BOTTLING_MIN_ALCOHOL_PCT = 5;
export const MIN_FERMENTABLE_SUGAR_G_PER_L = BOTTLING_MAX_SUGAR_G_PER_L;
export const FERMENTATION_MIN_TEMPERATURE_C = 2;
export const FERMENTATION_MAX_TEMPERATURE_C = 40;
export const FERMENTATION_VIABLE_YEAST_ACTIVITY = 0.24;
export const ASSESSMENT_SCORE_MIN = 0;
export const ASSESSMENT_SCORE_MAX = 1;

const ANCHOR_MAX_SUGAR_G_PER_L = WINE_MATERIAL_LIMITS.sugarGPerL;
const PHYSICAL_MAX_SUGAR_G_PER_L = WINE_MATERIAL_LIMITS.sugarGPerL;
const PHYSICAL_MAX_ALCOHOL_PCT = WINE_MATERIAL_LIMITS.alcoholPct;
const NORMALIZED_EPSILON = 1e-9;

function isRecord<T>(value: T): value is T & Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Preserve declared readonly element types while checking the runtime container.
function hasArrayShape(value: unknown): boolean { return Array.isArray(value); }

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeWeek(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validOrigin(origin: WineOrigin): boolean {
  return isRecord(origin)
    && isNonemptyString(origin.vineyardId)
    && isNonemptyString(origin.vineyardName)
    && isNonemptyString(origin.region)
    && isNonemptyString(origin.siteId)
    && isNonemptyString(origin.grapeId)
    && typeof origin.vintage === 'number'
    && Number.isSafeInteger(origin.vintage)
    && isBetween(origin.terroirPotential, 0, 1)
    && isBetween(origin.originPrestige, 0, 1);
}

function validAnchors(anchors: RawMaterialAnchors): boolean {
  return isRecord(anchors)
    && isBetween(anchors.sugarGPerL, 0, ANCHOR_MAX_SUGAR_G_PER_L)
    && isBetween(anchors.acidity, 0, 1)
    && isBetween(anchors.phenolics, 0, 1)
    && isBetween(anchors.aromatics, 0, 1)
    && isBetween(anchors.body, 0, 1)
    && isBetween(anchors.agingPotential, 0, 1);
}

function validPhysical(physical: PhysicalState): boolean {
  return isRecord(physical)
    && isBetween(physical.sugarGPerL, 0, PHYSICAL_MAX_SUGAR_G_PER_L)
    && isBetween(physical.alcoholPct, 0, PHYSICAL_MAX_ALCOHOL_PCT)
    && isBetween(physical.acidity, 0, 1)
    && isBetween(physical.phenolics, 0, 1)
    && isBetween(physical.remainingPhenolics, 0, 1)
    && isBetween(physical.aroma, 0, 1)
    && isBetween(physical.yeastActivity, 0, 1)
    && isBetween(physical.oxygenExposure, 0, Number.MAX_VALUE)
    && isBetween(physical.oxidation, 0, 1)
    && isBetween(physical.maturation, 0, Number.MAX_VALUE)
    && isBetween(physical.oak, 0, 1)
    && isBetween(physical.lees, 0, 1)
    && isBetween(physical.greenCharacter, 0, 1)
    && isBetween(physical.rot, 0, 1)
    && isSafeWeek(physical.ageDays);
}

function validProcesses(processes: ProcessSettings): boolean {
  return isRecord(processes)
    && typeof processes.fermenting === 'boolean'
    && typeof processes.skinContact === 'boolean'
    && isBetween(processes.temperatureC, FERMENTATION_MIN_TEMPERATURE_C, FERMENTATION_MAX_TEMPERATURE_C)
    && typeof processes.leesContact === 'boolean';
}

function validAssessment(assessment: BottlingAssessment): boolean {
  return isRecord(assessment)
    && isSafeWeek(assessment.week)
    && isBetween(assessment.structure, ASSESSMENT_SCORE_MIN, ASSESSMENT_SCORE_MAX)
    && isBetween(assessment.taste, ASSESSMENT_SCORE_MIN, ASSESSMENT_SCORE_MAX)
    && isBetween(assessment.quality, ASSESSMENT_SCORE_MIN, ASSESSMENT_SCORE_MAX);
}

function lotProblem(lot: PhysicalLot): string | null {
  if (!isRecord(lot)) return 'Wine lot must be an object.';
  if (!isNonemptyString(lot.id) || !isNonemptyString(lot.wineId) || !isNonemptyString(lot.name)) return 'Wine lot IDs and name must not be empty.';
  if (!['grapes', 'must', 'wine', 'bottled'].includes(lot.form)) return 'Wine lot has an unsupported material form.';
  if (!validOrigin(lot.origin)) return 'Wine lot origin is invalid.';
  if (!validAnchors(lot.anchors)) return 'Wine lot raw material anchors are invalid.';
  if (!validPhysical(lot.physical)) return 'Wine lot physical state is invalid.';
  if (lot.physical.phenolics + lot.physical.remainingPhenolics > lot.anchors.phenolics + NORMALIZED_EPSILON) {
    return 'Wine lot phenolics and remaining extractable capacity exceed inherited phenolic potential.';
  }
  if (!validProcesses(lot.processes)) return 'Wine lot process settings are invalid.';
  if (lot.processes.fermenting && !['must', 'wine'].includes(lot.form)) return 'Active fermentation requires must or wine.';
  if (!hasArrayShape(lot.parentIds) || lot.parentIds.some(parentId => !isNonemptyString(parentId))) return 'Wine lot lineage is invalid.';
  if (!hasArrayShape(lot.sources) || lot.sources.length === 0) return 'Wine lot must retain at least one source.';
  let sourceTotal = 0;
  for (const source of lot.sources) {
    if (!isRecord(source) || !validOrigin(source.origin) || !validAnchors(source.anchors) || !isBetween(source.fraction, 0, 1)) {
      return 'Wine lot source lineage is invalid.';
    }
    sourceTotal += source.fraction;
  }
  if (!Number.isFinite(sourceTotal) || Math.abs(sourceTotal - 1) > NORMALIZED_EPSILON) return 'Wine lot source fractions must sum to 1.';
  if (!hasArrayShape(lot.history) || lot.history.some(event => !isRecord(event) || !isSafeWeek(event.week) || !isNonemptyString(event.action) || typeof event.detail !== 'string')) {
    return 'Wine lot history is invalid.';
  }
  if (lot.history.some((event, index) => index > 0 && event.week < lot.history[index - 1]!.week)) return 'Wine lot history must be chronological.';
  if (lot.form === 'bottled') {
    if (!lot.bottling || !validAssessment(lot.bottling)) return 'Bottled wine must retain its historical assessment.';
  } else if (lot.bottling !== null) {
    return 'Unbottled wine cannot already have a bottling assessment.';
  }
  return null;
}

function validNextWeek(lot: PhysicalLot, week: number): string | null {
  if (!isSafeWeek(week)) return 'Operation week must be a non-negative safe integer.';
  const lastWeek = lot.history.at(-1)?.week ?? 0;
  if (week < lastWeek) return 'Operation week cannot precede the lot history.';
  return null;
}

function copyOrigin(origin: WineOrigin): WineOrigin {
  return Object.freeze({ ...origin });
}

function copyAnchors(anchors: RawMaterialAnchors): RawMaterialAnchors {
  return Object.freeze({ ...anchors });
}

function copyPhysical(physical: PhysicalState): PhysicalState {
  return Object.freeze({ ...physical });
}

function copyProcesses(processes: ProcessSettings): ProcessSettings {
  return Object.freeze({ ...processes });
}

function copyAssessment(assessment: BottlingAssessment | null): BottlingAssessment | null {
  return assessment ? Object.freeze({ ...assessment }) : null;
}

function copySources(lot: PhysicalLot): PhysicalLot['sources'] {
  return Object.freeze(lot.sources.map(source => Object.freeze({
    origin: copyOrigin(source.origin),
    anchors: copyAnchors(source.anchors),
    fraction: source.fraction,
  })));
}

function addHistory(lot: PhysicalLot, week: number, action: string, detail: string): PhysicalLot['history'] {
  return Object.freeze([
    ...lot.history.map(event => Object.freeze({ ...event })),
    Object.freeze({ week, action, detail }),
  ]);
}

function copiedLot(lot: PhysicalLot): PhysicalLot {
  return Object.freeze({
    ...lot,
    origin: copyOrigin(lot.origin),
    anchors: copyAnchors(lot.anchors),
    physical: copyPhysical(lot.physical),
    processes: copyProcesses(lot.processes),
    parentIds: Object.freeze([...lot.parentIds]),
    sources: copySources(lot),
    history: Object.freeze(lot.history.map(event => Object.freeze({ ...event }))),
    bottling: copyAssessment(lot.bottling),
  });
}

function operationFailure(lot: PhysicalLot, week: number): string | null {
  return lotProblem(lot) ?? validNextWeek(lot, week);
}

/** Press whole grapes once; yield and extraction are finite and inventory stays outside wine. */
export function pressLot(
  lot: PhysicalLot,
  intensity: number,
  destem: boolean,
  skinContact: boolean,
  week: number,
): RuleResult<{ readonly lot: PhysicalLot; readonly mlPerKg: number }> {
  const problem = operationFailure(lot, week);
  if (problem) return failure(problem);
  if (lot.form !== 'grapes') return failure('Only whole grapes can be pressed.');
  if (!isBetween(intensity, MIN_PRESS_INTENSITY, MAX_PRESS_INTENSITY)) return failure('Press intensity must be between 0 and 1.');
  if (typeof destem !== 'boolean' || typeof skinContact !== 'boolean') return failure('Pressing options must be boolean values.');

  const mlPerKg = clamp(
    BASE_PRESS_YIELD_ML_PER_KG
      + PRESS_INTENSITY_YIELD_ML_PER_KG * intensity
      + (destem ? DESTEM_PRESS_YIELD_DELTA_ML_PER_KG : 0)
      + (skinContact ? SKIN_CONTACT_PRESS_YIELD_DELTA_ML_PER_KG : 0),
    MIN_PRESS_YIELD_ML_PER_KG,
    MAX_PRESS_YIELD_ML_PER_KG,
  );
  const extractionFraction = clamp(
    BASE_PHENOLIC_EXTRACTION_FRACTION
      + PRESS_INTENSITY_EXTRACTION_FRACTION * intensity
      + (skinContact ? SKIN_CONTACT_EXTRACTION_FRACTION : 0)
      - (destem ? DESTEM_EXTRACTION_REDUCTION : 0),
    0,
    MAX_PRESS_EXTRACTION_FRACTION,
  );
  const extractedPhenolics = Math.min(lot.physical.remainingPhenolics, lot.anchors.phenolics * extractionFraction);
  const oxygenAdded = PRESS_OXYGEN_BASE
    + PRESS_OXYGEN_INTENSITY_FACTOR * intensity
    + (destem ? PRESS_OXYGEN_DESTEM_FACTOR : 0);
  const detail = `Pressed at intensity ${intensity.toFixed(2)}${destem ? ', destemmed' : ', whole-cluster'}${skinContact ? ' with skin contact' : ' without skin contact'}; extracted ${extractedPhenolics.toFixed(3)} of finite phenolic potential.`;
  const next: PhysicalLot = Object.freeze({
    ...copiedLot(lot),
    form: 'must',
    physical: Object.freeze({
      ...lot.physical,
      phenolics: Math.min(lot.anchors.phenolics, lot.physical.phenolics + extractedPhenolics),
      remainingPhenolics: Math.max(0, lot.physical.remainingPhenolics - extractedPhenolics),
      oxygenExposure: lot.physical.oxygenExposure + oxygenAdded,
      oxidation: clamp(lot.physical.oxidation + oxygenAdded * PRESS_OXIDATION_FACTOR),
      greenCharacter: clamp(lot.physical.greenCharacter + intensity * PRESS_GREEN_INTENSITY_FACTOR + (destem ? 0 : PRESS_GREEN_STEM_FACTOR)),
    }),
    processes: Object.freeze({
      ...lot.processes,
      fermenting: false,
      skinContact,
    }),
    history: addHistory(lot, week, 'pressed', detail),
  });
  return success(Object.freeze({ lot: next, mlPerKg }));
}

/** Copy a lot into an independently developing portion; inventory balances the two quantities. */
export function splitLot(lot: PhysicalLot, newId: string, week: number): PhysicalLot {
  const problem = operationFailure(lot, week);
  if (problem) throw new RangeError(problem);
  if (!isNonemptyString(newId) || newId.trim() === lot.id) throw new RangeError('Split lot ID must be nonempty and different from its parent.');
  const copy = copiedLot(lot);
  return Object.freeze({
    ...copy,
    id: newId.trim(),
    parentIds: Object.freeze([lot.id]),
    history: addHistory(lot, week, 'split', `Created an independent portion from ${lot.id}; inventory amount remains externally balanced.`),
  });
}

function weightedMean<T extends object>(items: readonly { value: T; weight: number }[]): T {
  const first = items[0];
  if (!first) throw new RangeError('A weighted mean requires at least one value.');
  const keys = Object.keys(first.value) as (keyof T)[];
  const result: Record<string, number> = {};
  for (const key of keys) {
    const property = String(key);
    const mean = items.reduce((sum, item) => sum + Number((item.value as unknown as Record<string, number>)[property]) * item.weight, 0);
    result[property] = mean;
  }
  return result as unknown as T;
}

function sourceKey(origin: WineOrigin, anchors: RawMaterialAnchors): string {
  return JSON.stringify([
    origin.vineyardId, origin.vineyardName, origin.region, origin.siteId, origin.grapeId,
    origin.vintage, origin.terroirPotential, origin.originPrestige,
    anchors.sugarGPerL, anchors.acidity, anchors.phenolics, anchors.aromatics, anchors.body, anchors.agingPotential,
  ]);
}

function blendSources(inputs: readonly { readonly lot: PhysicalLot; readonly weight: number }[]): PhysicalLot['sources'] {
  const grouped = new Map<string, { origin: WineOrigin; anchors: RawMaterialAnchors; fraction: number }>();
  for (const input of inputs) {
    for (const source of input.lot.sources) {
      const fraction = input.weight * source.fraction;
      const key = sourceKey(source.origin, source.anchors);
      const previous = grouped.get(key);
      if (previous) previous.fraction += fraction;
      else grouped.set(key, { origin: source.origin, anchors: source.anchors, fraction });
    }
  }
  const sources = [...grouped.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, source]) => Object.freeze({
    origin: copyOrigin(source.origin),
    anchors: copyAnchors(source.anchors),
    fraction: source.fraction,
  }));
  const sum = sources.reduce((total, source) => total + source.fraction, 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > NORMALIZED_EPSILON) throw new RangeError('Blended source fractions must sum to 1.');
  return Object.freeze(sources);
}

/** Blend same-form must or wine by physical quantity, preserving source shares and raw baselines. */
export function blendLots(
  inputs: readonly { readonly lot: PhysicalLot; readonly quantity: number }[],
  newId: string,
  name: string,
  week: number,
): RuleResult<PhysicalLot> {
  if (!hasArrayShape(inputs) || inputs.length < 2) return failure('A blend requires at least two lots.');
  if (!isNonemptyString(newId) || !isNonemptyString(name)) return failure('Blend ID and name must not be empty.');
  if (!isSafeWeek(week)) return failure('Blend week must be a non-negative safe integer.');
  const seenIds = new Set<string>();
  let totalQuantity = 0;
  for (const input of inputs) {
    if (!isRecord(input) || !isBetween(input.quantity, 1, Number.MAX_SAFE_INTEGER) || !Number.isSafeInteger(input.quantity)) {
      return failure('Blend quantities must be positive safe integers.');
    }
    const problem = lotProblem(input.lot);
    if (problem) return failure(problem);
    const nextWeekProblem = validNextWeek(input.lot, week);
    if (nextWeekProblem) return failure(nextWeekProblem);
    if (seenIds.has(input.lot.id)) return failure('A lot can only appear once in a blend.');
    seenIds.add(input.lot.id);
    totalQuantity += input.quantity;
    if (!Number.isSafeInteger(totalQuantity)) return failure('Combined blend quantity exceeds the supported range.');
  }

  const first = inputs[0]!.lot;
  if (newId.trim() === first.id || seenIds.has(newId.trim())) return failure('Blend ID must be different from every source lot.');
  if (inputs.some(input => input.lot.form !== first.form) || !['must', 'wine'].includes(first.form)) {
    return failure('Only lots in the same liquid form (must or wine) can be blended.');
  }
  const orderedInputs = [...inputs].sort((left, right) => left.lot.id < right.lot.id ? -1 : left.lot.id > right.lot.id ? 1 : 0);
  const weights = orderedInputs.map(input => ({ lot: input.lot, weight: input.quantity / totalQuantity }));
  const physicalRaw = weightedMean(weights.map(({ lot, weight }) => ({ value: lot.physical, weight })));
  const anchorsRaw = weightedMean(weights.map(({ lot, weight }) => ({ value: lot.anchors, weight })));
  const physical: PhysicalState = Object.freeze({ ...physicalRaw, ageDays: Math.round(physicalRaw.ageDays) });
  const anchors: RawMaterialAnchors = Object.freeze(anchorsRaw);
  if (physical.phenolics > anchors.phenolics + NORMALIZED_EPSILON) return failure('Blend phenolics cannot exceed weighted inherited phenolic capacity.');
  const sources = blendSources(weights);
  const dominantSource = sources.reduce((dominant, source) => source.fraction > dominant.fraction ? source : dominant, sources[0]!);
  const latestHistoryWeek = orderedInputs.reduce((latest, input) => input.lot.history.reduce((value, event) => Math.max(value, event.week), latest), 0);
  if (week < latestHistoryWeek) return failure('Blend week cannot precede source lot history.');
  const blendProcessSettings: ProcessSettings = Object.freeze({
    fermenting: weights.some(({ lot }) => lot.processes.fermenting),
    skinContact: weights.some(({ lot }) => lot.processes.skinContact),
    temperatureC: weightedMean(weights.map(({ lot, weight }) => ({ value: { temperatureC: lot.processes.temperatureC }, weight }))).temperatureC,
    leesContact: weights.some(({ lot }) => lot.processes.leesContact),
  });
  const lot: PhysicalLot = Object.freeze({
    id: newId.trim(),
    wineId: newId.trim(),
    name: name.trim(),
    form: first.form,
    origin: copyOrigin(dominantSource.origin),
    anchors,
    physical,
    processes: blendProcessSettings,
    parentIds: Object.freeze(orderedInputs.map(input => input.lot.id)),
    sources,
    history: Object.freeze([
      Object.freeze({ week, action: 'blended', detail: `Blended ${inputs.length} lots by quantity; source fractions retain their physical shares. Earlier histories remain with parent lots ${orderedInputs.map(input => input.lot.id).join(', ')}.` }),
    ]),
    bottling: null,
  });
  return success(lot);
}

/** Report the exact physical blockers before asking inventory to bottle a lot. */
export function canBottle(lot: PhysicalLot): { readonly ready: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  const problem = lotProblem(lot);
  if (problem) reasons.push(problem);
  else {
    if (lot.form !== 'wine') reasons.push('Only wine can be bottled.');
    if (lot.physical.sugarGPerL > BOTTLING_MAX_SUGAR_G_PER_L) reasons.push(`Sugar must be at or below ${BOTTLING_MAX_SUGAR_G_PER_L} g/L.`);
    if (lot.physical.alcoholPct < BOTTLING_MIN_ALCOHOL_PCT) reasons.push(`Alcohol must be at least ${BOTTLING_MIN_ALCOHOL_PCT}%.`);
    if (lot.processes.fermenting) reasons.push('Fermentation must be inactive before bottling.');
    if (lot.bottling !== null) reasons.push('Wine that already has a bottling assessment cannot be bottled again.');
  }
  return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/** Configure, start or restart fermentation without creating sugar in dry wine. */
export function configureFermentation(
  lot: PhysicalLot,
  settings: { readonly temperatureC: number; readonly skinContact: boolean; readonly leesContact: boolean },
  week: number,
): RuleResult<PhysicalLot> {
  const problem = operationFailure(lot, week);
  if (problem) return failure(problem);
  if (!['must', 'wine'].includes(lot.form)) return failure('Fermentation can only be configured for must or wine.');
  if (!isRecord(settings)
    || !isBetween(settings.temperatureC, FERMENTATION_MIN_TEMPERATURE_C, FERMENTATION_MAX_TEMPERATURE_C)
    || typeof settings.skinContact !== 'boolean'
    || typeof settings.leesContact !== 'boolean') {
    return failure(`Fermentation settings require a temperature from ${FERMENTATION_MIN_TEMPERATURE_C} to ${FERMENTATION_MAX_TEMPERATURE_C} C and boolean process choices.`);
  }
  const fermenting = lot.physical.sugarGPerL > MIN_FERMENTABLE_SUGAR_G_PER_L;
  const yeastActivity = fermenting
    ? Math.max(lot.physical.yeastActivity, FERMENTATION_VIABLE_YEAST_ACTIVITY)
    : lot.physical.yeastActivity;
  const detail = fermenting
    ? `Fermentation enabled at ${settings.temperatureC} C; viable yeast activity restored to at least ${FERMENTATION_VIABLE_YEAST_ACTIVITY.toFixed(2)}.`
    : `Dry wine settings changed at ${settings.temperatureC} C; fermentation remains inactive and sugar is unchanged.`;
  return success(Object.freeze({
    ...copiedLot(lot),
    physical: Object.freeze({ ...lot.physical, yeastActivity }),
    processes: Object.freeze({
      fermenting,
      temperatureC: settings.temperatureC,
      skinContact: settings.skinContact,
      leesContact: settings.leesContact,
    }),
    history: addHistory(lot, week, fermenting ? 'fermentation.configured' : 'fermentation.controlled-dry', detail),
  }));
}

/** Bottle dry, finished wine while retaining its full physical development and assessment. */
export function bottleLot(
  lot: PhysicalLot,
  newId: string,
  week: number,
  assessment: BottlingAssessment,
): RuleResult<PhysicalLot> {
  const readiness = canBottle(lot);
  if (!readiness.ready) return failure(readiness.reasons.join(' '));
  const nextWeekProblem = validNextWeek(lot, week);
  if (nextWeekProblem) return failure(nextWeekProblem);
  if (!isNonemptyString(newId) || newId.trim() === lot.id) return failure('Bottled lot ID must be nonempty and different from its source.');
  if (!validAssessment(assessment) || assessment.week !== week) return failure('Bottling assessment must contain bounded scores for the bottling week.');
  const copy = copiedLot(lot);
  return success(Object.freeze({
    ...copy,
    id: newId.trim(),
    form: 'bottled',
    processes: Object.freeze({ ...lot.processes, fermenting: false, skinContact: false, leesContact: false }),
    parentIds: Object.freeze([lot.id]),
    history: addHistory(lot, week, 'bottled', `Bottled at week ${week}; the physical development and assessment snapshot were retained.`),
    bottling: Object.freeze({ ...assessment }),
  }));
}
