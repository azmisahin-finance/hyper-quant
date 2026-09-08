import { createHash } from 'node:crypto';

export type ArtifactIdentityChain = {
  sourceTreeHash: string;
  artifactHash: string;
  manifestHash: string;
  dependencyLockHash: string;
  dependencyGraphHash: string;
  buildEnvironmentHash: string;
  executableArtifactHash: string;
  chainHash: string;
};

function sha(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildArtifactIdentityChain(input: Omit<ArtifactIdentityChain, 'chainHash'>): ArtifactIdentityChain {
  const chainHash = sha(input);
  return { ...input, chainHash };
}

export function assertArtifactIdentity(expected: ArtifactIdentityChain, executed: ArtifactIdentityChain): void {
  const { chainHash: expectedChainHash, ...expectedPayload } = expected;
  const { chainHash: executedChainHash, ...executedPayload } = executed;
  if (expectedChainHash !== executedChainHash || sha(expectedPayload) !== executedChainHash || sha(expectedPayload) !== sha(executedPayload)) {
    throw new Error('EXECUTABLE_ARTIFACT_IDENTITY_MISMATCH');
  }
}
