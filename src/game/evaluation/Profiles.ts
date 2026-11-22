import type { GrapeId } from '../vineyard/types';
import type { PhysicalLot, RawMaterialAnchors } from '../wine/types';
import type {
  AxisTarget,
  StructureAxis,
  StructureProfile,
  TasteFamily,
  TasteProfile,
  TargetProfile,
} from './types';

interface ProvisionalBaseTarget {
  readonly midpoint: number;
  readonly width: number;
  readonly weight: number;
}

type BaseTargets<Axis extends string> = Readonly<Record<GrapeId, Readonly<Record<Axis, ProvisionalBaseTarget>>>>;

interface CapacityContext {
  readonly label: string;
  readonly value: number;
}

interface AxisShift<Axis extends string> {
  readonly targetAxis: Axis;
  readonly amount: number;
  readonly explanation: string;
}

type ProfileSource = PhysicalLot['sources'][number];

const STRUCTURE_AXIS_ORDER: readonly StructureAxis[] = [
  'acidity', 'aroma', 'body', 'spice', 'sweetness', 'tannins',
];

const TASTE_FAMILY_ORDER: readonly TasteFamily[] = [
  'redFruit', 'darkFruit', 'citrus', 'floral', 'herbal', 'earth', 'oak', 'aged',
];

const GRAPE_NAMES: Readonly<Record<GrapeId, string>> = {
  'pinot-noir': 'Pinot Noir',
  tempranillo: 'Tempranillo',
  'sauvignon-blanc': 'Sauvignon Blanc',
  chardonnay: 'Chardonnay',
};

/** Provisional target bounds and movement limits for the first 05 evaluation pass. */
export const TARGET_PROFILE_BALANCE = {
  minimumRangeWidth: 0.2,
  maximumRangeWidth: 0.62,
  maximumTotalShiftPerAxis: 0.12,
  sugarAnchorReferenceGPerL: 320,
  structureCapacityInfluence: {
    acidity: 0.1,
    aroma: 0.1,
    body: 0.12,
    spice: 0.08,
    sweetness: 0.05,
    tannins: 0.1,
  } satisfies Readonly<Record<StructureAxis, number>>,
  tasteCapacityInfluence: {
    redFruit: 0.06,
    darkFruit: 0.06,
    citrus: 0.07,
    floral: 0.08,
    herbal: 0.05,
    earth: 0.06,
    oak: 0.04,
    aged: 0.1,
  } satisfies Readonly<Record<TasteFamily, number>>,
  interactions: {
    highTanninsRaiseBody: { threshold: 0.58, fullEffectAt: 0.88, requestedShift: 0.18 },
    highSweetnessEasesAcidity: { threshold: 0.62, fullEffectAt: 0.92, requestedShift: -0.08 },
    agedCharacterLiftsEarth: { threshold: 0.6, fullEffectAt: 0.9, requestedShift: 0.06 },
  },
} as const;

