export type ExposureSnapshot = {
  approvedCapital: number;
  allocatedCapital: number;
  deployedCapital: number;
  grossExposure: number;
  netExposure: number;
  marginUtilization: number;
  liquidityUsage: number;
  concentrationExposure: number;
  correlationAdjustedRisk: number;
  tailLoss: number;
};

export type ExposureLimits = {
  approvedCapital: number;
  allocatedCapital: number;
  deployedCapital: number;
  grossExposure: number;
  netExposure: number;
  marginUtilization: number;
  liquidityUsage: number;
  concentrationExposure: number;
  correlationAdjustedRisk: number;
  tailLoss: number;
};

export type ExposureDecision = { allowed: true } | { allowed: false; reason: string };

export function evaluateExposure(current: ExposureSnapshot, proposed: ExposureSnapshot, limits: ExposureLimits): ExposureDecision {
  const keys = Object.keys(limits) as (keyof ExposureLimits)[];
  for (const key of keys) {
    const value = proposed[key];
    const limit = limits[key];
    if (!Number.isFinite(value) || !Number.isFinite(limit)) return { allowed: false, reason: `UNKNOWN_${key}` };
    if (value > limit) return { allowed: false, reason: `${key}_LIMIT` };
  }
  if (proposed.allocatedCapital > proposed.approvedCapital) return { allowed: false, reason: 'ALLOCATED_GT_APPROVED' };
  if (proposed.deployedCapital > proposed.allocatedCapital) return { allowed: false, reason: 'DEPLOYED_GT_ALLOCATED' };
  if (proposed.deployedCapital < current.deployedCapital && proposed.grossExposure >= current.grossExposure) return { allowed: false, reason: 'ACCOUNTING_INCONSISTENCY' };
  return { allowed: true };
}
