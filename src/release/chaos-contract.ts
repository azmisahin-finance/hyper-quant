export type ChaosScenario = {
  scenarioId: string;
  precondition: string;
  faultInjection: string;
  expectedState: string;
  expectedMutationProhibition: boolean;
  expectedRecovery: string;
  expectedAuditEvent: string;
  severity: 'P1' | 'P2';
  evidenceArtifact: string;
};

export function validateChaosRegistry(scenarios: readonly ChaosScenario[]): void {
  if (scenarios.length === 0) throw new Error('CHAOS_REGISTRY_EMPTY');
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (ids.has(scenario.scenarioId)) throw new Error('CHAOS_SCENARIO_DUPLICATE');
    ids.add(scenario.scenarioId);
    if (!scenario.precondition || !scenario.faultInjection || !scenario.expectedState || !scenario.expectedRecovery || !scenario.expectedAuditEvent || !scenario.evidenceArtifact) throw new Error('CHAOS_SCENARIO_INCOMPLETE');
  }
}

export function assertMutationCoverage(scenarios: readonly ChaosScenario[], requiredScenarioIds: readonly string[]): void {
  const available = new Set(scenarios.map((scenario) => scenario.scenarioId));
  for (const required of requiredScenarioIds) if (!available.has(required)) throw new Error(`CHAOS_MUTATION_COVERAGE_MISSING:${required}`);
}
