export type DsrInput = {
  returns: readonly number[];
  committedTrialCount: number;
  benchmarkSharpe?: number;
};

export const DSR_RETURN_CONVENTION = 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV' as const;

export type DsrResult = {
  method: 'CLASSIC_DSR_LS';
  returnConvention: typeof DSR_RETURN_CONVENTION;
  sampleCount: number;
  sharpe: number;
  skewness: number;
  kurtosis: number;
  expectedMaxSharpe: number;
  sharpeStdError: number;
  dsr: number;
  committedTrialCount: number;
};

function assertReturns(values: readonly number[]): void {
  if (values.length < 2) throw new Error('INSUFFICIENT_DSR_SAMPLE');
  if (values.some((value) => !Number.isFinite(value))) throw new Error('NON_FINITE_DSR_RETURN');
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * value);
  const polynomial = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
  const erf = 1 - polynomial * t * Math.exp(-(value * value));
  return 0.5 * (1 + sign * erf);
}

function inverseNormalCdf(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error('INVALID_NORMAL_QUANTILE');
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425;
  const phigh = 1 - plow;
  const horner = (coeffs: readonly number[], x: number): number => {
    let value = coeffs[0];
    for (let i = 1; i < coeffs.length; i += 1) value = value * x + coeffs[i];
    return value;
  };
  if (p < plow || p > phigh) {
    const tail = p < plow ? p : 1 - p;
    const q = Math.sqrt(-2 * Math.log(tail));
    const value = horner(c, q) / horner([...d, 1], q);
    return p < plow ? value : -value;
  }
  const q = p - 0.5;
  const r = q * q;
  return (horner(a, r) * q) / horner([...b, 1], r);
}

function sampleMoments(values: readonly number[]): { mean: number; std: number; skewness: number; kurtosis: number } {
  const avg = mean(values);
  const n = values.length;
  const centered = values.map((value) => value - avg);
  const m2 = centered.reduce((sum, value) => sum + value ** 2, 0) / n;
  const m3 = centered.reduce((sum, value) => sum + value ** 3, 0) / n;
  const m4 = centered.reduce((sum, value) => sum + value ** 4, 0) / n;
  const std = Math.sqrt(centered.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, n - 1));
  const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
  const kurtosis = m2 > 0 ? m4 / (m2 * m2) : 3;
  return { mean: avg, std, skewness, kurtosis };
}

/**
 * Classic DSR-LS approximation based on the maximum expected Sharpe among N trials,
 * with the non-normality-adjusted Sharpe uncertainty term used by Bailey/López de Prado.
 * This is an inference diagnostic, not a proof of future profitability.
 */
export function computeDeflatedSharpeRatio(input: DsrInput): DsrResult {
  assertReturns(input.returns);
  if (!Number.isInteger(input.committedTrialCount) || input.committedTrialCount < 1) throw new Error('INVALID_COMMITTED_TRIAL_COUNT');
  const benchmark = input.benchmarkSharpe ?? 0;
  if (!Number.isFinite(benchmark)) throw new Error('INVALID_DSR_BENCHMARK');

  const { mean: avg, std, skewness, kurtosis } = sampleMoments(input.returns);
  if (!(std > 0) || !Number.isFinite(std)) throw new Error('ZERO_DSR_VARIANCE');
  const sharpe = avg / std;
  const n = input.returns.length;
  const variance = (1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe) / Math.max(1, n - 1);
  if (!(variance > 0) || !Number.isFinite(variance)) throw new Error('INVALID_DSR_VARIANCE');
  const sharpeStdError = Math.sqrt(variance);
  const trials = input.committedTrialCount;
  const gammaEuler = 0.5772156649015329;
  const expectedMaxSharpe = trials === 1
    ? benchmark
    : benchmark + sharpeStdError * ((1 - gammaEuler) * inverseNormalCdf(1 - 1 / trials) + gammaEuler * inverseNormalCdf(1 - 1 / (trials * Math.E)));
  const dsr = normalCdf((sharpe - expectedMaxSharpe) / sharpeStdError);
  return { method: 'CLASSIC_DSR_LS', returnConvention: DSR_RETURN_CONVENTION, sampleCount: n, sharpe, skewness, kurtosis, expectedMaxSharpe, sharpeStdError, dsr, committedTrialCount: trials };
}
