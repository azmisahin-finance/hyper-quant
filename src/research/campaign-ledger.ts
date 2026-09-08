import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type CampaignStartRecord = {
  kind: 'CAMPAIGN_START';
  campaignId: string;
  researchProgramId: string;
  selectionPolicyHash: string;
  candidateIds: string[];
  createdAt: string;
};

export type CampaignCandidateRecord = {
  kind: 'CAMPAIGN_CANDIDATE';
  campaignId: string;
  candidateId: string;
  trialId: string;
  outcome: 'COMPLETED' | 'CRASHED';
  returnCount: number;
  score: number;
  returnHash: string;
  recordedAt: string;
};

export type CampaignFinalRecord = {
  kind: 'CAMPAIGN_FINAL';
  campaignId: string;
  researchProgramId: string;
  selectedCandidateId: string;
  selectedCandidateIndex: number;
  committedTrialCount: number;
  pbo: number;
  dsr: number;
  passedSelectionGates: boolean;
  evidenceHash: string;
  recordedAt: string;
};

export type CampaignRecord = CampaignStartRecord | CampaignCandidateRecord | CampaignFinalRecord;

export class ResearchCampaignLedger {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  private async records(): Promise<CampaignRecord[]> {
    try {
      const text = await readFile(this.path, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line: string) => JSON.parse(line) as CampaignRecord) : [];
    } catch (error) {
      const code = error as { code?: string };
      if (code.code === 'ENOENT') return [];
      throw error;
    }
  }

  private async append(record: CampaignRecord): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const handle = await open(this.path, 'a');
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async start(record: CampaignStartRecord): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const records = await this.records();
      if (records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId)) {
        throw new Error('CAMPAIGN_ID_ALREADY_REGISTERED');
      }
      if (!record.campaignId || !record.researchProgramId || !record.selectionPolicyHash || record.candidateIds.length < 2) {
        throw new Error('INVALID_CAMPAIGN_RECEIPT');
      }
      await this.append(record);
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async recordCandidate(record: CampaignCandidateRecord): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const records = await this.records();
      const started = records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId);
      if (!started) throw new Error('CAMPAIGN_RECEIPT_REQUIRED');
      if (records.some((item) => item.kind === 'CAMPAIGN_CANDIDATE' && item.campaignId === record.campaignId && item.candidateId === record.candidateId)) {
        throw new Error('CAMPAIGN_CANDIDATE_ALREADY_RECORDED');
      }
      await this.append(record);
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async finalize(record: CampaignFinalRecord): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const records = await this.records();
      const started = records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId);
      if (!started) throw new Error('CAMPAIGN_RECEIPT_REQUIRED');
      if (records.some((item) => item.kind === 'CAMPAIGN_FINAL' && item.campaignId === record.campaignId)) {
        throw new Error('CAMPAIGN_ALREADY_FINAL');
      }
      await this.append(record);
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async isFinal(campaignId: string): Promise<boolean> {
    return (await this.records()).some((item) => item.kind === 'CAMPAIGN_FINAL' && item.campaignId === campaignId);
  }
}
