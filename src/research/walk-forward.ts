import { createPurgedSplit, type PurgedSplit } from './timeseries.js';

export type WalkForwardMode = 'EXPANDING' | 'ROLLING';

export type WalkForwardConfig = {
  trainBars: number;
  testBars: number;
  stepBars: number;
  purgeWindowBars: number;
  embargoBars: number;
  mode: WalkForwardMode;
};

export type WalkForwardFold = {
  foldId: number;
  trainStartIndex: number;
  testEndIndexExclusive: number;
  split: PurgedSplit;
};

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`INVALID_${name}`);
}

export function createWalkForwardFolds(length: number, config: WalkForwardConfig): WalkForwardFold[] {
  if (!Number.isInteger(length) || length <= 0) throw new Error('INVALID_DATASET_LENGTH');
  assertPositiveInteger('TRAIN_BARS', config.trainBars);
  assertPositiveInteger('TEST_BARS', config.testBars);
  assertPositiveInteger('STEP_BARS', config.stepBars);
  if (config.stepBars < config.testBars) throw new Error('STEP_BARS_MUST_NOT_OVERLAP_TESTS');
  if (!Number.isInteger(config.purgeWindowBars) || config.purgeWindowBars < 0) throw new Error('INVALID_PURGE_WINDOW_BARS');
  if (!Number.isInteger(config.embargoBars) || config.embargoBars < 0) throw new Error('INVALID_EMBARGO_BARS');

  const gap = config.purgeWindowBars + config.embargoBars;
  const folds: WalkForwardFold[] = [];
  let foldId = 0;
  let testStart = config.trainBars + gap;

  while (testStart + config.testBars <= length) {
    const trainEnd = testStart - gap;
    const trainStart = config.mode === 'EXPANDING'
      ? 0
      : Math.max(0, trainEnd - config.trainBars);
    const localLength = length - trainStart;
    const localTrainEnd = trainEnd - trainStart;
    const localTestStart = testStart - trainStart;
    const split = createPurgedSplit(localLength, {
      trainEndIndexExclusive: localTrainEnd,
      testStartIndex: localTestStart,
      purgeWindowBars: config.purgeWindowBars,
      embargoBars: config.embargoBars,
    });
    const offset = trainStart;
    folds.push({
      foldId,
      trainStartIndex: trainStart,
      testEndIndexExclusive: testStart + config.testBars,
      split: {
        trainIndices: split.trainIndices.map((i) => i + offset),
        testIndices: split.testIndices.filter((i) => i < localTestStart + config.testBars).map((i) => i + offset),
        purgedIndices: split.purgedIndices.map((i) => i + offset),
        embargoedIndices: split.embargoedIndices.map((i) => i + offset),
      },
    });
    foldId += 1;
    testStart += config.stepBars;
  }

  if (folds.length === 0) throw new Error('INSUFFICIENT_WALK_FORWARD_HISTORY');

  for (let i = 1; i < folds.length; i += 1) {
    const prev = folds[i - 1].split.testIndices;
    const current = folds[i].split.testIndices;
    if ((prev.at(-1) ?? -1) >= current[0]) throw new Error('WALK_FORWARD_TEST_OVERLAP');
  }

  return folds;
}

export function assertWalkForwardIntegrity(folds: readonly WalkForwardFold[], purgeWindowBars: number, embargoBars: number): void {
  if (folds.length === 0) throw new Error('EMPTY_WALK_FORWARD');
  for (const fold of folds) {
    const trainEnd = fold.split.trainIndices.at(-1) ?? -1;
    const testStart = fold.split.testIndices[0] ?? -1;
    if (trainEnd < 0 || testStart < 0) throw new Error('INVALID_WALK_FORWARD_FOLD');
    const requiredGap = purgeWindowBars + embargoBars;
    if (testStart - trainEnd - 1 < requiredGap) throw new Error('WALK_FORWARD_PURGE_EMBARGO_VIOLATION');
  }
}
