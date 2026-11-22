import { clamp } from '../core/Numbers';
import type { GrapeId } from '../vineyard/types';
import type { PhysicalLot } from '../wine/types';
import type { TasteFamily, TasteProfile } from './types';

const TASTE_FAMILY_ORDER: readonly TasteFamily[] = [
  'redFruit', 'darkFruit', 'citrus', 'floral', 'herbal', 'earth', 'oak', 'aged',
];

/** Provisional sensory coefficients. These describe character, not fit or quality. */
export const TASTE_BALANCE = {
  grapeIdentity: {
    'pinot-noir': { redFruit: 0.76, darkFruit: 0.38, citrus: 0.2, floral: 0.68, herbal: 0.3, earth: 0.4, oak: 0.16, aged: 0.38 },
    tempranillo: { redFruit: 0.55, darkFruit: 0.75, citrus: 0.18, floral: 0.24, herbal: 0.47, earth: 0.58, oak: 0.3, aged: 0.44 },
    'sauvignon-blanc': { redFruit: 0.18, darkFruit: 0.15, citrus: 0.68, floral: 0.78, herbal: 0.72, earth: 0.24, oak: 0.08, aged: 0.2 },
    chardonnay: { redFruit: 0.25, darkFruit: 0.3, citrus: 0.42, floral: 0.5, herbal: 0.3, earth: 0.36, oak: 0.24, aged: 0.52 },
  } satisfies Readonly<Record<GrapeId, Readonly<Record<TasteFamily, number>>>>,
  residualSugarFullExpressionGPerL: 90,
  oxygenExposureFullExpression: 1.5,
  maturationFullExpression: 1.2,
  ageDaysFullExpression: 730,
  ageFreshnessDeclineStartDays: 365,
  ageFreshnessDeclineSpanDays: 730,
  ageFreshnessWeight: 0.12,
  oxygenExposureShare: 0.32,
  oxidationFreshnessWeight: 0.5,
  rotFreshnessWeight: 0.32,
  maturationDeclineStart: 0.72,
  maturationDeclineSpan: 1.2,
  maturationFreshnessWeight: 0.28,
  sourceAromaCapacityBase: 0.74,
  sourceAromaCapacityWeight: 0.26,
  sourceAcidityShare: 0.22,
  physicalAcidityShare: 0.78,
  maturationProgressWeight: 0.72,
  ageProgressWeight: 0.28,
  agingPotentialBase: 0.78,
  agingPotentialWeight: 0.22,
  redFruitAromaBase: 0.32,
  redFruitAromaWeight: 0.68,
  redFruitSugarBase: 0.86,
  redFruitSugarWeight: 0.14,
  redFruitGreenPenalty: 0.24,
  darkFruitAromaBase: 0.34,
  darkFruitAromaWeight: 0.66,
  darkFruitPhenolicBase: 0.83,
  darkFruitPhenolicWeight: 0.17,
  darkFruitGreenPenalty: 0.18,
  citrusAromaBase: 0.3,
  citrusAromaWeight: 0.7,
  citrusAcidityBase: 0.7,
  citrusAcidityWeight: 0.3,
  citrusGreenPenalty: 0.12,
  floralAromaBase: 0.28,
  floralAromaWeight: 0.72,
  floralGreenPenalty: 0.32,
  herbalAromaBase: 0.48,
  herbalAromaWeight: 0.52,
  herbalGreenWeight: 0.68,
  herbalRiskPenalty: 0.2,
  earthPhenolicBase: 0.4,
  earthPhenolicWeight: 0.6,
  earthMaturationWeight: 0.13,
  earthLeesWeight: 0.1,
  earthOxidationWeight: 0.12,
  oakIdentityWeight: 0.12,
  oakPhysicalWeight: 0.78,
  oakMaturationWeight: 0.08,
  oakLeesWeight: 0.04,
  agedIdentityWeight: 0.12,
  agedDevelopmentWeight: 0.62,
  agedOxidationWeight: 0.2,
  agedLeesWeight: 0.06,
  familyRiskPenalty: 0.2,
} as const;

