import { clamp, failure, success, type RuleResult } from '../core/Numbers';
import type { CalendarState } from '../calendar/Calendar';
import { GRAPES, SITES } from './Catalog';
import { landValueCents, terroirPotential } from './Origin';
import type { GrapeId, SiteId, Vineyard, Weather } from './types';

export const MAX_VINEYARD_AREA_HA = 100;
export const MIN_VINEYARD_AREA_HA = 0.01;
export const MINIMUM_HARVEST_RIPENESS = 0.5;
const EARLY_RIPE_FRACTION = 0.24;
const MAX_YIELD_KG_PER_HA: Readonly<Record<GrapeId, number>> = Object.freeze({
  'pinot-noir': 7_400,
  tempranillo: 8_600,
  'sauvignon-blanc': 8_100,
  chardonnay: 7_800,
});
const GROWTH_START_OF_YEAR = 0.12;
const GROWTH_END_OF_YEAR = 0.61;
const RIPENING_START_OF_YEAR = 0.39;
const RIPENING_RATE_PER_WEEK = 0.052;
const VINE_CONDITION_RECOVERY_PER_WEEK = 0.002;
const MINIMUM_VINE_CONDITION = 0.2;
const ROT_START_RIPENESS = 0.76;
const NOBLE_ROT_START_RIPENESS = 0.84;
const KG_PRECISION = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCatalogKey(value: unknown, catalog: object): boolean {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(catalog, value);
}

function roundKg(value: number): number {
  return Math.round((value + Number.EPSILON) * KG_PRECISION) / KG_PRECISION;
}

function floorKgToGram(value: number): number {
  return Math.floor((value + 1e-9) * KG_PRECISION) / KG_PRECISION;
}

function grams(value: number): number {
  return Math.round(value * KG_PRECISION);
}

export function isGramQuantity(value: number): boolean {
  const scaled = value * KG_PRECISION;
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(scaled))
    && Math.abs(scaled - Math.round(scaled)) <= 1e-6;
}

/** Validate the current crop ledger, independently of its containing snapshot. */
export function isVineyardCropStateValid(vineyard: Vineyard): boolean {
  if (![vineyard.cropKg, vineyard.harvestedKg, vineyard.lostKg, vineyard.ripeKg].every(isGramQuantity)
    || !Number.isFinite(vineyard.ripeness) || vineyard.ripeness < 0 || vineyard.ripeness > 1
    || !Number.isFinite(vineyard.rot) || vineyard.rot < 0 || vineyard.rot > 1
    || !Number.isFinite(vineyard.nobleRot) || vineyard.nobleRot < 0 || vineyard.nobleRot > 1) return false;
  return grams(vineyard.harvestedKg) + grams(vineyard.lostKg) + grams(vineyard.ripeKg) <= grams(vineyard.cropKg)
    && (vineyard.ripeness >= MINIMUM_HARVEST_RIPENESS || vineyard.ripeKg === 0);
}

/** Standing includes both ripe and unripe fruit and excludes all past harvests and losses. */
export function standingCropKg(vineyard: Vineyard): number {
  return (grams(vineyard.cropKg) - grams(vineyard.harvestedKg) - grams(vineyard.lostKg)) / KG_PRECISION;
}

