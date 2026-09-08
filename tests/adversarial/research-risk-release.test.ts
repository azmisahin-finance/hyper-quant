import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deriveDependencyManifest, enforceDeclaredLookback } from '../../src/research/dependency.js';
import { ResearchTrialLedger } from '../../src/research/trial-ledger.js';
import { buildArtifactIdentityChain, assertArtifactIdentity } from '../../src/research/artifact-identity.js';
import { HoldoutLedger } from '../../src/research/holdout-ledger.js';
import { validateStatisticalEvidence } from '../../src/research/statistics.js';
import { evaluateExposure } from '../../src/risk/exposure-engine.js';
import { createFrozenPromotionPolicy, evaluatePromotion } from '../../src/risk/promotion-policy.js';
import { buildCapabilityManifest, assertProductionCapabilityParity } from '../../src/release/capability-parity.js';
import { assertMutationCoverage, validateChaosRegistry, type ChaosScenario } from '../../src/release/chaos-contract.js';

test('GAP-04: executable dependency derivation controls purge and rejects undershoot', () => {
  const manifest = deriveDependencyManifest([{ id: 'f1', inputs: ['close'], lookback: 20, labelHorizon: 5 }]);
  assert.equal(manifest.purgeWindow, 25);
  assert.throws(() => enforceDeclaredLookback(19, manifest), /DECLARED_LOOKBACK_UNDERSHOOT/);
});

test('GAP-04/06: artifact identity mismatch is fail-closed', () => {
  const chain = buildArtifactIdentityChain({ sourceTreeHash: 'a', artifactHash: 'b', manifestHash: 'c', dependencyLockHash: 'd', dependencyGraphHash: 'e', buildEnvironmentHash: 'f', executableArtifactHash: 'g' });
  assert.doesNotThrow(() => assertArtifactIdentity(chain, chain));
  const tampered = { ...chain, executableArtifactHash: 'evil' };
  assert.throws(() => assertArtifactIdentity(chain, tampered), /EXECUTABLE_ARTIFACT_IDENTITY_MISMATCH/);
});

