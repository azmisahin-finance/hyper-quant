import { createHash } from 'node:crypto';
import { chooseLatencyMs, type LatencyProfile } from './latency-model.js';

export type ShadowDecision = {
  decisionId: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  decisionTimeMs: number;
  latencySampleIndex: number;
  expectedArrivalMs: number;
  expectedPrice?: number;
  strategyArtifactHash: string;
};

export type ShadowObservation = {
  decisionId: string;
  observedAtMs: number;
  observedBid?: number;
  observedAsk?: number;
  observedLast?: number;
  actionability: 'ACTIONABLE' | 'NOT_ACTIONABLE' | 'UNKNOWN';
  divergenceBps?: number;
};

export type ShadowSession = {
  sessionId: string;
  decisions: readonly ShadowDecision[];
  observations: readonly ShadowObservation[];
  sessionHash: string;
};

function finiteNonNegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }

export class DeterministicShadowExecutor {
  private readonly decisions: ShadowDecision[] = [];
  private readonly observations: ShadowObservation[] = [];

  constructor(private readonly sessionId: string, private readonly latency: LatencyProfile) {
    if (!sessionId.trim()) throw new Error('SHADOW_SESSION_ID_REQUIRED');
  }

  recordDecision(input: Omit<ShadowDecision, 'expectedArrivalMs'>): ShadowDecision {
    if (!input.decisionId || !input.orderId || !input.symbol || !input.strategyArtifactHash) throw new Error('INVALID_SHADOW_DECISION');
    if (!positive(input.quantity) || !finiteNonNegative(input.decisionTimeMs)) throw new Error('INVALID_SHADOW_DECISION');
    const expectedArrivalMs = input.decisionTimeMs + chooseLatencyMs(this.latency, input.latencySampleIndex);
    const decision: ShadowDecision = { ...input, expectedArrivalMs };
    if (this.decisions.some((x) => x.decisionId === decision.decisionId)) throw new Error('SHADOW_DECISION_REPLAY');
    this.decisions.push(decision);
    return decision;
  }

  observe(input: ShadowObservation): void {
    if (!input.decisionId || !finiteNonNegative(input.observedAtMs)) throw new Error('INVALID_SHADOW_OBSERVATION');
    const decision = this.decisions.find((x) => x.decisionId === input.decisionId);
    if (!decision) throw new Error('SHADOW_DECISION_NOT_FOUND');
    if (input.observedAtMs < decision.expectedArrivalMs) throw new Error('OBSERVATION_BEFORE_EXPECTED_ARRIVAL');
    if (input.actionability === 'ACTIONABLE') {
      if (decision.side === 'BUY' && (!positive(input.observedAsk ?? NaN))) throw new Error('ACTIONABLE_BUY_REQUIRES_ASK');
      if (decision.side === 'SELL' && (!positive(input.observedBid ?? NaN))) throw new Error('ACTIONABLE_SELL_REQUIRES_BID');
    }
    if (input.divergenceBps !== undefined && !Number.isFinite(input.divergenceBps)) throw new Error('INVALID_SHADOW_DIVERGENCE');
    this.observations.push({ ...input });
  }

  result(): ShadowSession {
    const canonical = JSON.stringify({ sessionId: this.sessionId, decisions: this.decisions, observations: this.observations });
    return {
      sessionId: this.sessionId,
      decisions: [...this.decisions],
      observations: [...this.observations],
      sessionHash: createHash('sha256').update(canonical).digest('hex'),
    };
  }
}
