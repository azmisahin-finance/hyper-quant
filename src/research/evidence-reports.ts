import { createHash } from 'node:crypto';
import { chooseLatencyMs, type LatencyProfile } from '../execution/latency-model.js';
import { calculateExecutionCost, type ExecutionCostModel } from './cost-model.js';
import type { ResearchBar } from './features.js';
import { FeatureEngine, rollingZScoreFeature } from './features.js';
import { createZScoreMeanReversionStrategy, runDeterministicBacktest, type BacktestConfig, type BacktestResult } from './backtest.js';

export const FIRST_EVIDENCE_SCOPE = {
  venue: 'BtcTurk',
  market: 'BTC/TRY',
  mode: 'READ_ONLY_NON_LIVE',
} as const;

export type EvidenceOutcome = 'COMPLETED' | 'NO_TRADE' | 'FAIL';

export type EvidenceReportIndexEntry = {
  reportId: `RPT-${string}`;
  name: string;
  status: 'PARTIAL' | 'OPEN' | 'BLOCKED';
};

export const EVIDENCE_REPORT_INDEX: readonly EvidenceReportIndexEntry[] = [
  { reportId: 'RPT-01', name: 'Baseline Research Campaign Report', status: 'PARTIAL' },
  { reportId: 'RPT-02', name: 'Reproducibility and Data Lineage Certificate', status: 'PARTIAL' },
  { reportId: 'RPT-03', name: 'Independent Statistical Evidence Package', status: 'PARTIAL' },
  { reportId: 'RPT-04', name: 'Sealed Holdout Evaluation Certificate', status: 'PARTIAL' },
  { reportId: 'RPT-05', name: 'Execution Cost and Slippage Report', status: 'PARTIAL' },
  { reportId: 'RPT-06', name: 'Walk-Forward Validation Report', status: 'OPEN' },
  { reportId: 'RPT-07', name: 'Overfitting and PBO Diagnostic Report', status: 'OPEN' },
  { reportId: 'RPT-08', name: 'Holdout Evaluation Report', status: 'BLOCKED' },
  { reportId: 'RPT-09', name: 'Risk and Drawdown Report', status: 'OPEN' },
  { reportId: 'RPT-10', name: 'Shadow Execution Comparison Report', status: 'BLOCKED' },
  { reportId: 'RPT-11', name: 'Operational Readiness Report', status: 'OPEN' },
  { reportId: 'RPT-12', name: 'Promotion Decision Record', status: 'BLOCKED' },
];

export type BaselineResearchCampaignInput = {
  campaignId: string;
  datasetHash: string;
  datasetVersion: string;
  codeHash: string;
  configHash: string;
  bars: readonly ResearchBar[];
  featureId: string;
  lookback: number;
  entryZ: number;
  exitZ: number;
  backtest: BacktestConfig;
};

export type BaselineResearchCampaignReport = {
  reportId: 'RPT-01';
  reportName: 'Baseline Research Campaign Report';
  scope: typeof FIRST_EVIDENCE_SCOPE;
  campaignId: string;
  outcome: EvidenceOutcome;
  inputHash: string;
  resultHash?: string;
  errorCode?: string;
  backtest?: Pick<BacktestResult, 'initialCapital' | 'finalCapital' | 'totalReturn' | 'maxDrawdown' | 'tradeCount' | 'meanTradeReturn' | 'tradeStdDev'>;
};

export type ReproducibilityAndDataLineageCertificate = {
  reportId: 'RPT-02';
  reportName: 'Reproducibility and Data Lineage Certificate';
  scope: typeof FIRST_EVIDENCE_SCOPE;
  campaignId: string;
  inputHash: string;
  firstResultHash?: string;
  repeatResultHash?: string;
  reproducible: boolean;
  lineage: {
    datasetHash: string;
    datasetVersion: string;
    codeHash: string;
    configHash: string;
  };
};

export type FirstEvidenceResult = {
  baseline: BaselineResearchCampaignReport;
  reproducibility: ReproducibilityAndDataLineageCertificate;
};

export type ExecutionCostStressInput = {
  campaignId: string;
  datasetHash: string;
  datasetVersion: string;
  codeHash: string;
  configHash: string;
  notional: number;
  turnover: number;
  feeBps: number;
  slippageBps: number;
  spreadBps: number;
  latencyProfile: LatencyProfile;
  stalenessMs: number;
  partialFillRate: number;
  rejectRate: number;
  unknownInFlightCount: number;
  stressMultiple?: number;
  liveAuthority?: boolean;
  blockers?: readonly string[];
};

export type ExecutionCostStressResult = {
  notional: number;
  turnover: number;
  feeCost: number;
  slippageCost: number;
  spreadCost: number;
  totalCost: number;
  modeledCostBps: number;
  adverseCostBps: number;
  latencyMs: number;
  stalenessMs: number;
  partialFillRate: number;
  rejectRate: number;
  unknownInFlightCount: number;
  liveAuthority: false;
  lineage: {
    datasetHash: string;
    datasetVersion: string;
    codeHash: string;
    configHash: string;
  };
};

