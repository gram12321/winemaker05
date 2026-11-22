/** Shared representation bounds for current snapshots and every wine operation. */
export const WINE_MATERIAL_LIMITS = Object.freeze({ sugarGPerL: 400, alcoholPct: 30 });

/** Allow only rounding noise in source-weighted inherited material limits. */
export const WINE_CAPACITY_EPSILON = 1e-7;
