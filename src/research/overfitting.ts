export type CsCvInput = {
  candidateReturns: readonly (readonly number[])[];
  blockCount: number;
  maxCombinations?: number;
};

export type CsCvSplitResult = {
  combinationId: number;
  inSampleCandidate: number;
  inSampleScore: number;
  outOfSampleScore: number;
  outOfSampleRankFraction: number;
  logit: number;
};

export type CsCvResult = {
  pbo: number;
  combinationsEvaluated: number;
  splits: readonly CsCvSplitResult[];
};

function assertFiniteReturns(candidateReturns: readonly (readonly number[])[]): void {
  if (candidateReturns.length < 2) throw new Error('INSUFFICIENT_CANDIDATES_FOR_CSCV');
  const blockLength = candidateReturns[0]?.length ?? 0;
  if (blockLength === 0) throw new Error('EMPTY_RETURN_SERIES');
  for (const values of candidateReturns) {
    if (values.length !== blockLength) throw new Error('CANDIDATE_RETURN_LENGTH_MISMATCH');
    if (values.some((value) => !Number.isFinite(value))) throw new Error('NON_FINITE_RETURN');
  }
}

function combinations(values: number[], choose: number, limit: number): number[][] {
  const output: number[][] = [];
  const current: number[] = [];
  function visit(start: number): void {
    if (output.length >= limit) return;
    if (current.length === choose) {
      output.push([...current]);
      return;
    }
    for (let i = start; i < values.length; i += 1) {
      current.push(values[i]);
      visit(i + 1);
      current.pop();
      if (output.length >= limit) return;
    }
  }
  visit(0);
  return output;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function medianRankFraction(values: readonly number[], selected: number): number {
  let lower = 0;
  for (const value of values) if (value < selected) lower += 1;
  return (lower + 0.5) / values.length;
}

function safeLogit(p: number): number {
  const bounded = Math.min(1 - 1e-12, Math.max(1e-12, p));
  return Math.log(bounded / (1 - bounded));
}

/**
 * Deterministic CSCV/PBO reference implementation.
 *
 * The sample is partitioned into an even number of contiguous blocks. For every
 * unique half-sample selection, the best in-sample candidate is selected and its
 * out-of-sample rank is measured against all candidates. PBO is the fraction of
 * selections whose selected candidate has negative logit(rank fraction), i.e.
 * below the 50th percentile out of sample.
 *
 * This is a governance diagnostic, not a guarantee of future performance.
 */
export function computePboCscv(input: CsCvInput): CsCvResult {
  assertFiniteReturns(input.candidateReturns);
  if (!Number.isInteger(input.blockCount) || input.blockCount < 4 || input.blockCount % 2 !== 0) throw new Error('BLOCK_COUNT_MUST_BE_EVEN_GE_4');
  const blockLength = input.candidateReturns[0].length;
  if (blockLength % input.blockCount !== 0) throw new Error('RETURN_LENGTH_NOT_DIVISIBLE_BY_BLOCK_COUNT');
  const blocksPerHalf = input.blockCount / 2;
  const defaultLimit = 100_000;
  const maxCombinations = input.maxCombinations ?? defaultLimit;
  if (!Number.isInteger(maxCombinations) || maxCombinations <= 0) throw new Error('INVALID_MAX_COMBINATIONS');

  const blockIndices = Array.from({ length: input.blockCount }, (_, i) => i);
  const halves = combinations(blockIndices, blocksPerHalf, maxCombinations + 1);
  const allCount = Math.max(0, Math.floor(binomial(input.blockCount, blocksPerHalf)));
  if (allCount > maxCombinations) throw new Error('CSCV_COMBINATION_CAP_EXCEEDED');

  const blocks: number[][][] = input.candidateReturns.map((candidate) => {
    const width = blockLength / input.blockCount;
    return Array.from({ length: input.blockCount }, (_, block) => candidate.slice(block * width, (block + 1) * width));
  });

  const results: CsCvSplitResult[] = [];
  halves.forEach((inSampleBlocks, combinationId) => {
    if (combinationId >= allCount) return;
    const inSet = new Set(inSampleBlocks);
    const outSampleBlocks = blockIndices.filter((block) => !inSet.has(block));
    const inScores = blocks.map((candidate) => mean(inSampleBlocks.flatMap((block) => candidate[block])));
    const outScores = blocks.map((candidate) => mean(outSampleBlocks.flatMap((block) => candidate[block])));
    let bestCandidate = 0;
    for (let i = 1; i < inScores.length; i += 1) if (inScores[i] > inScores[bestCandidate]) bestCandidate = i;
    const selectedOos = outScores[bestCandidate];
    const rankFraction = medianRankFraction(outScores, selectedOos);
    results.push({
      combinationId,
      inSampleCandidate: bestCandidate,
      inSampleScore: inScores[bestCandidate],
      outOfSampleScore: selectedOos,
      outOfSampleRankFraction: rankFraction,
      logit: safeLogit(rankFraction),
    });
  });

  const negativeLogits = results.filter((result) => result.logit < 0).length;
  return {
    pbo: negativeLogits / results.length,
    combinationsEvaluated: results.length,
    splits: results,
  };
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}
