/** Provisional consumable/handling costs; separate from physical wine rules. */
export const PRESSING_CENTS_PER_KG = 8;
export const BOTTLING_CENTS_PER_BOTTLE = 35;
export const pressingCostCents = (grams: number): number => Math.ceil(grams * PRESSING_CENTS_PER_KG / 1000);
export const bottlingCostCents = (bottles: number): number => bottles * BOTTLING_CENTS_PER_BOTTLE;
