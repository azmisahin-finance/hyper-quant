import { appendFile, mkdir, readFile, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export type HoldoutScope = 'GLOBAL' | 'FAMILY' | 'LINEAGE';
export type HoldoutEvaluation = {
  programRootId: string;
  familyId: string;
  lineageId: string;
  scope: HoldoutScope;
  units: number;
  resultClass: string;
  timestamp: string;
};

export type HoldoutEvaluationInput = Omit<HoldoutEvaluation, 'timestamp'>;
export type HoldoutReservationContext = { campaignId: string; candidateId: string; selectionEvidenceHash: string };
export type HoldoutReservation = HoldoutEvaluationInput & { reservationId: string; kind: 'HOLDOUT_RESERVATION'; campaignId?: string; candidateId?: string; selectionEvidenceHash?: string; holdoutEvidenceHash?: string };
export type HoldoutBudgets = { global: number; family: number; lineage: number };

export class HoldoutLedger {
  private static readonly writeQueues = new Map<string, Promise<void>>();
  constructor(private readonly path: string, private readonly governedRootId: string, private readonly budgets: HoldoutBudgets) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = HoldoutLedger.writeQueues.get(this.path) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    HoldoutLedger.writeQueues.set(this.path, current.then(() => undefined, () => undefined));
    return current;
  }

  private async records(): Promise<HoldoutEvaluation[]> {
    try {
      const text = await readFile(this.path, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line: string) => JSON.parse(line) as HoldoutEvaluation) : [];
    } catch (error) {
      const code = error as { code?: string };
      if (code.code === 'ENOENT') return [];
      throw error;
    }
  }

  async consumed(scope: HoldoutScope, familyId?: string, lineageId?: string): Promise<number> {
    const records = await this.records();
    return records.filter((item) => {
      const candidate = item as HoldoutEvaluation & { kind?: string; reservationId?: string };
      const budgetRecord = candidate.kind === 'HOLDOUT_RESERVATION' || (candidate.kind === 'HOLDOUT_FINAL' && !candidate.reservationId) || candidate.kind === undefined;
      if (!budgetRecord) return false;
      if (scope === 'GLOBAL') return true;
      if (scope === 'FAMILY') return item.familyId === familyId;
      return item.familyId === familyId && item.lineageId === lineageId;
    }).reduce((sum, item) => sum + item.units, 0);
  }

  private async appendRecord(record: unknown): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, JSON.stringify(record) + '\n', 'utf8');
    const handle = await open(this.path, 'r+');
    try { await handle.sync(); } finally { await handle.close(); }
  }

  private async validateBudget(input: HoldoutEvaluationInput): Promise<void> {
    if (input.programRootId !== this.governedRootId) throw new Error('HOLDOUT_PROGRAM_ROOT_MISMATCH');
    if (!Number.isInteger(input.units) || input.units <= 0) throw new Error('INVALID_HOLDOUT_UNITS');
    if (!input.familyId || !input.lineageId) throw new Error('INVALID_HOLDOUT_TAXONOMY');
    const currentGlobal = await this.consumed('GLOBAL');
    const currentFamily = await this.consumed('FAMILY', input.familyId);
    const currentLineage = await this.consumed('LINEAGE', input.familyId, input.lineageId);
    if (currentGlobal + input.units > this.budgets.global) throw new Error('GLOBAL_HOLDOUT_BUDGET_EXCEEDED');
    if (currentFamily + input.units > this.budgets.family) throw new Error('FAMILY_HOLDOUT_BUDGET_EXCEEDED');
    if (currentLineage + input.units > this.budgets.lineage) throw new Error('LINEAGE_HOLDOUT_BUDGET_EXCEEDED');
  }

  async reserve(input: HoldoutEvaluationInput, reservationId: string, context?: HoldoutReservationContext): Promise<HoldoutReservation> {
    return this.enqueue(async () => {
      await this.validateBudget(input);
      if (!reservationId) throw new Error('INVALID_HOLDOUT_RESERVATION');
      const existing = (await this.records()).some((item) => (item as { reservationId?: string }).reservationId === reservationId);
      if (existing) throw new Error('HOLDOUT_RESERVATION_ALREADY_EXISTS');
      const reservation: HoldoutReservation = { kind: 'HOLDOUT_RESERVATION', reservationId, ...input, ...context };
      await this.appendRecord(reservation);
      return reservation;
    });
  }

  async finalizeReservation(reservationId: string, resultClass: HoldoutResultClass): Promise<void> {
    return this.enqueue(async () => {
      const records = await this.records();
      const reservation = records.find((item) => (item as { kind?: string; reservationId?: string }).kind === 'HOLDOUT_RESERVATION' && (item as { reservationId?: string }).reservationId === reservationId) as HoldoutReservation | undefined;
      if (!reservation) throw new Error('HOLDOUT_RESERVATION_NOT_FOUND');
      const finalized = records.some((item) => (item as { kind?: string; reservationId?: string }).kind === 'HOLDOUT_FINAL' && (item as { reservationId?: string }).reservationId === reservationId);
      if (finalized) throw new Error('HOLDOUT_RESERVATION_ALREADY_FINAL');
      await this.appendRecord({ kind: 'HOLDOUT_FINAL', reservationId, programRootId: reservation.programRootId, familyId: reservation.familyId, lineageId: reservation.lineageId, scope: reservation.scope, units: reservation.units, resultClass, campaignId: reservation.campaignId, candidateId: reservation.candidateId, selectionEvidenceHash: reservation.selectionEvidenceHash, timestamp: new Date().toISOString() });
    });
  }

  async evaluate(input: HoldoutEvaluationInput): Promise<void> {
    const operation = this.enqueue(async () => {
      await this.validateBudget(input);
      await this.appendRecord({ ...input, programRootId: this.governedRootId, kind: 'HOLDOUT_FINAL', timestamp: new Date().toISOString() });
    });
    return operation;
  }

  async verifyRootContinuity(): Promise<boolean> {
    return (await this.records()).every((item) => item.programRootId === this.governedRootId);
  }

  governedRootIdForVerification(): string {
    return this.governedRootId;
  }

  static deriveGovernedRoot(policyHash: string, createdAt: string): string {
    return createHash('sha256').update(`${policyHash}:${createdAt}`).digest('hex');
  }
}

export type HoldoutResultClass = 'PASS' | 'FAIL' | 'INCONCLUSIVE';
export function assertNoRawHoldoutPayload(payload: unknown): void {
  if (payload !== null && typeof payload === 'object' && Object.keys(payload as object).some((key) => /row|label|timestamp|feature/i.test(key))) {
    throw new Error('RAW_HOLDOUT_PAYLOAD_FORBIDDEN');
  }
}
