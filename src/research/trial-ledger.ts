import { appendFile, mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type ResearchTrialReceipt = {
  trialId: string;
  researchProgramId: string;
  hypothesisId: string;
  codeHash: string;
  configHash: string;
  datasetHash: string;
  selectionPolicyHash: string;
  parentTrialIds: string[];
  createdAt: string;
};

export type ResearchTrialOutcome = ResearchTrialReceipt & {
  outcome: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'CRASHED';
  completedAt: string;
};

export class ResearchTrialLedger {
  private static readonly writeQueues = new Map<string, Promise<void>>();

  constructor(private readonly path: string) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = ResearchTrialLedger.writeQueues.get(this.path) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    ResearchTrialLedger.writeQueues.set(this.path, current.then(() => undefined, () => undefined));
    return current;
  }

  private async lines(): Promise<unknown[]> {
    try {
      const text = await readFile(this.path, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line: string) => JSON.parse(line) as unknown) : [];
    } catch (error) {
      const code = error as { code?: string };
      if (code.code === 'ENOENT') return [];
      throw error;
    }
  }

  private async append(record: unknown): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const handle = await open(this.path, 'a');
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async registerBeforeRun(receipt: ResearchTrialReceipt): Promise<void> {
    if (!receipt.trialId || !receipt.researchProgramId || !receipt.hypothesisId || !receipt.codeHash || !receipt.configHash || !receipt.datasetHash || !receipt.selectionPolicyHash) throw new Error('INVALID_TRIAL_RECEIPT');
    return this.enqueue(async () => {
      const existing = (await this.lines()).find((item) => (item as { trialId?: string }).trialId === receipt.trialId);
      if (existing) throw new Error('TRIAL_ID_ALREADY_REGISTERED');
      await this.append({ kind: 'TRIAL_RECEIPT', ...receipt });
    });
  }

  async recordOutcome(outcome: ResearchTrialOutcome): Promise<void> {
    return this.enqueue(async () => {
      const records = await this.lines();
      const registered = records.some((item) => (item as { kind?: string; trialId?: string }).kind === 'TRIAL_RECEIPT' && (item as { trialId?: string }).trialId === outcome.trialId);
      if (!registered) throw new Error('TRIAL_RECEIPT_REQUIRED_BEFORE_OUTCOME');
      const alreadyTerminal = records.some((item) => (item as { kind?: string; trialId?: string }).kind === 'TRIAL_OUTCOME' && (item as { trialId?: string }).trialId === outcome.trialId);
      if (alreadyTerminal) throw new Error('TRIAL_OUTCOME_ALREADY_RECORDED');
      await this.append({ kind: 'TRIAL_OUTCOME', ...outcome });
    });
  }

  async countRegisteredTrials(researchProgramId: string): Promise<number> {
    const records = await this.lines();
    return records.filter((item) => (item as { kind?: string; researchProgramId?: string }).kind === 'TRIAL_RECEIPT' && (item as { researchProgramId?: string }).researchProgramId === researchProgramId).length;
  }

  async hasReceipt(trialId: string): Promise<boolean> {
    return (await this.lines()).some((item) => (item as { kind?: string; trialId?: string }).kind === 'TRIAL_RECEIPT' && (item as { trialId?: string }).trialId === trialId);
  }
}
