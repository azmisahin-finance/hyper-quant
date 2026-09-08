export type TimeSeriesObservation = {
  index: number;
  timeMs: number;
};

export type PurgedSplitConfig = {
  trainEndIndexExclusive: number;
  testStartIndex: number;
  purgeWindowBars: number;
  embargoBars: number;
};

export type PurgedSplit = {
  trainIndices: number[];
  testIndices: number[];
  purgedIndices: number[];
  embargoedIndices: number[];
};

export function assertStrictlyIncreasingTimes(timesMs: readonly number[]): void {
  for (let index = 0; index < timesMs.length; index += 1) {
    if (!Number.isFinite(timesMs[index])) throw new Error('NON_FINITE_TIME');
    if (index > 0 && timesMs[index] <= timesMs[index - 1]) throw new Error('NON_MONOTONIC_TIME');
  }
}

export function createPurgedSplit(length: number, config: PurgedSplitConfig): PurgedSplit {
  if (!Number.isInteger(length) || length <= 1) throw new Error('INVALID_DATASET_LENGTH');
  for (const value of Object.values(config)) {
    if (!Number.isInteger(value) || value < 0) throw new Error('INVALID_SPLIT_PARAMETER');
  }
  if (config.trainEndIndexExclusive > config.testStartIndex) throw new Error('TRAIN_AFTER_TEST');
  if (config.testStartIndex >= length || config.trainEndIndexExclusive === 0) throw new Error('INVALID_SPLIT_BOUNDARY');

  const requiredGap = config.purgeWindowBars + config.embargoBars;
  if (config.testStartIndex - config.trainEndIndexExclusive < requiredGap) {
    throw new Error('PURGE_EMBARGO_VIOLATION');
  }

  const trainIndices = Array.from({ length: config.trainEndIndexExclusive }, (_, i) => i);
  const purgedStart = config.trainEndIndexExclusive;
  const purgedEnd = Math.min(length, purgedStart + config.purgeWindowBars);
  const purgedIndices = Array.from({ length: purgedEnd - purgedStart }, (_, i) => purgedStart + i);
  const embargoStart = purgedEnd;
  const embargoEnd = Math.min(length, config.testStartIndex);
  const embargoedIndices = Array.from({ length: embargoEnd - embargoStart }, (_, i) => embargoStart + i);
  const testIndices = Array.from({ length: length - config.testStartIndex }, (_, i) => config.testStartIndex + i);

  return { trainIndices, testIndices, purgedIndices, embargoedIndices };
}
