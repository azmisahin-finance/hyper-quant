import { createHash } from 'node:crypto';
import type { FeatureNode } from './dependency.js';
import { assertStrictlyIncreasingTimes } from './timeseries.js';

export type ResearchBar = {
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FeatureContext = {
  index: number;
  history: readonly ResearchBar[];
};

export type FeatureDefinition = FeatureNode & {
  inputs: string[];
  compute: (context: FeatureContext) => number;
};

export type FeatureRow = {
  index: number;
  decisionTimeMs: number;
  availableAtMs: number;
  values: Record<string, number>;
  featureHash: string;
};

function assertFiniteBar(bar: ResearchBar): void {
  for (const value of [bar.open, bar.high, bar.low, bar.close, bar.volume]) {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_MARKET_VALUE');
  }
  if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0 || bar.volume < 0) {
    throw new Error('INVALID_MARKET_VALUE');
  }
}

export class FeatureEngine {
  constructor(private readonly definitions: readonly FeatureDefinition[]) {
    if (definitions.length === 0) throw new Error('NO_FEATURES_DEFINED');
    const ids = new Set<string>();
    for (const definition of definitions) {
      if (ids.has(definition.id)) throw new Error('DUPLICATE_FEATURE_ID');
      ids.add(definition.id);
      if (!Number.isInteger(definition.lookback) || definition.lookback < 0) throw new Error('INVALID_FEATURE_LOOKBACK');
      if (!Number.isInteger(definition.labelHorizon) || definition.labelHorizon < 0) throw new Error('INVALID_LABEL_HORIZON');
    }
  }

  evaluate(bars: readonly ResearchBar[]): FeatureRow[] {
    if (bars.length === 0) return [];
    assertStrictlyIncreasingTimes(bars.map((bar) => bar.timestampMs));
    bars.forEach(assertFiniteBar);

    return bars.map((bar, index) => {
      const history = Object.freeze(bars.slice(0, index + 1)) as readonly ResearchBar[];
      const values: Record<string, number> = {};
      for (const definition of this.definitions) {
        if (index < definition.lookback) {
          values[definition.id] = Number.NaN;
          continue;
        }
        const value = definition.compute({ index, history });
        if (!Number.isFinite(value)) throw new Error(`NON_FINITE_FEATURE:${definition.id}`);
        values[definition.id] = value;
      }
      const featureHash = createHash('sha256').update(JSON.stringify({ index, time: bar.timestampMs, values })).digest('hex');
      return {
        index,
        decisionTimeMs: bar.timestampMs,
        availableAtMs: bar.timestampMs,
        values,
        featureHash,
      };
    });
  }
}

export function rollingMeanFeature(id: string, lookback: number): FeatureDefinition {
  return {
    id,
    inputs: ['close'],
    lookback,
    labelHorizon: 1,
    compute: ({ history }) => {
      const start = history.length - lookback - 1;
      const window = history.slice(start, start + lookback);
      return window.reduce((sum, bar) => sum + bar.close, 0) / window.length;
    },
  };
}

export function rollingZScoreFeature(id: string, lookback: number): FeatureDefinition {
  return {
    id,
    inputs: ['close'],
    lookback,
    labelHorizon: 1,
    compute: ({ history }) => {
      const start = history.length - lookback - 1;
      const window = history.slice(start, start + lookback).map((bar) => bar.close);
      const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
      const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
      const std = Math.sqrt(variance);
      if (std === 0) return 0;
      return (history.at(-1)!.close - mean) / std;
    },
  };
}
