const WINE_QUALITY_CATEGORIES = [
  'Undrinkable',
  'Vinegar Surprise',
  'House Pour',
  'Everyday Sipper',
  'Solid Bottle',
  'Well-Rounded',
  "Sommelier's Choice",
  'Cellar Reserve',
  "Connoisseur's Pick",
  'Vintage Perfection',
] as const;

const RATING_COLORS = [
  '#dc2626', // red-600
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#65a30d', // lime-600
  '#16a34a', // green-600
  '#15803d', // green-700
  '#166534', // green-800
] as const;

export type RatingDirection = 'higher' | 'lower';

/** Selects one of ten display bands for a normalized value, clamping edges to 0 and 1. */
export function getRatingBand(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(9, Math.floor(Math.max(0, Math.min(1, value)) * 10));
}

/** Returns the 04-inspired red-to-green palette, reversing it for higher-is-worse values. */
export function getRatingColor(value: number, direction: RatingDirection = 'higher'): string | undefined {
  const band = getRatingBand(value);
  if (band === null) return undefined;
  return RATING_COLORS[direction === 'lower' ? 9 - band : band];
}

/** Quality-tier labels apply only to the overall wine quality score. */
export function getWineQualityCategory(value: number): string {
  const band = getRatingBand(value);
  return band === null ? 'Unrated' : WINE_QUALITY_CATEGORIES[band];
}
