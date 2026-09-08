export const IntentStates = [
  'INTENT_CREATED',
  'DURABLE',
  'RISK_AUTHORIZED',
  'SIGNING',
  'SUBMITTED',
  'CONFIRMED',
  'UNKNOWN_REQUIRES_RECONCILIATION',
  'RECONCILING',
  'RECONCILIATION_FAILED',
] as const;

export type IntentState = (typeof IntentStates)[number];

const transitions: Readonly<Record<IntentState, readonly IntentState[]>> = {
  INTENT_CREATED: ['DURABLE'],
  DURABLE: ['RISK_AUTHORIZED'],
  RISK_AUTHORIZED: ['SIGNING'],
  SIGNING: ['SUBMITTED'],
  SUBMITTED: ['CONFIRMED', 'UNKNOWN_REQUIRES_RECONCILIATION'],
  CONFIRMED: [],
  UNKNOWN_REQUIRES_RECONCILIATION: ['RECONCILING'],
  RECONCILING: ['CONFIRMED', 'RECONCILIATION_FAILED'],
  RECONCILIATION_FAILED: [],
};

export function isTerminalIntentState(state: IntentState): boolean {
  return state === 'CONFIRMED' || state === 'RECONCILIATION_FAILED';
}

export function isTransitionAllowed(from: IntentState, to: IntentState): boolean {
  return transitions[from].includes(to);
}

export function assertIntentTransition(from: IntentState, to: IntentState): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(`Forbidden intent transition: ${from} -> ${to}`);
  }
}

export const ForbiddenRecoveryTransitions = [
  ['UNKNOWN_REQUIRES_RECONCILIATION', 'SUBMITTED'],
  ['UNKNOWN_REQUIRES_RECONCILIATION', 'INTENT_CREATED'],
  ['UNKNOWN_REQUIRES_RECONCILIATION', 'CONFIRMED'],
  ['UNKNOWN_REQUIRES_RECONCILIATION', 'DURABLE'],
  ['RECONCILIATION_FAILED', 'SUBMITTED'],
  ['RECONCILIATION_FAILED', 'INTENT_CREATED'],
] as const;