/** Per-variety structural target centers, widths, and weights; values are provisional 05 tuning. */
export const STRUCTURE_TARGET_BASES = {
  'pinot-noir': {
    acidity: { midpoint: 0.7, width: 0.4, weight: 1.15 },
    aroma: { midpoint: 0.72, width: 0.42, weight: 1.1 },
    body: { midpoint: 0.46, width: 0.42, weight: 0.95 },
    spice: { midpoint: 0.45, width: 0.42, weight: 0.9 },
    sweetness: { midpoint: 0.1, width: 0.2, weight: 0.7 },
    tannins: { midpoint: 0.45, width: 0.4, weight: 1.05 },
  },
  tempranillo: {
    acidity: { midpoint: 0.61, width: 0.4, weight: 1.0 },
    aroma: { midpoint: 0.65, width: 0.42, weight: 1.05 },
    body: { midpoint: 0.68, width: 0.4, weight: 1.1 },
    spice: { midpoint: 0.67, width: 0.42, weight: 1.0 },
    sweetness: { midpoint: 0.16, width: 0.24, weight: 0.8 },
    tannins: { midpoint: 0.7, width: 0.4, weight: 1.2 },
  },
  'sauvignon-blanc': {
    acidity: { midpoint: 0.77, width: 0.4, weight: 1.1 },
    aroma: { midpoint: 0.84, width: 0.4, weight: 1.2 },
    body: { midpoint: 0.4, width: 0.42, weight: 0.8 },
    spice: { midpoint: 0.39, width: 0.42, weight: 0.75 },
    sweetness: { midpoint: 0.12, width: 0.22, weight: 0.7 },
    tannins: { midpoint: 0.35, width: 0.4, weight: 0.75 },
  },
  chardonnay: {
    acidity: { midpoint: 0.68, width: 0.42, weight: 1.0 },
    aroma: { midpoint: 0.71, width: 0.42, weight: 1.0 },
    body: { midpoint: 0.64, width: 0.4, weight: 1.05 },
    spice: { midpoint: 0.48, width: 0.42, weight: 0.85 },
    sweetness: { midpoint: 0.14, width: 0.24, weight: 0.75 },
    tannins: { midpoint: 0.42, width: 0.42, weight: 0.9 },
  },
} as const satisfies BaseTargets<StructureAxis>;

/** Per-variety taste-family target centers, widths, and weights; values are provisional 05 tuning. */
export const TASTE_TARGET_BASES = {
  'pinot-noir': {
    redFruit: { midpoint: 0.55, width: 0.4, weight: 1.15 },
    darkFruit: { midpoint: 0.4, width: 0.42, weight: 0.9 },
    citrus: { midpoint: 0.29, width: 0.42, weight: 0.75 },
    floral: { midpoint: 0.52, width: 0.4, weight: 1.0 },
    herbal: { midpoint: 0.35, width: 0.42, weight: 0.8 },
    earth: { midpoint: 0.4, width: 0.42, weight: 0.85 },
    oak: { midpoint: 0.31, width: 0.4, weight: 0.75 },
    aged: { midpoint: 0.38, width: 0.42, weight: 0.85 },
  },
  tempranillo: {
    redFruit: { midpoint: 0.48, width: 0.42, weight: 1.0 },
    darkFruit: { midpoint: 0.6, width: 0.4, weight: 1.1 },
    citrus: { midpoint: 0.27, width: 0.4, weight: 0.7 },
    floral: { midpoint: 0.35, width: 0.42, weight: 0.75 },
    herbal: { midpoint: 0.47, width: 0.4, weight: 0.9 },
    earth: { midpoint: 0.55, width: 0.42, weight: 1.0 },
    oak: { midpoint: 0.41, width: 0.4, weight: 0.9 },
    aged: { midpoint: 0.49, width: 0.4, weight: 0.95 },
  },
  'sauvignon-blanc': {
    redFruit: { midpoint: 0.25, width: 0.4, weight: 0.7 },
    darkFruit: { midpoint: 0.23, width: 0.4, weight: 0.65 },
    citrus: { midpoint: 0.6, width: 0.4, weight: 1.15 },
    floral: { midpoint: 0.62, width: 0.4, weight: 1.15 },
    herbal: { midpoint: 0.55, width: 0.4, weight: 1.0 },
    earth: { midpoint: 0.29, width: 0.42, weight: 0.7 },
    oak: { midpoint: 0.23, width: 0.4, weight: 0.65 },
    aged: { midpoint: 0.26, width: 0.42, weight: 0.7 },
  },
  chardonnay: {
    redFruit: { midpoint: 0.33, width: 0.42, weight: 0.75 },
    darkFruit: { midpoint: 0.38, width: 0.42, weight: 0.8 },
    citrus: { midpoint: 0.46, width: 0.4, weight: 0.9 },
    floral: { midpoint: 0.48, width: 0.4, weight: 0.95 },
    herbal: { midpoint: 0.36, width: 0.42, weight: 0.75 },
    earth: { midpoint: 0.43, width: 0.4, weight: 0.9 },
    oak: { midpoint: 0.46, width: 0.4, weight: 1.0 },
    aged: { midpoint: 0.54, width: 0.4, weight: 1.0 },
  },
} as const satisfies BaseTargets<TasteFamily>;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function format(value: number): string {
  return value.toFixed(2);
}