test('GAP-05: holdout budget is monotonic and bound to governed root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-holdout-'));
  try {
    const ledger = new HoldoutLedger(join(root, 'ledger.jsonl'), 'ROOT-1', { global: 3, family: 3, lineage: 3 });
    await ledger.evaluate({ programRootId: 'ROOT-1', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 2, resultClass: 'PASS' });
    assert.equal(await ledger.consumed('GLOBAL'), 2);
    await assert.rejects(() => ledger.evaluate({ programRootId: 'ROOT-1', familyId: 'F2', lineageId: 'L2', scope: 'LINEAGE', units: 2, resultClass: 'FAIL' }), /GLOBAL_HOLDOUT_BUDGET_EXCEEDED/);
    await assert.rejects(() => ledger.evaluate({ programRootId: 'ROOT-2', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'FAIL' }), /HOLDOUT_PROGRAM_ROOT_MISMATCH/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('GAP-03: statistical gate requires sufficient sample, committed trial count, and DSR', () => {
  assert.equal(validateStatisticalEvidence({ meanTradeExpectancy: 1, sampleCount: 100, sampleStdDev: 2, declaredTrialCount: 40, dsr: 0.99 }, { minSampleCount: 50, minDsr: 0.95 }).pass, true);
  assert.deepEqual(validateStatisticalEvidence({ meanTradeExpectancy: 1, sampleCount: 100, sampleStdDev: 2, declaredTrialCount: 0, dsr: 0.99 }, { minSampleCount: 50, minDsr: 0.95 }), { pass: false, reason: 'INVALID_TRIAL_COUNT' });
});

test('GAP-11: exposure engine fails closed on unknowns and enforces capital identities', () => {
  const base = { approvedCapital: 100, allocatedCapital: 50, deployedCapital: 25, grossExposure: 40, netExposure: 10, marginUtilization: 0.2, liquidityUsage: 0.1, concentrationExposure: 0.1, correlationAdjustedRisk: 0.2, tailLoss: 5 };
  assert.deepEqual(evaluateExposure(base, { ...base, deployedCapital: 55 }, { approvedCapital: 100, allocatedCapital: 100, deployedCapital: 100, grossExposure: 100, netExposure: 100, marginUtilization: 1, liquidityUsage: 1, concentrationExposure: 1, correlationAdjustedRisk: 1, tailLoss: 100 }), { allowed: false, reason: 'DEPLOYED_GT_ALLOCATED' });
  assert.deepEqual(evaluateExposure(base, { ...base, correlationAdjustedRisk: Number.NaN }, { ...base }), { allowed: false, reason: 'UNKNOWN_correlationAdjustedRisk' });
});

test('GAP-09: promotion policy forbids level skips and allocation velocity > 2x', () => {
  const good = { policy: createFrozenPromotionPolicy('policy-1'), currentLevel: 1 as const, requestedLevel: 2 as const, positiveOos: true, acceptableDrawdown: true, executionStable: true, safetyClean: true, regimeCovered: true, calibrationAcceptable: true, observations: 100, minObservations: 50, dwellHours: 24, minDwellHours: 12, previousPromotionHoursAgo: 48, minVelocityHours: 24, priorAllocation: 10, requestedAllocation: 20, aggregateRiskPassed: true };
  assert.deepEqual(evaluatePromotion(good), { allowed: true });
  assert.deepEqual(evaluatePromotion({ ...good, requestedLevel: 3 }), { allowed: false, reason: 'LEVEL_SKIP_FORBIDDEN' });
  assert.deepEqual(evaluatePromotion({ ...good, requestedAllocation: 21 }), { allowed: false, reason: 'ALLOCATION_VELOCITY_FAILED' });
});

test('GAP-10/12: capability parity and deterministic chaos registry are hard gates', () => {
  const tested = buildCapabilityManifest(['SAFETY_AUTHORIZATION', 'INTENT_STATE_MACHINE']);
  assert.doesNotThrow(() => assertProductionCapabilityParity(tested, buildCapabilityManifest(['SAFETY_AUTHORIZATION', 'INTENT_STATE_MACHINE'])));
  assert.doesNotThrow(() => assertProductionCapabilityParity(buildCapabilityManifest(['SAFETY_AUTHORIZATION', 'INTENT_STATE_MACHINE', 'DETERMINISTIC_BARRIER']), tested));
  assert.throws(() => assertProductionCapabilityParity(tested, buildCapabilityManifest(['SAFETY_AUTHORIZATION', 'DEBUG_REMOTE_ENDPOINT'])), /TEST_ONLY_CAPABILITY_IN_PRODUCTION/);
  const scenarios: ChaosScenario[] = [{ scenarioId: 'KILL-BEFORE-REVALIDATE', precondition: 'snapshot-valid', faultInjection: 'activate-venue-kill', expectedState: 'DENIED', expectedMutationProhibition: true, expectedRecovery: 'slot-free', expectedAuditEvent: 'STALE_AUTHORIZATION', severity: 'P1', evidenceArtifact: 'test-artifact-1' }];
  validateChaosRegistry(scenarios);
  assertMutationCoverage(scenarios, ['KILL-BEFORE-REVALIDATE']);
});

test('GAP-05: concurrent holdout writes serialize and cannot oversubscribe lineage budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-holdout-race-'));
  try {
    const ledger = new HoldoutLedger(join(root, 'ledger.jsonl'), 'ROOT-1', { global: 2, family: 2, lineage: 1 });
    const results = await Promise.allSettled([
      ledger.evaluate({ programRootId: 'ROOT-1', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'PASS' }),
      ledger.evaluate({ programRootId: 'ROOT-1', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'PASS' }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await ledger.consumed('LINEAGE', 'F1', 'L1'), 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('Research governance: trial receipt is required before outcome', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-trials-'));
  try {
    const ledger = new ResearchTrialLedger(join(root, 'trials.jsonl'));
    const receipt = { trialId: 'T1', researchProgramId: 'P1', hypothesisId: 'H1', codeHash: 'c', configHash: 'cfg', datasetHash: 'd', selectionPolicyHash: 's', parentTrialIds: [], createdAt: new Date(0).toISOString() };
    await assert.rejects(() => ledger.recordOutcome({ ...receipt, outcome: 'FAIL', completedAt: new Date().toISOString() }), /TRIAL_RECEIPT_REQUIRED_BEFORE_OUTCOME/);
    await ledger.registerBeforeRun(receipt);
    await assert.rejects(() => ledger.registerBeforeRun(receipt), /TRIAL_ID_ALREADY_REGISTERED/);
    await ledger.recordOutcome({ ...receipt, outcome: 'FAIL', completedAt: new Date().toISOString() });
    assert.equal(await ledger.hasReceipt('T1'), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('research validation: DSR is computed from returns and committed trial count, not analyst-supplied DSR', async () => {
  const { computeDeflatedSharpeRatio } = await import('../../src/research/dsr.js');
  const returns = Array.from({ length: 80 }, (_, i) => (i % 9 === 0 ? 0.03 : 0.004));
  const lowerTrialDsr = computeDeflatedSharpeRatio({ returns, committedTrialCount: 5 });
  const higherTrialDsr = computeDeflatedSharpeRatio({ returns, committedTrialCount: 500 });
  assert.ok(lowerTrialDsr.dsr >= higherTrialDsr.dsr);
  assert.equal(lowerTrialDsr.sampleCount, returns.length);
  assert.equal(higherTrialDsr.committedTrialCount, 500);
  assert.notEqual(lowerTrialDsr.expectedMaxSharpe, higherTrialDsr.expectedMaxSharpe);
});

test('research validation: search diagnostics bind selected returns, PBO, and computed DSR', async () => {
  const { runSearchCampaignDiagnostics } = await import('../../src/research/search-diagnostics.js');
  const candidateReturns = [
    Array.from({ length: 24 }, (_, i) => (i < 12 ? 0.01 : -0.005)),
    Array.from({ length: 24 }, () => 0.004),
    Array.from({ length: 24 }, (_, i) => (i % 4 === 0 ? 0.02 : 0.001)),
  ];
  const result = runSearchCampaignDiagnostics({ candidateReturns, selectedCandidateIndex: 1, blockCount: 4, committedTrialCount: 3 });
  assert.equal(result.selectedReturns.length, 24);
  assert.equal(result.committedTrialCount, 3);
  assert.equal(result.pboCscv.combinationsEvaluated, 6);
  assert.equal(result.dsr.committedTrialCount, 3);
  assert.match(result.resultHash, /^[0-9a-f]{64}$/);
});

test('research validation: DSR rejects non-finite and zero-variance returns', async () => {
  const { computeDeflatedSharpeRatio } = await import('../../src/research/dsr.js');
  assert.throws(() => computeDeflatedSharpeRatio({ returns: [0.01, Number.NaN, 0.02], committedTrialCount: 2 }), /NON_FINITE_DSR_RETURN/);
  assert.throws(() => computeDeflatedSharpeRatio({ returns: [0.01, 0.01, 0.01], committedTrialCount: 2 }), /ZERO_DSR_VARIANCE/);
});
