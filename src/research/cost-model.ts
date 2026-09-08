export type ExecutionCostModel = {
  feeBps: number;
  slippageBps: number;
};

export function validateCostModel(model: ExecutionCostModel): void {
  if (!Number.isFinite(model.feeBps) || model.feeBps < 0) throw new Error('INVALID_FEE_BPS');
  if (!Number.isFinite(model.slippageBps) || model.slippageBps < 0) throw new Error('INVALID_SLIPPAGE_BPS');
}

export function calculateExecutionCost(notional: number, turnover: number, model: ExecutionCostModel): number {
  validateCostModel(model);
  if (!Number.isFinite(notional) || notional < 0) throw new Error('INVALID_NOTIONAL');
  if (!Number.isFinite(turnover) || turnover < 0) throw new Error('INVALID_TURNOVER');
  return notional * turnover * ((model.feeBps + model.slippageBps) / 10_000);
}