function formatShift(value: number): string {
  const shown = Math.abs(value) < 0.0005 ? 0 : value;
  return `${shown >= 0 ? '+' : ''}${shown.toFixed(3)}`;
}

function describeShiftLimits(
  requestedShift: number,
  budgetedShift: number,
  appliedShift: number,
  domainBoundedRequest: number,
  width: number,
): string {
  const budgetLimited = Math.abs(requestedShift - budgetedShift) > 0.0005;
  const rangeLimited = Math.abs(requestedShift - domainBoundedRequest) > 0.0005;
  if (!budgetLimited && !rangeLimited) {
    return ` (requested ${formatShift(requestedShift)}; final displacement ${formatShift(appliedShift)})`;
  }

  const limits: string[] = [];
  if (budgetLimited) {
    limits.push(
      `axis movement budget +/-${TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis.toFixed(3)} `
        + `limits the combined shift to ${formatShift(budgetedShift)}`,
    );
  }
  if (rangeLimited) {
    limits.push(
      `target-center bounds [${format(width / 2)}, ${format(1 - width / 2)}] `
        + `cap the unbudgeted request at ${formatShift(domainBoundedRequest)}`,
    );
  }
  return ` (requested ${formatShift(requestedShift)}; ${limits.join('; ')}; `
    + `final displacement ${formatShift(appliedShift)})`;
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumber(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareSources(left: ProfileSource, right: ProfileSource): number {
  const grapeOrder = compareText(left.origin.grapeId, right.origin.grapeId);
  if (grapeOrder !== 0) return grapeOrder;

  for (const key of ['sugarGPerL', 'acidity', 'phenolics', 'aromatics', 'body', 'agingPotential'] as const) {
    const anchorOrder = compareNumber(left.anchors[key], right.anchors[key]);
    if (anchorOrder !== 0) return anchorOrder;
  }
  return compareNumber(left.fraction, right.fraction);
}

function assertNormalizedProfile<Axis extends string>(
  profile: Readonly<Record<Axis, number>>,
  axes: readonly Axis[],
  label: string,
): void {
  const expectedKeys = [...axes].sort(compareText);
  const actualKeys = Object.keys(profile).sort(compareText);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${label} must contain exactly the configured axes.`);
  }

  for (const axis of axes) {
    const value: unknown = profile[axis];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${label} value for "${axis}" must be finite and normalized to [0, 1].`);
    }
  }
}

function validateAnchors(anchors: RawMaterialAnchors): void {
  const normalized = [anchors.acidity, anchors.phenolics, anchors.aromatics, anchors.body, anchors.agingPotential];
  if (normalized.some(value => !Number.isFinite(value) || value < 0 || value > 1)
    || !Number.isFinite(anchors.sugarGPerL) || anchors.sugarGPerL < 0) {
    throw new RangeError('Profile source anchors must be finite and within their normalized domains.');
  }
}

function profileSources(lot: PhysicalLot): readonly ProfileSource[] {
  if (!Array.isArray(lot.sources) || lot.sources.length === 0) {
    throw new RangeError('Profile evaluation requires at least one source.');
  }
  const suppliedSources = [...lot.sources];

  for (const source of suppliedSources) {
    if (!source || typeof source !== 'object' || !source.origin || !source.anchors
      || typeof source.fraction !== 'number' || !Number.isFinite(source.fraction) || source.fraction <= 0) {
      throw new RangeError('Profile sources require a grape identity, valid anchors and a positive finite fraction.');
    }
    validateAnchors(source.anchors);
  }

  const totalFraction = suppliedSources.reduce((total, source) => total + source.fraction, 0);
  if (!Number.isFinite(totalFraction) || totalFraction <= 0) {
    throw new RangeError('Profile source fractions must have a positive finite total.');
  }

  return suppliedSources
    .map(source => ({ ...source, fraction: source.fraction / totalFraction }))
    .sort(compareSources);
}