export type ExecutionCostAndSlippageReport = {
  reportId: 'RPT-05';
  reportName: 'Execution Cost and Slippage Report';
  scope: typeof FIRST_EVIDENCE_SCOPE;
  campaignId: string;
  outcome: EvidenceOutcome | 'BLOCKED';
  inputHash: string;
  resultHash?: string;
  evidenceHash: string;
  errorCode?: string;
  blockers?: readonly string[];
  result?: ExecutionCostStressResult;
};

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function inputHash(input: BaselineResearchCampaignInput): string {
  return sha256({
    campaignId: input.campaignId,
    datasetHash: input.datasetHash,
    datasetVersion: input.datasetVersion,
    codeHash: input.codeHash,
    configHash: input.configHash,
    bars: input.bars,
    featureId: input.featureId,
    lookback: input.lookback,
    entryZ: input.entryZ,
    exitZ: input.exitZ,
    backtest: input.backtest,
  });
}

function runBacktest(input: BaselineResearchCampaignInput): BacktestResult {
  const features = new FeatureEngine([rollingZScoreFeature(input.featureId, input.lookback)]).evaluate(input.bars);
  return runDeterministicBacktest(
    input.bars,
    features,
    createZScoreMeanReversionStrategy(input.featureId, input.entryZ, input.exitZ),
    input.backtest,
  );
}

