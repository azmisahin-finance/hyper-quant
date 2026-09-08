import { createHash } from 'node:crypto';

export type CapabilityManifest = { capabilities: string[]; hash: string };
const FORBIDDEN_PRODUCTION_CAPABILITIES = ['DETERMINISTIC_BARRIER', 'TEST_MUTATION_EXECUTOR', 'FAULT_INJECTOR', 'DEBUG_REMOTE_ENDPOINT'];

function safetyCapabilities(capabilities: readonly string[]): string[] {
  return [...new Set(capabilities.filter((capability) => !FORBIDDEN_PRODUCTION_CAPABILITIES.includes(capability)))].sort();
}

function hashCapabilities(capabilities: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(capabilities)).digest('hex');
}

export function buildCapabilityManifest(capabilities: readonly string[]): CapabilityManifest {
  const normalized = [...new Set(capabilities)].sort();
  return { capabilities: normalized, hash: hashCapabilities(normalized) };
}

export function assertProductionCapabilityParity(tested: CapabilityManifest, production: CapabilityManifest): void {
  if (production.capabilities.some((capability) => FORBIDDEN_PRODUCTION_CAPABILITIES.includes(capability))) throw new Error('TEST_ONLY_CAPABILITY_IN_PRODUCTION');
  if (hashCapabilities(safetyCapabilities(tested.capabilities)) !== hashCapabilities(safetyCapabilities(production.capabilities))) throw new Error('CAPABILITY_MANIFEST_MISMATCH');
}