function sourceCapacityValue(axis: StructureAxis, anchors: RawMaterialAnchors): CapacityContext {
  switch (axis) {
    case 'acidity': return { label: 'acidity anchor', value: anchors.acidity };
    case 'aroma': return { label: 'aromatic anchor', value: anchors.aromatics };
    case 'body': return { label: 'body anchor', value: anchors.body };
    case 'spice': return {
      label: 'phenolic and aromatic anchors',
      value: (anchors.phenolics + anchors.aromatics) / 2,
    };
    case 'sweetness': return {
      label: 'sugar anchor',
      value: clamp(anchors.sugarGPerL / TARGET_PROFILE_BALANCE.sugarAnchorReferenceGPerL, 0, 1),
    };
    case 'tannins': return { label: 'phenolic anchor', value: anchors.phenolics };
  }
}

function tasteCapacityValue(axis: TasteFamily, anchors: RawMaterialAnchors): CapacityContext {
  switch (axis) {
    case 'redFruit': return {
      label: 'aromatic and sugar anchors',
      value: (anchors.aromatics + clamp(anchors.sugarGPerL / TARGET_PROFILE_BALANCE.sugarAnchorReferenceGPerL, 0, 1)) / 2,
    };
    case 'darkFruit': return {
      label: 'aromatic and phenolic anchors',
      value: (anchors.aromatics + anchors.phenolics) / 2,
    };
    case 'citrus': return { label: 'acidity anchor', value: anchors.acidity };
    case 'floral': return { label: 'aromatic anchor', value: anchors.aromatics };
    case 'herbal': return {
      label: 'aromatic and acidity anchors',
      value: (anchors.aromatics + anchors.acidity) / 2,
    };
    case 'earth': return {
      label: 'phenolic and aging anchors',
      value: (anchors.phenolics + anchors.agingPotential) / 2,
    };
    case 'oak': return {
      label: 'body and aging anchors',
      value: (anchors.body + anchors.agingPotential) / 2,
    };
    case 'aged': return { label: 'aging anchor', value: anchors.agingPotential };
  }
}

function ramp(value: number, threshold: number, fullEffectAt: number): number {
  return clamp((value - threshold) / (fullEffectAt - threshold), 0, 1);
}

function structureInteractions(profile: StructureProfile): readonly AxisShift<StructureAxis>[] {
  const tanninStrength = ramp(
    profile.tannins,
    TARGET_PROFILE_BALANCE.interactions.highTanninsRaiseBody.threshold,
    TARGET_PROFILE_BALANCE.interactions.highTanninsRaiseBody.fullEffectAt,
  );
  const sweetnessStrength = ramp(
    profile.sweetness,
    TARGET_PROFILE_BALANCE.interactions.highSweetnessEasesAcidity.threshold,
    TARGET_PROFILE_BALANCE.interactions.highSweetnessEasesAcidity.fullEffectAt,
  );

  return [
    ...(tanninStrength > 0 ? [{
      targetAxis: 'body' as const,
      amount: tanninStrength * TARGET_PROFILE_BALANCE.interactions.highTanninsRaiseBody.requestedShift,
      explanation: `High tannin expression (${format(profile.tannins)}) raises the body target.`,
    }] : []),
    ...(sweetnessStrength > 0 ? [{
      targetAxis: 'acidity' as const,
      amount: sweetnessStrength * TARGET_PROFILE_BALANCE.interactions.highSweetnessEasesAcidity.requestedShift,
      explanation: `High sweetness expression (${format(profile.sweetness)}) eases the acidity target.`,
    }] : []),
  ];
}

