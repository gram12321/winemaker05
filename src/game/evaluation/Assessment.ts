import { evaluateProfile } from './MovingTargets';
import { structureTargets, tasteTargets } from './Profiles';
import { deriveStructure } from './Sensory';
import { deriveTaste } from './Taste';
import type { PhysicalLot } from '../wine/types';
import { diagnoseWine } from '../wine/Risks';
import type { ProfileAssessment, WineAssessment, WineFault } from './types';

/**
 * Provisional 05 summary policy: structural coherence remains the quality
 * foundation, with one reduction based on the most severe current physical
 * fault. Taste fit remains a separate result for style and buyer context.
 */
export const ASSESSMENT_QUALITY_POLICY = {
  maximumFaultReductionShare: 0.6,
} as const;

function clampNormalizedScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function maximumFaultSeverity(faults: readonly WineFault[]): number {
  return faults.reduce((maximum, fault) => Math.max(maximum, fault.severity), 0);
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
  const faultSeverity = maximumFaultSeverity(faults);
  const quality = clampNormalizedScore(
    structure.score * (1 - ASSESSMENT_QUALITY_POLICY.maximumFaultReductionShare * faultSeverity),
  );

  return {
    structure,
    taste: taste.assessment,
    quality,
    faults,
    descriptors: taste.descriptors,
  };
}
