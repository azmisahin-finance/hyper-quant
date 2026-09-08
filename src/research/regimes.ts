export type RegimeSegment = {
  regimeId: string;
  startIndexInclusive: number;
  endIndexExclusive: number;
};

export type RegimeEvaluation = {
  regimeId: string;
  observationCount: number;
  netReturn: number;
  meanReturn: number;
};

export type RegimeCoverageReport = {
  distinctRegimes: number;
  evaluations: readonly RegimeEvaluation[];
};

export function validateRegimeSegments(segments: readonly RegimeSegment[], length: number): void {
  if (!Number.isInteger(length) || length <= 0) throw new Error('INVALID_REGIME_LENGTH');
  if (segments.length === 0) throw new Error('EMPTY_REGIME_SEGMENTS');
  let previousEnd = 0;
  for (const segment of segments) {
    if (!segment.regimeId) throw new Error('INVALID_REGIME_ID');
    if (!Number.isInteger(segment.startIndexInclusive) || !Number.isInteger(segment.endIndexExclusive)) throw new Error('INVALID_REGIME_BOUNDARY');
    if (segment.startIndexInclusive !== previousEnd) throw new Error('REGIME_SEGMENTS_MUST_BE_CONTIGUOUS');
    if (segment.endIndexExclusive <= segment.startIndexInclusive || segment.endIndexExclusive > length) throw new Error('INVALID_REGIME_BOUNDARY');
    previousEnd = segment.endIndexExclusive;
  }
  if (previousEnd !== length) throw new Error('REGIME_SEGMENTS_MUST_COVER_SERIES');
}

export function evaluateRegimeCoverage(
  returns: readonly number[],
  evaluatedIndices: readonly number[],
  segments: readonly RegimeSegment[],
): RegimeCoverageReport {
  validateRegimeSegments(segments, returns.length);
  const mapping = new Map<number, string>();
  for (const segment of segments) for (let index = segment.startIndexInclusive; index < segment.endIndexExclusive; index += 1) mapping.set(index, segment.regimeId);
  const buckets = new Map<string, number[]>();
  for (const index of evaluatedIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= returns.length) throw new Error('INVALID_EVALUATED_INDEX');
    const value = returns[index];
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_REGIME_RETURN');
    const regimeId = mapping.get(index);
    if (!regimeId) throw new Error('MISSING_REGIME_CLASSIFICATION');
    const bucket = buckets.get(regimeId) ?? [];
    bucket.push(value);
    buckets.set(regimeId, bucket);
  }
  const evaluations = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([regimeId, values]) => ({
    regimeId,
    observationCount: values.length,
    netReturn: values.reduce((equity, value) => equity * (1 + value), 1) - 1,
    meanReturn: values.reduce((sum, value) => sum + value, 0) / values.length,
  }));
  return { distinctRegimes: evaluations.length, evaluations };
}