function tasteInteractions(profile: TasteProfile): readonly AxisShift<TasteFamily>[] {
  const agedStrength = ramp(
    profile.aged,
    TARGET_PROFILE_BALANCE.interactions.agedCharacterLiftsEarth.threshold,
    TARGET_PROFILE_BALANCE.interactions.agedCharacterLiftsEarth.fullEffectAt,
  );

  return agedStrength > 0 ? [{
    targetAxis: 'earth',
    amount: agedStrength * TARGET_PROFILE_BALANCE.interactions.agedCharacterLiftsEarth.requestedShift,
    explanation: `Developed aged character (${format(profile.aged)}) raises the earth-family target.`,
  }] : [];
}

function boundedRange(midpoint: number, width: number): { readonly midpoint: number; readonly low: number; readonly high: number } {
  const boundedWidth = clamp(
    width,
    TARGET_PROFILE_BALANCE.minimumRangeWidth,
    TARGET_PROFILE_BALANCE.maximumRangeWidth,
  );
  const boundedMidpoint = clamp(midpoint, boundedWidth / 2, 1 - boundedWidth / 2);
  return {
    midpoint: boundedMidpoint,
    low: boundedMidpoint - boundedWidth / 2,
    high: boundedMidpoint + boundedWidth / 2,
  };
}

