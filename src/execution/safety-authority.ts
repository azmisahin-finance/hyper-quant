import { createHash } from 'node:crypto';
import type { MutationScope, VersionedSafetyState } from './mutation-coordinator.js';

export type HardRiskEvaluator = (target: MutationScope) => boolean;
export type DependencyCompatibilityEvaluator = (target: MutationScope, state: VersionedSafetyState) => boolean;
export type ExecutionPolicyEvaluator = (target: MutationScope, state: VersionedSafetyState) => boolean;

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(',')}}`;
}

export function authorizationHash(input: Omit<AuthorizationHashInput, 'authorizationHash'>): string {
  return createHash('sha256').update(canonicalize(input)).digest('hex');
}

export type AuthorizationHashInput = {
  target: MutationScope;
  killStateVersion: number;
  dependencyGraphVersion: number;
  riskAuthorizationVersion: number;
  executionPolicyVersion: number;
  expiresAt: number;
  nonce: string;
  authorizationHash: string;
};
