export type LatencyObservation = {
  submitToVenueMs: number;
  venueAckMs: number;
  fillToBookMs: number;
};

export type LatencyProfile = {
  profileId: string;
  observations: readonly LatencyObservation[];
  quantilesMs: { p50: number; p90: number; p99: number };
  profileHash: string;
};

function nonNegativeFinite(value: number): boolean { return Number.isFinite(value) && value >= 0; }
function validateObservation(value: LatencyObservation): void {
  for (const n of Object.values(value)) if (!nonNegativeFinite(n)) throw new Error('INVALID_LATENCY_OBSERVATION');
}
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error('EMPTY_LATENCY_PROFILE');
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index); const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

import { createHash } from 'node:crypto';

export function buildLatencyProfile(profileId: string, observations: readonly LatencyObservation[]): LatencyProfile {
  if (!profileId.trim() || observations.length === 0) throw new Error('LATENCY_PROFILE_REQUIRES_OBSERVATIONS');
  observations.forEach(validateObservation);
  const values = observations.map((x) => x.submitToVenueMs + x.venueAckMs + x.fillToBookMs).sort((a, b) => a - b);
  const quantilesMs = { p50: percentile(values, 0.5), p90: percentile(values, 0.9), p99: percentile(values, 0.99) };
  const canonical = JSON.stringify({ profileId, observations, quantilesMs });
  const profileHash = createHash('sha256').update(canonical).digest('hex');
  return { profileId, observations: observations.map((x) => ({ ...x })), quantilesMs, profileHash };
}

export function chooseLatencyMs(profile: LatencyProfile, sampleIndex: number): number {
  if (!Number.isInteger(sampleIndex) || sampleIndex < 0) throw new Error('INVALID_LATENCY_SAMPLE_INDEX');
  if (profile.observations.length === 0) throw new Error('EMPTY_LATENCY_PROFILE');
  const observation = profile.observations[sampleIndex % profile.observations.length];
  return observation.submitToVenueMs + observation.venueAckMs + observation.fillToBookMs;
}