function buildContextualTargets<Axis extends string>(input: {
  readonly lot: PhysicalLot;
  readonly profile: Readonly<Record<Axis, number>>;
  readonly axes: readonly Axis[];
  readonly bases: BaseTargets<Axis>;
  readonly capacityInfluence: Readonly<Record<Axis, number>>;
  readonly capacityFor: (axis: Axis, anchors: RawMaterialAnchors) => CapacityContext;
  readonly interactions: readonly AxisShift<Axis>[];
  readonly profileName: string;
}): Readonly<Record<Axis, AxisTarget>> {
  const { lot, profile, axes, bases, capacityInfluence, capacityFor, interactions, profileName } = input;
  assertNormalizedProfile(profile, axes, profileName);
  const sources = profileSources(lot);
  const sourceWeightTotal = sources.reduce((total, source) => total + source.fraction, 0);
  const output = {} as Record<Axis, AxisTarget>;

  for (const axis of axes) {
    const contributions = sources.map(source => {
      const varietyBases = bases[source.origin.grapeId];
      if (!varietyBases) throw new RangeError(`No provisional target profile exists for grape "${source.origin.grapeId}".`);

      const base = varietyBases[axis];
      const capacity = capacityFor(axis, source.anchors);
      const contextShift = (capacity.value - 0.5) * capacityInfluence[axis];
      const unshiftedRange = boundedRange(base.midpoint, base.width);
      const range = boundedRange(base.midpoint + contextShift, base.width);

      return {
        source,
        unshiftedMidpoint: unshiftedRange.midpoint,
        midpoint: range.midpoint,
        width: range.high - range.low,
        weight: base.weight,
        capacity,
        contextShift,
        appliedContextShift: range.midpoint - unshiftedRange.midpoint,
        configuredWidth: base.width,
      };
    });

    const weightedMean = (select: (contribution: typeof contributions[number]) => number): number =>
      contributions.reduce((total, contribution) => total + contribution.source.fraction * select(contribution), 0)
        / sourceWeightTotal;
    const baselineMidpoint = weightedMean(contribution => contribution.midpoint);
    const baselineWidth = weightedMean(contribution => contribution.width);
    const weight = weightedMean(contribution => contribution.weight);
    const sourceWeightedBase = boundedRange(
      weightedMean(contribution => contribution.unshiftedMidpoint),
      baselineWidth,
    );
    const baseline = boundedRange(baselineMidpoint, baselineWidth);
    const appliedContextShift = baseline.midpoint - sourceWeightedBase.midpoint;

    const axisInteractions = interactions.filter(interaction => interaction.targetAxis === axis);
    const requestedInteractionShift = axisInteractions.reduce((total, interaction) => total + interaction.amount, 0);
    const requestedTotalShift = appliedContextShift + requestedInteractionShift;
    const cappedTotalShift = clamp(
      requestedTotalShift,
      -TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis,
      TARGET_PROFILE_BALANCE.maximumTotalShiftPerAxis,
    );
    const domainBoundedRequest = boundedRange(
      sourceWeightedBase.midpoint + requestedTotalShift,
      baselineWidth,
    ).midpoint - sourceWeightedBase.midpoint;
    const finalRange = boundedRange(sourceWeightedBase.midpoint + cappedTotalShift, baselineWidth);
    const appliedTotalShift = finalRange.midpoint - sourceWeightedBase.midpoint;
    const interactionDetails = axisInteractions.map(interaction => interaction.explanation);
    const crossAxisReason = axisInteractions.length === 0
      ? 'Cross-axis movement: +0.000 requested; no interaction threshold was met.'
      : `Cross-axis movement: ${formatShift(requestedInteractionShift)} requested. ${interactionDetails.join(' ')}`;
    const shiftReason = `${crossAxisReason} Source-anchor context movement from the source-weighted base is `
      + `${formatShift(appliedContextShift)}. Combined target displacement from that base is `
      + `${formatShift(appliedTotalShift)}${describeShiftLimits(
        requestedTotalShift,
        cappedTotalShift,
        appliedTotalShift,
        domainBoundedRequest,
        baselineWidth,
      )}.`;
    const baselineDetails = contributions.map(contribution => {
      const capacityLabel = contribution.capacity.label;
      const widthNote = Math.abs(contribution.configuredWidth - contribution.width) > 0.0005
        ? `, configured width ${format(contribution.configuredWidth)} bounded to ${format(contribution.width)}`
        : `, width ${format(contribution.width)}`;
      const contextShiftNote = Math.abs(contribution.contextShift - contribution.appliedContextShift) > 0.0005
        ? `${capacityLabel} ${format(contribution.capacity.value)} requests center shift ${formatShift(contribution.contextShift)}; `
          + `target-center bounds [${format(contribution.width / 2)}, ${format(1 - contribution.width / 2)}] `
          + `limit the applied shift to ${formatShift(contribution.appliedContextShift)}`
        : `${capacityLabel} ${format(contribution.capacity.value)} shifts center ${formatShift(contribution.appliedContextShift)}`;
      return `${GRAPE_NAMES[contribution.source.origin.grapeId]} ${format(contribution.source.fraction * 100)}% `
        + `(base center ${format(contribution.unshiftedMidpoint)}, anchor-context center ${format(contribution.midpoint)}`
        + `${widthNote}, weight ${format(contribution.weight)}, `
        + `${contextShiftNote})`;
    });

    output[axis] = {
      low: finalRange.low,
      high: finalRange.high,
      weight,
      reasons: [
        `Baseline: source-weighted ${axis} target after anchor context from ${baselineDetails.join('; ')}; `
          + `source-weighted base center ${format(sourceWeightedBase.midpoint)}, contextual range `
          + `${format(baseline.low)}–${format(baseline.high)} and weight ${format(weight)}.`,
        shiftReason,
      ],
    };
  }

  return output;
}

/** Build bounded structural targets from source grape identity and harvest-time anchors. */
export function structureTargets(lot: PhysicalLot, profile: StructureProfile): TargetProfile {
  return buildContextualTargets({
    lot,
    profile,
    axes: STRUCTURE_AXIS_ORDER,
    bases: STRUCTURE_TARGET_BASES,
    capacityInfluence: TARGET_PROFILE_BALANCE.structureCapacityInfluence,
    capacityFor: sourceCapacityValue,
    interactions: structureInteractions(profile),
    profileName: 'Structure profile',
  });
}

/** Build bounded taste-family targets from source grape identity and harvest-time anchors. */
export function tasteTargets(lot: PhysicalLot, profile: TasteProfile): TargetProfile {
  return buildContextualTargets({
    lot,
    profile,
    axes: TASTE_FAMILY_ORDER,
    bases: TASTE_TARGET_BASES,
    capacityInfluence: TARGET_PROFILE_BALANCE.tasteCapacityInfluence,
    capacityFor: tasteCapacityValue,
    interactions: tasteInteractions(profile),
    profileName: 'Taste profile',
  });
}