/** Provisional display rules; labels are character cues and ties use family order above. */
export const TASTE_DESCRIPTOR_RULES = {
  minimumFamilyExpression: 0.2,
  maximumDescriptors: 5,
  ripeSugarThreshold: 0.45,
  expressivePhenolicThreshold: 0.55,
  brightAcidityThreshold: 0.65,
  aromaticThreshold: 0.62,
  greenHerbThreshold: 0.42,
  leesSavoryThreshold: 0.5,
  toastedOakThreshold: 0.56,
  developedThreshold: 0.58,
  labels: {
    redFruit: { usual: 'red berries', higherSugar: 'ripe red fruit' },
    darkFruit: { usual: 'dark berries', higherPhenolics: 'dark fruit and skin' },
    citrus: { usual: 'citrus notes', higherAcidity: 'citrus zest' },
    floral: { usual: 'floral notes', aromatic: 'floral lift' },
    herbal: { usual: 'herbal notes', green: 'fresh herbs' },
    earth: { usual: 'earthy tones', lees: 'savory earth' },
    oak: { usual: 'oak spice', toasted: 'toasted oak' },
    aged: { usual: 'developed character', mature: 'matured notes' },
  } satisfies Readonly<Record<TasteFamily, Readonly<Record<string, string>>>>,
} as const;

