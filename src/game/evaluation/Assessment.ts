import { evaluateProfile } from './MovingTargets';
import { structureTargets, tasteTargets } from './Profiles';
import { deriveStructure } from './Sensory';
import { deriveTaste } from './Taste';
import type { PhysicalLot } from '../wine/types';
import { diagnoseWine, physicalRiskPenaltyIntensity } from '../wine/Risks';
import type { ProfileAssessment, WineAssessment } from './types';

/**
 * Provisional 05 summary policy: structural coherence remains the quality
 * foundation, with one reduction based on the strongest current physical-risk
 * intensity. Taste fit remains a separate result for style and buyer context.
 */
export const ASSESSMENT_QUALITY_POLICY = {
  maximumPhysicalRiskReductionShare: 0.6,
} as const;

function clampNormalizedScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function assessStructure(lot: PhysicalLot): ProfileAssessment {
  const profile = deriveStructure(lot);
  return evaluateProfile(profile, structureTargets(lot, profile));
}

function assessTaste(lot: PhysicalLot): { assessment: ProfileAssessment; descriptors: readonly string[] } {
  const { families, descriptors } = deriveTaste(lot);
  return {
    assessment: evaluateProfile(families, tasteTargets(lot, families)),
    descriptors,
  };
}

/** Assess current structure, taste fit, descriptors and physical faults without changing the lot. */
export function assessWine(lot: PhysicalLot): WineAssessment {
  const structure = assessStructure(lot);
  const taste = assessTaste(lot);
  const faults = diagnoseWine(lot);
  const riskIntensity = physicalRiskPenaltyIntensity(lot);
  const quality = clampNormalizedScore(
    structure.score * (1 - ASSESSMENT_QUALITY_POLICY.maximumPhysicalRiskReductionShare * riskIntensity),
  );

  return {
    structure,
    taste: taste.assessment,
    quality,
    faults,
    descriptors: taste.descriptors,
  };
}
