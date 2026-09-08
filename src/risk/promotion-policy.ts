import { createHash } from 'node:crypto';

export type PromotionLevel = 0 | 1 | 2 | 3;
export type FrozenPromotionPolicy = {
  version: string;
  maxAllocationMultiplier: 2;
  hash: string;
};

export function createFrozenPromotionPolicy(version: string): FrozenPromotionPolicy {
  if (!version) throw new Error('PROMOTION_POLICY_VERSION_REQUIRED');
  const payload = { version, maxAllocationMultiplier: 2 as const };
  return { ...payload, hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}

function assertFrozenPolicy(policy: FrozenPromotionPolicy): void {
  const payload = { version: policy.version, maxAllocationMultiplier: policy.maxAllocationMultiplier };
  const expected = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (policy.maxAllocationMultiplier !== 2 || policy.hash !== expected) throw new Error('PROMOTION_POLICY_TAMPERED');
}

export type PromotionEvidence = {
  policy: FrozenPromotionPolicy;
  currentLevel: PromotionLevel;
  requestedLevel: PromotionLevel;
  positiveOos: boolean;
  acceptableDrawdown: boolean;
  executionStable: boolean;
  safetyClean: boolean;
  regimeCovered: boolean;
  calibrationAcceptable: boolean;
  observations: number;
  minObservations: number;
  dwellHours: number;
  minDwellHours: number;
  previousPromotionHoursAgo: number;
  minVelocityHours: number;
  priorAllocation: number;
  requestedAllocation: number;
  aggregateRiskPassed: boolean;
};

export function evaluatePromotion(e: PromotionEvidence): { allowed: true } | { allowed: false; reason: string } {
  assertFrozenPolicy(e.policy);
  if (e.requestedLevel !== e.currentLevel + 1) return { allowed: false, reason: 'LEVEL_SKIP_FORBIDDEN' };
  if (!e.positiveOos || !e.acceptableDrawdown || !e.executionStable || !e.safetyClean || !e.regimeCovered || !e.calibrationAcceptable || !e.aggregateRiskPassed) return { allowed: false, reason: 'EVIDENCE_GATE_FAILED' };
  if (e.observations < e.minObservations) return { allowed: false, reason: 'OBSERVATION_GATE_FAILED' };
  if (e.dwellHours < e.minDwellHours) return { allowed: false, reason: 'DWELL_GATE_FAILED' };
  if (e.previousPromotionHoursAgo < e.minVelocityHours) return { allowed: false, reason: 'VELOCITY_GATE_FAILED' };
  if (!(e.requestedAllocation > e.priorAllocation && e.requestedAllocation <= e.priorAllocation * e.policy.maxAllocationMultiplier)) return { allowed: false, reason: 'ALLOCATION_VELOCITY_FAILED' };
  return { allowed: true };
}