type TasteSource = PhysicalLot['sources'][number];

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumber(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareSources(left: TasteSource, right: TasteSource): number {
  const grapeOrder = compareText(left.origin.grapeId, right.origin.grapeId);
  if (grapeOrder !== 0) return grapeOrder;

  for (const key of ['sugarGPerL', 'acidity', 'phenolics', 'aromatics', 'body', 'agingPotential'] as const) {
    const anchorOrder = compareNumber(left.anchors[key], right.anchors[key]);
    if (anchorOrder !== 0) return anchorOrder;
  }
  return compareNumber(left.fraction, right.fraction);
}

function orderedSources(lot: PhysicalLot): readonly TasteSource[] {
  const sources = lot.sources.length > 0
    ? [...lot.sources]
    : [{ origin: lot.origin, anchors: lot.anchors, fraction: 1 }];
  return sources.sort(compareSources);
}

function weightedSourceValue(sources: readonly TasteSource[], value: (source: TasteSource) => number): number {
  const totalFraction = sources.reduce((total, source) => total + source.fraction, 0);
  if (totalFraction <= 0) return value(sources[0]);
  return sources.reduce((total, source) => total + source.fraction * value(source), 0) / totalFraction;
}

function deriveSourceCharacter(sources: readonly TasteSource[]): {
  readonly identity: TasteProfile;
  readonly aromatics: number;
  readonly acidity: number;
  readonly agingPotential: number;
} {
  const identity = {} as Record<TasteFamily, number>;
  for (const family of TASTE_FAMILY_ORDER) {
    identity[family] = weightedSourceValue(sources, source => TASTE_BALANCE.grapeIdentity[source.origin.grapeId][family]);
  }

  return {
    identity,
    aromatics: weightedSourceValue(sources, source => source.anchors.aromatics),
    acidity: weightedSourceValue(sources, source => source.anchors.acidity),
    agingPotential: weightedSourceValue(sources, source => source.anchors.agingPotential),
  };
}

function descriptorFor(family: TasteFamily, profile: TasteProfile, lot: PhysicalLot): string {
  const { physical } = lot;
  switch (family) {
    case 'redFruit':
      return clamp(physical.sugarGPerL / TASTE_BALANCE.residualSugarFullExpressionGPerL) >= TASTE_DESCRIPTOR_RULES.ripeSugarThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.redFruit.higherSugar
        : TASTE_DESCRIPTOR_RULES.labels.redFruit.usual;
    case 'darkFruit':
      return clamp(physical.phenolics) >= TASTE_DESCRIPTOR_RULES.expressivePhenolicThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.darkFruit.higherPhenolics
        : TASTE_DESCRIPTOR_RULES.labels.darkFruit.usual;
    case 'citrus':
      return clamp(physical.acidity) >= TASTE_DESCRIPTOR_RULES.brightAcidityThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.citrus.higherAcidity
        : TASTE_DESCRIPTOR_RULES.labels.citrus.usual;
    case 'floral':
      return clamp(physical.aroma) >= TASTE_DESCRIPTOR_RULES.aromaticThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.floral.aromatic
        : TASTE_DESCRIPTOR_RULES.labels.floral.usual;
    case 'herbal':
      return clamp(physical.greenCharacter) >= TASTE_DESCRIPTOR_RULES.greenHerbThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.herbal.green
        : TASTE_DESCRIPTOR_RULES.labels.herbal.usual;
    case 'earth':
      return clamp(physical.lees) >= TASTE_DESCRIPTOR_RULES.leesSavoryThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.earth.lees
        : TASTE_DESCRIPTOR_RULES.labels.earth.usual;
    case 'oak':
      return clamp(physical.oak) >= TASTE_DESCRIPTOR_RULES.toastedOakThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.oak.toasted
        : TASTE_DESCRIPTOR_RULES.labels.oak.usual;
    case 'aged':
      return profile.aged >= TASTE_DESCRIPTOR_RULES.developedThreshold
        ? TASTE_DESCRIPTOR_RULES.labels.aged.mature
        : TASTE_DESCRIPTOR_RULES.labels.aged.usual;
  }
}

/** Current sensory identity from lot material and fraction-weighted source grapes. */
export function deriveTaste(lot: PhysicalLot): { families: TasteProfile; descriptors: readonly string[] } {
  const { physical } = lot;
  const source = deriveSourceCharacter(orderedSources(lot));
  const aroma = clamp(physical.aroma) * clamp(
    TASTE_BALANCE.sourceAromaCapacityBase + source.aromatics * TASTE_BALANCE.sourceAromaCapacityWeight,
  );
  const oxidation = clamp(
    clamp(physical.oxidation) * (1 - TASTE_BALANCE.oxygenExposureShare)
      + clamp(physical.oxygenExposure / TASTE_BALANCE.oxygenExposureFullExpression) * TASTE_BALANCE.oxygenExposureShare,
  );
  const maturation = clamp(physical.maturation / TASTE_BALANCE.maturationFullExpression);
  const age = clamp(physical.ageDays / TASTE_BALANCE.ageDaysFullExpression);
  const development = clamp(
    (maturation * TASTE_BALANCE.maturationProgressWeight + age * TASTE_BALANCE.ageProgressWeight)
      * (TASTE_BALANCE.agingPotentialBase + source.agingPotential * TASTE_BALANCE.agingPotentialWeight),
  );
  const maturationDecline = clamp(
    (physical.maturation - TASTE_BALANCE.maturationDeclineStart) / TASTE_BALANCE.maturationDeclineSpan,
  );
  const ageDecline = clamp(
    (physical.ageDays - TASTE_BALANCE.ageFreshnessDeclineStartDays) / TASTE_BALANCE.ageFreshnessDeclineSpanDays,
  );
  const aromaticRetention = clamp(
    1 - oxidation * TASTE_BALANCE.oxidationFreshnessWeight
      - physical.rot * TASTE_BALANCE.rotFreshnessWeight
      - maturationDecline * TASTE_BALANCE.maturationFreshnessWeight
      - ageDecline * TASTE_BALANCE.ageFreshnessWeight,
  );
  const aromaticExpression = clamp(aroma * aromaticRetention);
  const green = clamp(physical.greenCharacter);
  const phenolics = clamp(physical.phenolics);
  const sugar = clamp(physical.sugarGPerL / TASTE_BALANCE.residualSugarFullExpressionGPerL);
  const acidity = clamp(physical.acidity * TASTE_BALANCE.physicalAcidityShare
    + source.acidity * TASTE_BALANCE.sourceAcidityShare);
  const lees = clamp(physical.lees);

  const families: TasteProfile = {
    redFruit: clamp(source.identity.redFruit
      * (TASTE_BALANCE.redFruitAromaBase + aromaticExpression * TASTE_BALANCE.redFruitAromaWeight)
      * (TASTE_BALANCE.redFruitSugarBase + sugar * TASTE_BALANCE.redFruitSugarWeight)
      * (1 - green * TASTE_BALANCE.redFruitGreenPenalty)),
    darkFruit: clamp(source.identity.darkFruit
      * (TASTE_BALANCE.darkFruitAromaBase + aromaticExpression * TASTE_BALANCE.darkFruitAromaWeight)
      * (TASTE_BALANCE.darkFruitPhenolicBase + phenolics * TASTE_BALANCE.darkFruitPhenolicWeight)
      * (1 - green * TASTE_BALANCE.darkFruitGreenPenalty)),
    citrus: clamp(source.identity.citrus
      * (TASTE_BALANCE.citrusAromaBase + aromaticExpression * TASTE_BALANCE.citrusAromaWeight)
      * (TASTE_BALANCE.citrusAcidityBase + acidity * TASTE_BALANCE.citrusAcidityWeight)
      * (1 - green * TASTE_BALANCE.citrusGreenPenalty)),
    floral: clamp(source.identity.floral
      * (TASTE_BALANCE.floralAromaBase + aromaticExpression * TASTE_BALANCE.floralAromaWeight)
      * (1 - green * TASTE_BALANCE.floralGreenPenalty)),
    herbal: clamp((source.identity.herbal
      * (TASTE_BALANCE.herbalAromaBase + aromaticExpression * TASTE_BALANCE.herbalAromaWeight)
      + green * TASTE_BALANCE.herbalGreenWeight)
      * (1 - oxidation * TASTE_BALANCE.herbalRiskPenalty)),
    earth: clamp((source.identity.earth
      * (TASTE_BALANCE.earthPhenolicBase + phenolics * TASTE_BALANCE.earthPhenolicWeight)
      + maturation * TASTE_BALANCE.earthMaturationWeight
      + lees * TASTE_BALANCE.earthLeesWeight
      + oxidation * TASTE_BALANCE.earthOxidationWeight)
      * (1 - physical.rot * TASTE_BALANCE.familyRiskPenalty)),
    oak: clamp((source.identity.oak * TASTE_BALANCE.oakIdentityWeight
      + clamp(physical.oak) * TASTE_BALANCE.oakPhysicalWeight
      + maturation * TASTE_BALANCE.oakMaturationWeight
      + lees * TASTE_BALANCE.oakLeesWeight)
      * (1 - physical.rot * TASTE_BALANCE.familyRiskPenalty)),
    aged: clamp((source.identity.aged * TASTE_BALANCE.agedIdentityWeight
      + development * TASTE_BALANCE.agedDevelopmentWeight
      + oxidation * TASTE_BALANCE.agedOxidationWeight
      + lees * TASTE_BALANCE.agedLeesWeight)
      * (1 - physical.rot * TASTE_BALANCE.familyRiskPenalty)),
  };

  const descriptors = TASTE_FAMILY_ORDER
    .filter(family => families[family] >= TASTE_DESCRIPTOR_RULES.minimumFamilyExpression)
    .sort((left, right) => families[right] - families[left]
      || TASTE_FAMILY_ORDER.indexOf(left) - TASTE_FAMILY_ORDER.indexOf(right))
    .slice(0, TASTE_DESCRIPTOR_RULES.maximumDescriptors)
    .map(family => descriptorFor(family, families, lot));

  return { families, descriptors };
}
