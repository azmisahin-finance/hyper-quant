import { createHash } from 'node:crypto';
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
  { reportId: 'RPT-03', name: 'Market Data Completeness Report', status: 'OPEN' },
  { reportId: 'RPT-04', name: 'Replay Determinism Certificate', status: 'OPEN' },
  { reportId: 'RPT-05', name: 'Execution Cost and Slippage Report', status: 'OPEN' },
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
