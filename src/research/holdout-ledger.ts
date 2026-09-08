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
export type HoldoutBudgets = { global: number; family: number; lineage: number };

export class HoldoutLedger {
  private writeQueue: Promise<void> = Promise.resolve();
  constructor(private readonly path: string, private readonly governedRootId: string, private readonly budgets: HoldoutBudgets) {}

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
      if (scope === 'GLOBAL') return true;
      if (scope === 'FAMILY') return item.familyId === familyId;
      return item.familyId === familyId && item.lineageId === lineageId;
    }).reduce((sum, item) => sum + item.units, 0);
  }

  async evaluate(input: HoldoutEvaluationInput): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      if (input.programRootId !== this.governedRootId) throw new Error('HOLDOUT_PROGRAM_ROOT_MISMATCH');
      if (!Number.isInteger(input.units) || input.units <= 0) throw new Error('INVALID_HOLDOUT_UNITS');
      if (!input.familyId || !input.lineageId) throw new Error('INVALID_HOLDOUT_TAXONOMY');
      const currentGlobal = await this.consumed('GLOBAL');
      const currentFamily = await this.consumed('FAMILY', input.familyId);
      const currentLineage = await this.consumed('LINEAGE', input.familyId, input.lineageId);
      if (currentGlobal + input.units > this.budgets.global) throw new Error('GLOBAL_HOLDOUT_BUDGET_EXCEEDED');
      if (currentFamily + input.units > this.budgets.family) throw new Error('FAMILY_HOLDOUT_BUDGET_EXCEEDED');
      if (currentLineage + input.units > this.budgets.lineage) throw new Error('LINEAGE_HOLDOUT_BUDGET_EXCEEDED');
      await mkdir(dirname(this.path), { recursive: true });
      const record = { ...input, programRootId: this.governedRootId, timestamp: new Date().toISOString() };
      await appendFile(this.path, JSON.stringify(record) + '\n', 'utf8');
      const handle = await open(this.path, 'r');
      try { await handle.sync(); } finally { await handle.close(); }
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async verifyRootContinuity(): Promise<boolean> {
    return (await this.records()).every((item) => item.programRootId === this.governedRootId);
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
