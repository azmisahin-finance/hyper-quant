export type PsrInput = {
  returns: readonly number[];
  benchmarkSharpe?: number;
};

export const PSR_RETURN_CONVENTION = 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV' as const;

export type PsrResult = {
  method: 'PSR_LOPEZ_DE_PRADO_APPROX';
  returnConvention: typeof PSR_RETURN_CONVENTION;
  sampleCount: number;
  sharpe: number;
  benchmarkSharpe: number;
  skewness: number;
  kurtosis: number;
  sharpeStdError: number;
  psr: number;
};

function assertReturns(values: readonly number[]): void {
  if (values.length < 2) throw new Error('INSUFFICIENT_PSR_SAMPLE');
  if (values.some((value) => !Number.isFinite(value))) throw new Error('NON_FINITE_PSR_RETURN');
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

function moments(values: readonly number[]): { mean: number; std: number; skewness: number; kurtosis: number } {
  const avg = mean(values);
  const n = values.length;
  const centered = values.map((value) => value - avg);
  const m2 = centered.reduce((sum, value) => sum + value ** 2, 0) / n;
  const m3 = centered.reduce((sum, value) => sum + value ** 3, 0) / n;
  const m4 = centered.reduce((sum, value) => sum + value ** 4, 0) / n;
  const std = Math.sqrt(centered.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, n - 1));
  if (!(std > 0) || !Number.isFinite(std)) throw new Error('ZERO_PSR_VARIANCE');
  return {
    mean: avg,
    std,
    skewness: m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0,
    kurtosis: m2 > 0 ? m4 / (m2 * m2) : 3,
  };
}

/**
 * Probabilistic Sharpe Ratio reference diagnostic.
 * This is an inference diagnostic, not proof of future profitability.
 */
export function computeProbabilisticSharpeRatio(input: PsrInput): PsrResult {
  assertReturns(input.returns);
  const benchmarkSharpe = input.benchmarkSharpe ?? 0;
  if (!Number.isFinite(benchmarkSharpe)) throw new Error('INVALID_PSR_BENCHMARK');
  const { mean: avg, std, skewness, kurtosis } = moments(input.returns);
  const sharpe = avg / std;
  const variance = (1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe) / Math.max(1, input.returns.length - 1);
  if (!(variance > 0) || !Number.isFinite(variance)) throw new Error('INVALID_PSR_VARIANCE');
  const sharpeStdError = Math.sqrt(variance);
  const psr = normalCdf((sharpe - benchmarkSharpe) / sharpeStdError);
  return { method: 'PSR_LOPEZ_DE_PRADO_APPROX', returnConvention: PSR_RETURN_CONVENTION, sampleCount: input.returns.length, sharpe, benchmarkSharpe, skewness, kurtosis, sharpeStdError, psr };
}
