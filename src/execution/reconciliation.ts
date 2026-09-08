import { isTerminalIntentState, type IntentState } from './intent-state-machine.js';
import type { IntentRecord, IntentStore } from './intent-journal.js';

export type ReconciliationObservation =
  | { status: 'CONFIRMED'; remoteId: string }
  | { status: 'NOT_FOUND' }
  | { status: 'UNAVAILABLE' };

export interface ExchangeReconciler {
  find(intent: IntentRecord): Promise<ReconciliationObservation>;
}

export type EscalationState = 'ESCALATION_RAISED' | 'ESCALATION_DELIVERED' | 'ESCALATION_ACKNOWLEDGED';

export type ReconciliationPolicy = {
  maxAttempts: number;
  backoffMs: readonly number[];
};

export type ReconciliationResult =
  | { status: 'CONFIRMED'; remoteId: string; attempts: number }
  | { status: 'UNKNOWN_REQUIRES_RECONCILIATION'; attempts: number }
  | { status: 'RECONCILIATION_FAILED'; attempts: number; escalation: EscalationState };

export class ReconciliationService {
  constructor(
    private readonly store: IntentStore,
    private readonly reconciler: ExchangeReconciler,
    private readonly policy: ReconciliationPolicy,
    private readonly sleep: (ms: number) => Promise<void> = async () => undefined,
  ) {}

  async reconcile(intent: IntentRecord, updateState: (intent: IntentRecord, expected: IntentState, next: IntentState) => Promise<IntentRecord>): Promise<ReconciliationResult> {
    if (isTerminalIntentState(intent.state)) {
      return intent.state === 'CONFIRMED'
        ? { status: 'CONFIRMED', remoteId: 'already-confirmed', attempts: 0 }
        : { status: 'RECONCILIATION_FAILED', attempts: 0, escalation: 'ESCALATION_ACKNOWLEDGED' };
    }

    let current = intent;
    if (current.state === 'UNKNOWN_REQUIRES_RECONCILIATION') {
      current = await updateState(current, 'UNKNOWN_REQUIRES_RECONCILIATION', 'RECONCILING');
    }

    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt += 1) {
      const observation = await this.reconciler.find(current);
      if (observation.status === 'CONFIRMED') {
        await updateState(current, 'RECONCILING', 'CONFIRMED');
        return { status: 'CONFIRMED', remoteId: observation.remoteId, attempts: attempt };
      }
      if (attempt < this.policy.maxAttempts && this.policy.backoffMs[attempt - 1] !== undefined) {
        await this.sleep(this.policy.backoffMs[attempt - 1]);
      }
    }

    await updateState(current, 'RECONCILING', 'RECONCILIATION_FAILED');
    return { status: 'RECONCILIATION_FAILED', attempts: this.policy.maxAttempts, escalation: 'ESCALATION_RAISED' };
  }

  async pendingBeforeNewIntent(instrumentId: string): Promise<boolean> {
    const pending = await this.store.listNonTerminalForInstrument(instrumentId);
    return pending.length > 0;
  }
}
