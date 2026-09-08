export type StatisticalEvidence = {
  meanTradeExpectancy: number;
  sampleCount: number;
  sampleStdDev: number;
  declaredTrialCount: number;
  dsr: number;
};

export type StatisticalPolicy = {
  minSampleCount: number;
  minDsr: number;
};

export type StatisticalDecision = { pass: true; lowerConfidenceBound: number } | { pass: false; reason: 'INSUFFICIENT_SAMPLE' | 'NEGATIVE_EXPECTANCY_BOUND' | 'DSR_BELOW_THRESHOLD' | 'INVALID_TRIAL_COUNT' };

export function oneSidedNormalLowerBound(e: StatisticalEvidence, z = 1.645): number {
  if (e.sampleCount <= 0 || e.sampleStdDev < 0) return Number.NEGATIVE_INFINITY;
  return e.meanTradeExpectancy - z * (e.sampleStdDev / Math.sqrt(e.sampleCount));
}

export function validateStatisticalEvidence(e: StatisticalEvidence, p: StatisticalPolicy): StatisticalDecision {
  if (!Number.isInteger(e.sampleCount) || e.sampleCount < p.minSampleCount) return { pass: false, reason: 'INSUFFICIENT_SAMPLE' };
  if (!Number.isInteger(e.declaredTrialCount) || e.declaredTrialCount < 1) return { pass: false, reason: 'INVALID_TRIAL_COUNT' };
  if (e.dsr < p.minDsr) return { pass: false, reason: 'DSR_BELOW_THRESHOLD' };
  const lower = oneSidedNormalLowerBound(e);
  return lower > 0 ? { pass: true, lowerConfidenceBound: lower } : { pass: false, reason: 'NEGATIVE_EXPECTANCY_BOUND' };
}
