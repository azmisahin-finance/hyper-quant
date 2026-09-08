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
  selectionPolicyHash: string;
  selectedCandidateId: string;
  selectedCandidateIndex: number;
  committedTrialCount: number;
  pbo: number;
  dsr: number;
  dsrMethod: 'CLASSIC_DSR_LS';
  dsrReturnConvention: 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV';
  passedSelectionGates: boolean;
  evidenceHash: string;
  recordedAt: string;
};

export type CampaignRecord = CampaignStartRecord | CampaignCandidateRecord | CampaignFinalRecord;

export class ResearchCampaignLedger {
  private static readonly writeQueues = new Map<string, Promise<void>>();

  constructor(private readonly path: string) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = ResearchCampaignLedger.writeQueues.get(this.path) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    ResearchCampaignLedger.writeQueues.set(this.path, current.then(() => undefined, () => undefined));
    return current;
  }

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
    return this.enqueue(async () => {
      const records = await this.records();
      if (records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId)) {
        throw new Error('CAMPAIGN_ID_ALREADY_REGISTERED');
      }
      if (!record.campaignId || !record.researchProgramId || !record.selectionPolicyHash || record.candidateIds.length < 2) {
        throw new Error('INVALID_CAMPAIGN_RECEIPT');
      }
      await this.append(record);
    });
  }

  async recordCandidate(record: CampaignCandidateRecord): Promise<void> {
    return this.enqueue(async () => {
      const records = await this.records();
      const started = records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId);
      if (!started) throw new Error('CAMPAIGN_RECEIPT_REQUIRED');
      if (records.some((item) => item.kind === 'CAMPAIGN_CANDIDATE' && item.campaignId === record.campaignId && item.candidateId === record.candidateId)) {
        throw new Error('CAMPAIGN_CANDIDATE_ALREADY_RECORDED');
      }
      await this.append(record);
    });
  }

  async finalize(record: CampaignFinalRecord): Promise<void> {
    return this.enqueue(async () => {
      const records = await this.records();
      const started = records.some((item) => item.kind === 'CAMPAIGN_START' && item.campaignId === record.campaignId);
      if (!started) throw new Error('CAMPAIGN_RECEIPT_REQUIRED');
      if (records.some((item) => item.kind === 'CAMPAIGN_FINAL' && item.campaignId === record.campaignId)) {
        throw new Error('CAMPAIGN_ALREADY_FINAL');
      }
      await this.append(record);
    });
  }

  async getFinal(campaignId: string): Promise<CampaignFinalRecord | undefined> {
    const records = await this.records();
    return records.find((item): item is CampaignFinalRecord => item.kind === 'CAMPAIGN_FINAL' && item.campaignId === campaignId);
  }

  async isFinal(campaignId: string): Promise<boolean> {
    return (await this.getFinal(campaignId)) !== undefined;
  }
}
