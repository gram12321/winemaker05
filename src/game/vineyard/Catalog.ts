import type { GrapeDefinition, GrapeId, SiteDefinition, SiteId } from './types';

/** Prototype varieties selected for the 05 model; balance values are provisional. */
export const GRAPES: Readonly<Record<GrapeId, GrapeDefinition>> = Object.freeze({
  'pinot-noir': Object.freeze({
    id: 'pinot-noir', name: 'Pinot Noir', color: 'red',
    sugar: 0.59, acidity: 0.77, phenolics: 0.52, aromatics: 0.81, body: 0.45, aging: 0.72,
    preferredTemperatureC: 19,
    sitePreferences: Object.freeze({ drainage: 0.77, sunlight: 0.73, fertility: 0.55, altitudeM: 280 }),
  }),
  tempranillo: Object.freeze({
    id: 'tempranillo', name: 'Tempranillo', color: 'red',
    sugar: 0.73, acidity: 0.58, phenolics: 0.78, aromatics: 0.64, body: 0.70, aging: 0.69,
    preferredTemperatureC: 23,
    sitePreferences: Object.freeze({ drainage: 0.72, sunlight: 0.86, fertility: 0.62, altitudeM: 170 }),
  }),
  'sauvignon-blanc': Object.freeze({
    id: 'sauvignon-blanc', name: 'Sauvignon Blanc', color: 'white',
    sugar: 0.56, acidity: 0.82, phenolics: 0.46, aromatics: 0.93, body: 0.42, aging: 0.54,
    preferredTemperatureC: 17,
    sitePreferences: Object.freeze({ drainage: 0.82, sunlight: 0.66, fertility: 0.52, altitudeM: 240 }),
  }),
  chardonnay: Object.freeze({
    id: 'chardonnay', name: 'Chardonnay', color: 'white',
    sugar: 0.66, acidity: 0.70, phenolics: 0.51, aromatics: 0.71, body: 0.66, aging: 0.76,
    preferredTemperatureC: 20,
    sitePreferences: Object.freeze({ drainage: 0.70, sunlight: 0.75, fertility: 0.68, altitudeM: 200 }),
  }),
});

/** Prototype sites selected for 05; prices and characteristics are provisional. */
export const SITES: Readonly<Record<SiteId, SiteDefinition>> = Object.freeze({
  hillside: Object.freeze({
    id: 'hillside', name: 'North Slope', region: 'Upper Valley', pricePerHaCents: 2_400_000,
    drainage: 0.86, sunlight: 0.81, fertility: 0.57, altitudeM: 340, prestige: 0.62,
  }),
  riverbend: Object.freeze({
    id: 'riverbend', name: 'River Bend', region: 'Lower Valley', pricePerHaCents: 1_750_000,
    drainage: 0.58, sunlight: 0.67, fertility: 0.84, altitudeM: 75, prestige: 0.48,
  }),
  heritage: Object.freeze({
    id: 'heritage', name: 'Old Terrace', region: 'Central Valley', pricePerHaCents: 3_100_000,
    drainage: 0.73, sunlight: 0.77, fertility: 0.69, altitudeM: 190, prestige: 0.84,
  }),
});
