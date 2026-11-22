import { clamp } from '../core/Numbers';
import { GRAPES, SITES } from './Catalog';
import type { GrapeDefinition, SiteDefinition, Vineyard } from './types';
import type { WineOrigin } from '../wine/types';

// Provisional suitability weights and response widths. Grape site preferences
// are optima; a linear response reaches zero at the configured width.
const TERROIR_WEIGHTS = Object.freeze({ drainage: 0.3, sunlight: 0.3, fertility: 0.2, altitude: 0.2 });
const NORMALIZED_SITE_PREFERENCE_TOLERANCE = 0.5;
const ALTITUDE_PREFERENCE_TOLERANCE_M = 500;
const CONDITION_FACTOR_MIN = 0.8;
const CONDITION_FACTOR_SPAN = 0.2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasCatalogEntry<T extends object>(value: unknown, catalog: T): value is keyof T {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(catalog, value);
}

function assertNormalizedValue(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1.`);
  }
}

function assertAltitude(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number of metres.`);
  }
}

function assertSitePhysicalInputs(site: SiteDefinition): void {
  if (!site || typeof site !== 'object') throw new TypeError('Site definition must be an object.');
  assertNormalizedValue(site.drainage, 'Site drainage');
  assertNormalizedValue(site.sunlight, 'Site sunlight');
  assertNormalizedValue(site.fertility, 'Site fertility');
  assertAltitude(site.altitudeM, 'Site altitude');
}

function assertGrapePreferences(grape: GrapeDefinition): void {
  if (!grape || typeof grape !== 'object') throw new TypeError('Grape definition must be an object.');
  if (!grape.sitePreferences || typeof grape.sitePreferences !== 'object') {
    throw new TypeError('Grape site preferences must be an object.');
  }
  assertNormalizedValue(grape.sitePreferences.drainage, 'Preferred drainage');
  assertNormalizedValue(grape.sitePreferences.sunlight, 'Preferred sunlight');
  assertNormalizedValue(grape.sitePreferences.fertility, 'Preferred fertility');
  assertAltitude(grape.sitePreferences.altitudeM, 'Preferred altitude');
}

function linearPreferenceFit(actual: number, preferred: number, tolerance: number): number {
  return clamp(1 - Math.abs(actual - preferred) / tolerance);
}

/**
 * Agricultural site and grape fit, reduced by current vine condition.
 * Physical suitability ignores site price and prestige; finite conditions are
 * clamped to 0..1 before applying the provisional 0.80..1.00 condition factor.
 */
export function terroirPotential(site: SiteDefinition, grape: GrapeDefinition, condition: number): number {
  assertSitePhysicalInputs(site);
  assertGrapePreferences(grape);
  if (!Number.isFinite(condition)) throw new RangeError('Vineyard condition must be finite.');

  const preferences = grape.sitePreferences;
  const environmentalFit =
    TERROIR_WEIGHTS.drainage * linearPreferenceFit(site.drainage, preferences.drainage, NORMALIZED_SITE_PREFERENCE_TOLERANCE)
    + TERROIR_WEIGHTS.sunlight * linearPreferenceFit(site.sunlight, preferences.sunlight, NORMALIZED_SITE_PREFERENCE_TOLERANCE)
    + TERROIR_WEIGHTS.fertility * linearPreferenceFit(site.fertility, preferences.fertility, NORMALIZED_SITE_PREFERENCE_TOLERANCE)
    + TERROIR_WEIGHTS.altitude * linearPreferenceFit(site.altitudeM, preferences.altitudeM, ALTITUDE_PREFERENCE_TOLERANCE_M);
  const conditionFactor = CONDITION_FACTOR_MIN + CONDITION_FACTOR_SPAN * clamp(condition);
  return clamp(environmentalFit * conditionFactor);
}

/** Static commercial reputation authored for the site, independent of its land price and physical fit. */
export function originPrestige(site: SiteDefinition): number {
  if (!site || typeof site !== 'object') throw new TypeError('Site definition must be an object.');
  if (!Number.isFinite(site.prestige)) throw new RangeError('Site prestige must be finite.');
  return clamp(site.prestige);
}

/**
 * Return asset value in whole cents: rounded authored price per hectare times area.
 * Area may be zero, but must be finite and non-negative; authored unit price must
 * be a non-negative safe integer. Throws RangeError for invalid or unsafe values.
 */
export function landValueCents(site: SiteDefinition, areaHa: number): number {
  if (!site || typeof site !== 'object') throw new TypeError('Site definition must be an object.');
  if (!Number.isSafeInteger(site.pricePerHaCents) || site.pricePerHaCents < 0) {
    throw new RangeError('Site price per hectare must be a non-negative safe integer number of cents.');
  }
  if (!Number.isFinite(areaHa) || areaHa < 0) {
    throw new RangeError('Land area must be finite and non-negative.');
  }
  const valueCents = Math.round(site.pricePerHaCents * areaHa);
  if (!Number.isSafeInteger(valueCents)) throw new RangeError('Land value is outside the safe integer-cent range.');
  return valueCents;
}

/** Capture the current catalog-derived origin values and vintage for a vineyard's crop. */
export function createWineOrigin(vineyard: Vineyard): WineOrigin {
  if (!isRecord(vineyard)) throw new TypeError('Vineyard must be an object.');
  if (typeof vineyard.id !== 'string' || vineyard.id.trim().length === 0) throw new RangeError('Vineyard ID must not be empty.');
  if (typeof vineyard.name !== 'string' || vineyard.name.trim().length === 0) throw new RangeError('Vineyard name must not be empty.');
  if (!Number.isSafeInteger(vineyard.cropYear) || (vineyard.cropYear as number) < 0) {
    throw new RangeError('Vineyard crop year must be a non-negative safe integer.');
  }
  if (!hasCatalogEntry(vineyard.siteId, SITES)) throw new RangeError('Vineyard site is not present in the current catalogue.');
  if (!hasCatalogEntry(vineyard.grapeId, GRAPES)) throw new RangeError('Vineyard grape is not present in the current catalogue.');

  const site = SITES[vineyard.siteId];
  const grape = GRAPES[vineyard.grapeId];
  return Object.freeze({
    vineyardId: vineyard.id.trim(),
    vineyardName: vineyard.name.trim(),
    region: site.region,
    siteId: site.id,
    grapeId: grape.id,
    vintage: vineyard.cropYear as number,
    terroirPotential: terroirPotential(site, grape, vineyard.condition as number),
    originPrestige: originPrestige(site),
  });
}
