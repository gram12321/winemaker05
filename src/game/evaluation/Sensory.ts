import { clamp } from '../core/Numbers';
import type { GrapeId } from '../vineyard/types';
import type { PhysicalLot } from '../wine/types';
import type { StructureProfile } from './types';

/** Provisional projection mappings, expressed independently of assessment targets. */
export const SENSORY_BALANCE = {
  // A dry bottle at the 4 g/L limit should remain visible in the sweetness axis.
  sweetnessFullGPerL: 32,
  sweetnessHarvestFraction: 0.1,
  aciditySweetnessMask: 0.2,
  alcoholFullPct: 16,
  bodyAlcoholWeight: 0.55,
  bodyExtractWeight: 0.3,
  bodyLeesWeight: 0.15,
  bodyCapacityBase: 0.6,
  bodyCapacityWeight: 0.4,
  tanninMaturationSoftening: 0.3,
  spiceOakWeight: 0.35,
  spiceExtractWeight: 0.15,
  spiceMaturationWeight: 0.08,
  varietalSpice: {
    'pinot-noir': 0.18,
    tempranillo: 0.29,
    'sauvignon-blanc': 0.12,
    chardonnay: 0.09,
  } satisfies Readonly<Record<GrapeId, number>>,
} as const;

/** Current sensory expression, never a score or a stored property of the lot. */
export function deriveStructure(lot: PhysicalLot): StructureProfile {
  const { physical, anchors } = lot;
  const acidity = clamp(physical.acidity);
  const aroma = clamp(physical.aroma);
  // Integration changes perceived astringency without inventing or removing phenolic material.
  const tannins = clamp(physical.phenolics * (1 - clamp(physical.maturation) * SENSORY_BALANCE.tanninMaturationSoftening));
  const sweetnessScale = Math.max(
    SENSORY_BALANCE.sweetnessFullGPerL,
    anchors.sugarGPerL * SENSORY_BALANCE.sweetnessHarvestFraction,
  );
  const sweetness = clamp(physical.sugarGPerL / sweetnessScale * (1 - acidity * SENSORY_BALANCE.aciditySweetnessMask));
  const body = clamp((
    clamp(physical.alcoholPct / SENSORY_BALANCE.alcoholFullPct) * SENSORY_BALANCE.bodyAlcoholWeight
    + tannins * SENSORY_BALANCE.bodyExtractWeight
    + clamp(physical.lees) * SENSORY_BALANCE.bodyLeesWeight
  ) * (SENSORY_BALANCE.bodyCapacityBase + clamp(anchors.body) * SENSORY_BALANCE.bodyCapacityWeight));
  // Source fractions preserve varietal character for a blend without adding its
  // inherited aromatic capacity to the aroma already present in physical state.
  const varietalSpice = lot.sources.reduce((sum, source) =>
    sum + SENSORY_BALANCE.varietalSpice[source.origin.grapeId] * source.fraction, 0);
  const spice = clamp(varietalSpice * aroma
    + clamp(physical.oak) * SENSORY_BALANCE.spiceOakWeight
    + tannins * SENSORY_BALANCE.spiceExtractWeight
    + clamp(physical.maturation) * SENSORY_BALANCE.spiceMaturationWeight);

  return { acidity, aroma, body, spice, sweetness, tannins };
}