export function runFirstEvidenceCampaign(input: BaselineResearchCampaignInput): FirstEvidenceResult {
  const hash = inputHash(input);
  try {
    const first = runBacktest(input);
    const repeat = runBacktest(input);
    const outcome: EvidenceOutcome = first.tradeCount === 0 ? 'NO_TRADE' : 'COMPLETED';
    const baseline: BaselineResearchCampaignReport = {
      reportId: 'RPT-01',
      reportName: 'Baseline Research Campaign Report',
      scope: FIRST_EVIDENCE_SCOPE,
      campaignId: input.campaignId,
      outcome,
      inputHash: hash,
      resultHash: first.resultHash,
      backtest: {
        initialCapital: first.initialCapital,
        finalCapital: first.finalCapital,
        totalReturn: first.totalReturn,
        maxDrawdown: first.maxDrawdown,
        tradeCount: first.tradeCount,
        meanTradeReturn: first.meanTradeReturn,
        tradeStdDev: first.tradeStdDev,
      },
    };
    return {
      baseline,
      reproducibility: {
        reportId: 'RPT-02',
        reportName: 'Reproducibility and Data Lineage Certificate',
        scope: FIRST_EVIDENCE_SCOPE,
        campaignId: input.campaignId,
        inputHash: hash,
        firstResultHash: first.resultHash,
        repeatResultHash: repeat.resultHash,
        reproducible: first.resultHash === repeat.resultHash,
        lineage: {
          datasetHash: input.datasetHash,
          datasetVersion: input.datasetVersion,
          codeHash: input.codeHash,
          configHash: input.configHash,
        },
      },
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
    return {
      baseline: {
        reportId: 'RPT-01',
        reportName: 'Baseline Research Campaign Report',
        scope: FIRST_EVIDENCE_SCOPE,
        campaignId: input.campaignId,
        outcome: 'FAIL',
        inputHash: hash,
        errorCode,
      },
      reproducibility: {
        reportId: 'RPT-02',
        reportName: 'Reproducibility and Data Lineage Certificate',
        scope: FIRST_EVIDENCE_SCOPE,
        campaignId: input.campaignId,
        inputHash: hash,
        reproducible: false,
        lineage: {
          datasetHash: input.datasetHash,
          datasetVersion: input.datasetVersion,
          codeHash: input.codeHash,
          configHash: input.configHash,
        },
      },
    };
  }
}

function validateExecutionCostInput(input: ExecutionCostStressInput): void {
  if (!input.campaignId.trim()) throw new Error('INVALID_CAMPAIGN_ID');
  if (!/^[0-9a-f]{64}$/.test(input.datasetHash)) throw new Error('INVALID_DATASET_HASH');
  if (!/^[0-9a-f]{64}$/.test(input.codeHash)) throw new Error('INVALID_CODE_HASH');
  if (!/^[0-9a-f]{64}$/.test(input.configHash)) throw new Error('INVALID_CONFIG_HASH');
  if (!Number.isFinite(input.notional) || input.notional < 0) throw new Error('INVALID_NOTIONAL');
  if (!Number.isFinite(input.turnover) || input.turnover < 0) throw new Error('INVALID_TURNOVER');
  if (!input.latencyProfile || input.latencyProfile.observations.length === 0) throw new Error('INVALID_LATENCY_PROFILE');
  if (!Number.isFinite(input.stalenessMs) || input.stalenessMs < 0) throw new Error('INVALID_STALENESS_MS');
  const model: ExecutionCostModel = { feeBps: input.feeBps, slippageBps: input.slippageBps };
  calculateExecutionCost(input.notional, input.turnover, model);
  if (!Number.isFinite(input.spreadBps) || input.spreadBps < 0) throw new Error('INVALID_SPREAD_BPS');
  if (!Number.isFinite(input.partialFillRate) || input.partialFillRate < 0 || input.partialFillRate > 1) throw new Error('INVALID_PARTIAL_FILL_RATE');
  if (!Number.isFinite(input.rejectRate) || input.rejectRate < 0 || input.rejectRate > 1) throw new Error('INVALID_REJECT_RATE');
  if (!Number.isInteger(input.unknownInFlightCount) || input.unknownInFlightCount < 0) throw new Error('INVALID_UNKNOWN_IN_FLIGHT_COUNT');
  if (input.stressMultiple !== undefined && (!Number.isFinite(input.stressMultiple) || input.stressMultiple <= 0)) throw new Error('INVALID_STRESS_MULTIPLE');
}

export function buildExecutionCostAndSlippageReport(input: ExecutionCostStressInput): ExecutionCostAndSlippageReport {
  const inputHash = sha256({
    campaignId: input.campaignId,
    datasetHash: input.datasetHash,
    datasetVersion: input.datasetVersion,
    codeHash: input.codeHash,
    configHash: input.configHash,
    notional: input.notional,
    turnover: input.turnover,
    feeBps: input.feeBps,
    slippageBps: input.slippageBps,
    spreadBps: input.spreadBps,
    stalenessMs: input.stalenessMs,
    partialFillRate: input.partialFillRate,
    rejectRate: input.rejectRate,
    unknownInFlightCount: input.unknownInFlightCount,
    stressMultiple: input.stressMultiple ?? 1.5,
    liveAuthority: Boolean(input.liveAuthority),
    blockers: input.blockers ?? [],
  });

  try {
    validateExecutionCostInput(input);

    const feeCost = calculateExecutionCost(input.notional, input.turnover, { feeBps: input.feeBps, slippageBps: 0 });
    const slippageCost = calculateExecutionCost(input.notional, input.turnover, { feeBps: 0, slippageBps: input.slippageBps });
    const spreadCost = input.notional * input.turnover * (input.spreadBps / 10_000);
    const latencyMs = chooseLatencyMs(input.latencyProfile, 0);
    const stressMultiple = input.stressMultiple ?? 1.5;
    const modeledCostBps = ((feeCost + slippageCost + spreadCost) / Math.max(input.notional, 1e-9)) * 10_000;
    const adverseCostBps = modeledCostBps * stressMultiple;
    const blockers = [...(input.blockers ?? [])];

    if (input.liveAuthority) blockers.push('LIVE_AUTHORITY_NOT_SUPPORTED');
    if (input.unknownInFlightCount > 0) blockers.push('UNKNOWN_IN_FLIGHT_OUTCOME_UNSUPPORTED');
    if (input.stalenessMs > latencyMs * 4) blockers.push('STALE_LATENCY_OUTCOME_UNSUPPORTED');

    const result: ExecutionCostStressResult = {
      notional: input.notional,
      turnover: input.turnover,
      feeCost,
      slippageCost,
      spreadCost,
      totalCost: feeCost + slippageCost + spreadCost,
      modeledCostBps,
      adverseCostBps,
      latencyMs,
      stalenessMs: input.stalenessMs,
      partialFillRate: input.partialFillRate,
      rejectRate: input.rejectRate,
      unknownInFlightCount: input.unknownInFlightCount,
      liveAuthority: false,
      lineage: {
        datasetHash: input.datasetHash,
        datasetVersion: input.datasetVersion,
        codeHash: input.codeHash,
        configHash: input.configHash,
      },
    };

    if (blockers.length > 0) {
      const evidenceHash = sha256({ inputHash, outcome: 'BLOCKED', blockers, result });
      return {
        reportId: 'RPT-05',
        reportName: 'Execution Cost and Slippage Report',
        scope: FIRST_EVIDENCE_SCOPE,
        campaignId: input.campaignId,
        outcome: 'BLOCKED',
        inputHash,
        resultHash: sha256(result),
        evidenceHash,
        blockers: Array.from(new Set(blockers)),
        result,
      };
    }

    const resultHash = sha256(result);
    return {
      reportId: 'RPT-05',
      reportName: 'Execution Cost and Slippage Report',
      scope: FIRST_EVIDENCE_SCOPE,
      campaignId: input.campaignId,
      outcome: 'COMPLETED',
      inputHash,
      resultHash,
      evidenceHash: sha256({ inputHash, resultHash, result }),
      result,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
    return {
      reportId: 'RPT-05',
      reportName: 'Execution Cost and Slippage Report',
      scope: FIRST_EVIDENCE_SCOPE,
      campaignId: input.campaignId,
      outcome: 'FAIL',
      inputHash,
      evidenceHash: sha256({ inputHash, outcome: 'FAIL', errorCode }),
      errorCode,
    };
  }
}
