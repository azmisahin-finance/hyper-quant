import { createHash } from 'node:crypto';

export type FeatureNode = {
  id: string;
  inputs: string[];
  lookback: number;
  labelHorizon: number;
};

export type FeatureDependencyManifest = {
  featureIds: string[];
  inputColumns: string[];
  maxExtractedLookback: number;
  labelHorizon: number;
  purgeWindow: number;
  extractorVersion: string;
  analysisConfigHash: string;
  manifestHash: string;
};

export class DependencyBoundError extends Error {}

export function deriveDependencyManifest(nodes: readonly FeatureNode[], extractorVersion = 'dependency-extractor-v1', analysisConfigHash = 'default'): FeatureDependencyManifest {
  if (nodes.length === 0) throw new DependencyBoundError('NO_EXECUTABLE_FEATURES');
  if (!nodes.every((node) => node.id && Number.isInteger(node.lookback) && node.lookback >= 0 && Number.isInteger(node.labelHorizon) && node.labelHorizon >= 0)) {
    throw new DependencyBoundError('UNSOUND_FINITE_DEPENDENCY_BOUND');
  }
  const featureIds = [...nodes.map((node) => node.id)].sort();
  const inputColumns = [...new Set(nodes.flatMap((node) => node.inputs))].sort();
  const maxExtractedLookback = Math.max(...nodes.map((node) => node.lookback));
  const labelHorizon = Math.max(...nodes.map((node) => node.labelHorizon));
  const purgeWindow = labelHorizon + maxExtractedLookback;
  const unsigned = { featureIds, inputColumns, maxExtractedLookback, labelHorizon, purgeWindow, extractorVersion, analysisConfigHash };
  const manifestHash = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
  return { ...unsigned, manifestHash };
}

export function enforceDeclaredLookback(declaredLookback: number, manifest: FeatureDependencyManifest): void {
  if (!Number.isInteger(declaredLookback) || declaredLookback < manifest.maxExtractedLookback) {
    throw new DependencyBoundError('DECLARED_LOOKBACK_UNDERSHOOT');
  }
}
