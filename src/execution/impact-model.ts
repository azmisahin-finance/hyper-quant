import { createHash } from 'node:crypto';

export type ImpactCalibrationPoint = { participationRate: number; impactBps: number };
export type ImpactModel = {
  modelId: string;
  points: readonly ImpactCalibrationPoint[];
  modelHash: string;
};

function validRate(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 1; }
function validBps(value: number): boolean { return Number.isFinite(value) && value >= 0; }

export function buildImpactModel(modelId: string, points: readonly ImpactCalibrationPoint[]): ImpactModel {
  if (!modelId.trim() || points.length === 0) throw new Error('IMPACT_MODEL_REQUIRES_POINTS');
  const sorted = [...points].sort((a, b) => a.participationRate - b.participationRate);
  for (const point of sorted) {
    if (!validRate(point.participationRate) || !validBps(point.impactBps)) throw new Error('INVALID_IMPACT_CALIBRATION_POINT');
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i - 1].participationRate === sorted[i].participationRate) throw new Error('DUPLICATE_IMPACT_PARTICIPATION');
    if (sorted[i].impactBps < sorted[i - 1].impactBps) throw new Error('NON_MONOTONIC_IMPACT_CURVE');
  }
  const modelHash = createHash('sha256').update(JSON.stringify({ modelId, points: sorted })).digest('hex');
  return { modelId, points: sorted.map((x) => ({ ...x })), modelHash };
}

export function interpolateImpactBps(model: ImpactModel, participationRate: number): number {
  if (!validRate(participationRate)) throw new Error('INVALID_PARTICIPATION_RATE');
  const points = model.points;
  if (participationRate <= points[0].participationRate) return points[0].impactBps;
  if (participationRate >= points[points.length - 1].participationRate) return points[points.length - 1].impactBps;
  for (let i = 1; i < points.length; i += 1) {
    const left = points[i - 1]; const right = points[i];
    if (participationRate <= right.participationRate) {
      const w = (participationRate - left.participationRate) / (right.participationRate - left.participationRate);
      return left.impactBps + (right.impactBps - left.impactBps) * w;
    }
  }
  return points[points.length - 1].impactBps;
}