function ripeFraction(ripeness: number): number {
  if (ripeness < MINIMUM_HARVEST_RIPENESS) return 0;
  const progress = clamp((ripeness - MINIMUM_HARVEST_RIPENESS) / (1 - MINIMUM_HARVEST_RIPENESS));
  return EARLY_RIPE_FRACTION + (1 - EARLY_RIPE_FRACTION) * progress;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function boundedWeather(weather: Weather): Weather {
  return {
    temperatureC: clamp(finiteOr(weather.temperatureC, 16), -15, 50),
    rainMm: clamp(finiteOr(weather.rainMm, 0), 0, 200),
    humidity: clamp(finiteOr(weather.humidity, 0.5)),
  };
}

function temperatureFit(temperatureC: number, preferredTemperatureC: number): number {
  return clamp(1 - Math.abs(temperatureC - preferredTemperatureC) * 0.035, 0.42, 1.08);
}

function siteGrapeFit(siteId: SiteId, grapeId: GrapeId): number {
  const site = SITES[siteId];
  const grape = GRAPES[grapeId];
  const siteClimateC = 21 - site.altitudeM * 0.017;
  const climateFit = clamp(1 - Math.abs(siteClimateC - grape.preferredTemperatureC) * 0.03, 0.72, 1);
  // One suitability curve supplies agricultural fit; growth adds climate response.
  return climateFit * (0.7 + 0.3 * terroirPotential(site, grape, 1));
}

function seasonalProgress(calendar: CalendarState, atYearStart: boolean): number {
  if (atYearStart) return 0;
  const { weeksPerSeason, seasonsPerYear } = calendar.rules;
  const totalWeeks = weeksPerSeason * seasonsPerYear;
  if (!Number.isSafeInteger(totalWeeks) || totalWeeks <= 0) return 0;
  const date = calendar.date;
  const boundedSeason = Math.min(seasonsPerYear, Math.max(1, date.season));
  const boundedWeek = Math.min(weeksPerSeason, Math.max(1, date.week));
  const zeroBasedWeek = (boundedSeason - 1) * weeksPerSeason + boundedWeek - 0.5;
  return clamp(zeroBasedWeek / totalWeeks);
}

function annualWeatherKey(calendar: CalendarState, elapsedWeek: number, label: string): number {
  const date = calendar.date;
  const safeElapsedWeek = Number.isSafeInteger(elapsedWeek) ? elapsedWeek : 0;
  const key = `${calendar.rules.weeksPerSeason}:${calendar.rules.seasonsPerYear}:${date.year}:${date.season}:${date.week}:${safeElapsedWeek}:${label}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffff_ffff;
}

/** Resolve a repeatable weekly weather sample from explicit game-time context. */
export function resolveWeather(calendar: CalendarState, elapsedWeek: number): Weather {
  const seasonsPerYear = Number.isSafeInteger(calendar.rules.seasonsPerYear) && calendar.rules.seasonsPerYear > 0
    ? calendar.rules.seasonsPerYear
    : 4;
  const season = Number.isSafeInteger(calendar.date.season) && calendar.date.season > 0
    ? Math.min(calendar.date.season, seasonsPerYear)
    : 1;
  const seasonalAngle = (2 * Math.PI * (season - 1)) / seasonsPerYear;
  const seasonalMeanC = 13 - 8 * Math.cos(seasonalAngle);
  const temperatureC = seasonalMeanC + (annualWeatherKey(calendar, elapsedWeek, 'temperature') - 0.5) * 8;
  const rainMm = Math.round(annualWeatherKey(calendar, elapsedWeek, 'rain') * 360) / 10;
  const humidity = clamp(0.38 + 0.48 * (rainMm / 36) + annualWeatherKey(calendar, elapsedWeek, 'humidity') * 0.12, 0.35, 0.98);
  return Object.freeze({
    temperatureC: Math.round(temperatureC * 10) / 10,
    rainMm,
    humidity: Math.round(humidity * 1_000) / 1_000,
  });
}

/** Establish a vineyard with no crop; crop production begins through weekly rules. */
export function createVineyard(input: {
  readonly id: string;
  readonly name: string;
  readonly siteId: SiteId;
  readonly grapeId: GrapeId;
  readonly areaHa: number;
  readonly year: number;
}): RuleResult<{ readonly vineyard: Vineyard; readonly costCents: number }> {
  if (!isRecord(input)) return failure('Vineyard details must be an object.');
  if (typeof input.id !== 'string' || input.id.trim().length === 0 || input.id.trim().length > 80) {
    return failure('Vineyard ID must contain 1 to 80 characters.');
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.trim().length > 80) {
    return failure('Vineyard name must contain 1 to 80 characters.');
  }
  if (!isCatalogKey(input.siteId, SITES)) return failure('Choose a recognized vineyard site.');
  if (!isCatalogKey(input.grapeId, GRAPES)) return failure('Choose a recognized grape variety.');
  if (typeof input.areaHa !== 'number' || !Number.isFinite(input.areaHa) || input.areaHa < MIN_VINEYARD_AREA_HA || input.areaHa > MAX_VINEYARD_AREA_HA) {
    return failure(`Vineyard area must be between ${MIN_VINEYARD_AREA_HA} and ${MAX_VINEYARD_AREA_HA} hectares.`);
  }
  if (typeof input.year !== 'number' || !Number.isSafeInteger(input.year)) return failure('Planting year must be a safe integer.');

  const siteId = input.siteId as SiteId;
  const grapeId = input.grapeId as GrapeId;
  const costCents = landValueCents(SITES[siteId], input.areaHa);
  if (!Number.isSafeInteger(costCents) || costCents <= 0) return failure('Vineyard purchase cost is outside the supported range.');

  const vineyard: Vineyard = Object.freeze({
    id: input.id.trim(),
    name: input.name.trim(),
    siteId,
    grapeId,
    areaHa: input.areaHa,
    plantedYear: input.year,
    cropYear: input.year,
    ripeness: 0,
    condition: 1,
    cropKg: 0,
    harvestedKg: 0,
    lostKg: 0,
    ripeKg: 0,
    rot: 0,
    nobleRot: 0,
  });
  return success(Object.freeze({ vineyard, costCents }));
}

/** Advance one interval using its already-planned ending calendar date. */
export function advanceVineyard(
  vineyard: Vineyard,
  weather: Weather,
  calendar: CalendarState,
  crossedYear: boolean,
): Vineyard {
  const site = SITES[vineyard.siteId];
  const grape = GRAPES[vineyard.grapeId];
  const safeWeather = boundedWeather(weather);
  const atYearStart = crossedYear;
  const calendarYear = finiteOr(calendar.date.year, vineyard.cropYear);
  const cropYear = Math.max(vineyard.cropYear, calendarYear);
  const newCropYear = cropYear > vineyard.cropYear;
  const progress = seasonalProgress(calendar, atYearStart);

  const currentCondition = clamp(finiteOr(vineyard.condition, 1), MINIMUM_VINE_CONDITION, 1);
  const coldStress = Math.max(0, (grape.preferredTemperatureC - safeWeather.temperatureC - 9) / 12);
  const heatStress = Math.max(0, (safeWeather.temperatureC - grape.preferredTemperatureC - 6) / 12);
  const wetStress = Math.max(0, safeWeather.rainMm - 24) / 48
    * safeWeather.humidity * (1 - site.drainage);
  const dryStress = safeWeather.rainMm < 3 && safeWeather.humidity < 0.48 ? (0.48 - safeWeather.humidity) * site.drainage : 0;
  const condition = clamp(
    currentCondition + VINE_CONDITION_RECOVERY_PER_WEEK - 0.012 * coldStress - 0.014 * heatStress - 0.025 * wetStress - 0.018 * dryStress,
    MINIMUM_VINE_CONDITION,
    1,
  );

  const growthProgress = clamp((progress - GROWTH_START_OF_YEAR) / (GROWTH_END_OF_YEAR - GROWTH_START_OF_YEAR));
  const siteFit = siteGrapeFit(vineyard.siteId, vineyard.grapeId);
  const siteYieldFactor = clamp(0.84 + site.fertility * 0.1 + site.sunlight * 0.06, 0.8, 1.08);
  const maxCropKg = vineyard.areaHa * MAX_YIELD_KG_PER_HA[vineyard.grapeId] * siteFit * siteYieldFactor;
  const growthWeatherFit = temperatureFit(safeWeather.temperatureC, grape.preferredTemperatureC);
  const targetCropKg = roundKg(maxCropKg * growthProgress * growthWeatherFit * condition);
  const previousCropKg = newCropYear ? 0 : Math.max(0, finiteOr(vineyard.cropKg, 0));
  const cropKg = roundKg(Math.max(previousCropKg, Math.min(maxCropKg, targetCropKg)));

  const previousRipeness = newCropYear ? 0 : clamp(finiteOr(vineyard.ripeness, 0));
  let ripeness = previousRipeness;
  if (cropKg > 0 && progress >= RIPENING_START_OF_YEAR) {
    const warmthFit = clamp((safeWeather.temperatureC + 2) / (grape.preferredTemperatureC + 2), 0.55, 1.12);
    const exposureFit = 0.84 + site.sunlight * 0.18;
    ripeness = clamp(ripeness + RIPENING_RATE_PER_WEEK * warmthFit * exposureFit);
  }

  const previousRot = newCropYear ? 0 : clamp(finiteOr(vineyard.rot, 0));
  const previousNobleRot = newCropYear ? 0 : clamp(finiteOr(vineyard.nobleRot, 0));
  let rot = previousRot;
  let nobleRot = previousNobleRot;
  if (ripeness >= ROT_START_RIPENESS && safeWeather.humidity >= 0.82 && safeWeather.rainMm >= 18) {
    const nobleConditions = ripeness >= NOBLE_ROT_START_RIPENESS
      && safeWeather.temperatureC >= 12 && safeWeather.temperatureC <= 24
      && safeWeather.rainMm <= 32;
    if (nobleConditions) nobleRot = clamp(nobleRot + 0.018, 0, 0.45);
    else rot = clamp(rot + 0.035, 0, 0.8);
  } else if (ripeness >= 0.97 && safeWeather.humidity >= 0.72) {
    rot = clamp(rot + 0.012, 0, 0.8);
  }

  // Move only still-standing unripe fruit through the changed ripeness curve. New
  // production enters the curve at this week's ripeness; previously harvested or
  // lost fruit can neither ripen again nor be damaged again.
  const harvestedGrams = newCropYear ? 0 : grams(vineyard.harvestedKg);
  const lostGrams = newCropYear ? 0 : grams(vineyard.lostKg);
  const previousRipeGrams = newCropYear ? 0 : grams(vineyard.ripeKg);
  const previousUnripeGrams = grams(previousCropKg) - harvestedGrams - lostGrams - previousRipeGrams;
  const newCropGrams = grams(cropKg) - grams(previousCropKg);
  const previousRipeFraction = ripeFraction(previousRipeness);
  const currentRipeFraction = ripeFraction(ripeness);
  const ripenedShare = currentRipeFraction === 1 ? 1
    : previousRipeFraction === 1 ? 0
      : (currentRipeFraction - previousRipeFraction) / (1 - previousRipeFraction);
  const standingRipeGrams = previousRipeGrams + Math.round(previousUnripeGrams * ripenedShare)
    + Math.round(newCropGrams * currentRipeFraction);
  const standingGrams = grams(cropKg) - harvestedGrams - lostGrams;
  const effectiveRot = clamp(rot - nobleRot * 0.25);
  const previousEffectiveRot = clamp(previousRot - previousNobleRot * 0.25);
  const damageGrams = Math.min(standingGrams, Math.round(standingGrams * Math.max(0, effectiveRot - previousEffectiveRot)));
  const ripeDamageGrams = standingGrams > 0 ? Math.round(damageGrams * standingRipeGrams / standingGrams) : 0;
  return Object.freeze({
    ...vineyard,
    cropYear,
    ripeness,
    condition,
    cropKg,
    harvestedKg: harvestedGrams / KG_PRECISION,
    lostKg: (lostGrams + damageGrams) / KG_PRECISION,
    ripeKg: (standingRipeGrams - ripeDamageGrams) / KG_PRECISION,
    rot,
    nobleRot,
  });
}

/** Harvest only grapes that have reached the early-green harvest window. */
export function harvestVineyard(vineyard: Vineyard, requestedKg: number): RuleResult<{
  readonly vineyard: Vineyard;
  readonly harvestedKg: number;
}> {
  if (!isRecord(vineyard)) return failure('Vineyard crop state is missing.');
  if (typeof requestedKg !== 'number' || !Number.isFinite(requestedKg) || requestedKg <= 0) {
    return failure('Requested harvest must be a positive finite quantity.');
  }
  if (!isVineyardCropStateValid(vineyard)) {
    return failure('Vineyard crop state must contain valid finite quantities and bounded condition values.');
  }
  if (vineyard.ripeness < MINIMUM_HARVEST_RIPENESS) {
    return failure(`Grapes cannot be harvested before ripeness reaches ${MINIMUM_HARVEST_RIPENESS}.`);
  }

  const requestedKgAtGramPrecision = floorKgToGram(requestedKg);
  if (requestedKgAtGramPrecision <= 0) return failure('Requested harvest must include at least one gram.');

  if (vineyard.ripeKg <= 0) return failure('No ripe grapes remain available to harvest.');

  const harvestedKg = Math.min(requestedKgAtGramPrecision, vineyard.ripeKg);
  const nextVineyard = Object.freeze({
    ...vineyard,
    harvestedKg: (grams(vineyard.harvestedKg) + grams(harvestedKg)) / KG_PRECISION,
    ripeKg: (grams(vineyard.ripeKg) - grams(harvestedKg)) / KG_PRECISION,
  });
  return success(Object.freeze({ vineyard: nextVineyard, harvestedKg }));
}
