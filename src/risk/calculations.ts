/**
 * Risk Calculation Utilities
 *
 * Mathematical functions for risk management and position sizing
 */

/**
 * Position sizing methods
 */
export type PositionSizingMethod =
  | 'fixed_percentage'
  | 'kelly_criterion'
  | 'fixed_amount'
  | 'volatility_adjusted';

export interface PositionSizeParams {
  method: PositionSizingMethod;
  accountBalance: number;
  riskPercentage?: number; // Risk per trade (e.g., 0.02 = 2%)
  winRate?: number; // Historical win rate for Kelly
  avgWin?: number; // Average win amount for Kelly
  avgLoss?: number; // Average loss amount for Kelly
  fixedAmount?: number; // For fixed_amount method
  volatility?: number; // ATR or std dev for volatility-adjusted
  avgVolatility?: number; // Average volatility for comparison
}

export interface PositionSizeResult {
  method: PositionSizingMethod;
  positionSize: number;
  riskAmount: number;
  riskPercentage: number;
  maxLoss: number;
}

/**
 * Calculate position size based on method
 */
export function calculatePositionSize(params: PositionSizeParams): PositionSizeResult {
  const {
    method,
    accountBalance,
    riskPercentage = 0.02,
    winRate = 0.5,
    avgWin = 1,
    avgLoss = 1,
    fixedAmount = 0,
    volatility = 0,
    avgVolatility = 1,
  } = params;

  let positionSize = 0;
  let riskAmount = 0;

  switch (method) {
    case 'fixed_percentage':
      riskAmount = accountBalance * riskPercentage;
      positionSize = riskAmount;
      break;

    case 'kelly_criterion':
      const kellyFraction = calculateKellyFraction(winRate, avgWin, avgLoss);
      // Use half-Kelly for safety
      const adjustedKelly = kellyFraction * 0.5;
      riskAmount = accountBalance * Math.max(0, Math.min(adjustedKelly, 0.25));
      positionSize = riskAmount;
      break;

    case 'fixed_amount':
      riskAmount = Math.min(fixedAmount, accountBalance * 0.1);
      positionSize = riskAmount;
      break;

    case 'volatility_adjusted':
      const volAdjustment = avgVolatility > 0 ? avgVolatility / Math.max(volatility, 0.001) : 1;
      riskAmount = accountBalance * riskPercentage * Math.min(volAdjustment, 2);
      positionSize = riskAmount;
      break;
  }

  return {
    method,
    positionSize,
    riskAmount,
    riskPercentage: accountBalance > 0 ? riskAmount / accountBalance : 0,
    maxLoss: riskAmount,
  };
}

/**
 * Calculate Kelly Criterion fraction
 * Formula: f* = (bp - q) / b
 * where b = odds (avgWin/avgLoss), p = win probability, q = loss probability
 */
export function calculateKellyFraction(
  winRate: number,
  avgWin: number,
  avgLoss: number
): number {
  if (avgLoss <= 0 || winRate < 0 || winRate > 1) {
    return 0;
  }

  const b = avgWin / avgLoss; // Win/loss ratio
  const p = winRate;
  const q = 1 - winRate;

  const kelly = (b * p - q) / b;
  return Math.max(0, kelly);
}

/**
 * Risk/Reward calculation
 */
export interface RiskRewardParams {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

export interface RiskRewardResult {
  riskAmount: number;
  rewardAmount: number;
  riskRewardRatio: number;
  breakEvenWinRate: number;
}

export function calculateRiskReward(params: RiskRewardParams): RiskRewardResult {
  const { entryPrice, stopLoss, takeProfit } = params;

  const riskAmount = Math.abs(entryPrice - stopLoss);
  const rewardAmount = Math.abs(takeProfit - entryPrice);

  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
  const breakEvenWinRate = riskRewardRatio > 0 ? 1 / (1 + riskRewardRatio) : 1;

  return {
    riskAmount,
    rewardAmount,
    riskRewardRatio,
    breakEvenWinRate,
  };
}

/**
 * Value at Risk (VaR) calculation
 * Historical VaR using percentile method
 */
export function calculateVaR(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  return -sorted[Math.max(0, index)];
}

/**
 * Conditional VaR (Expected Shortfall)
 * Average of losses beyond VaR
 */
export function calculateCVaR(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor((1 - confidenceLevel) * sorted.length);
  const tailReturns = sorted.slice(0, Math.max(1, cutoffIndex));

  const avgTailLoss =
    tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  return -avgTailLoss;
}

/**
 * Maximum Drawdown calculation
 */
export interface DrawdownResult {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
  currentDrawdownPercent: number;
  peakValue: number;
  troughValue: number;
}

export function calculateDrawdown(equityCurve: number[]): DrawdownResult {
  if (equityCurve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      peakValue: 0,
      troughValue: 0,
    };
  }

  let peak = equityCurve[0];
  let trough = equityCurve[0];
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let peakValue = equityCurve[0];
  let troughValue = equityCurve[0];

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = peak - value;
    const drawdownPercent = peak > 0 ? drawdown / peak : 0;

    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
      peakValue = peak;
      troughValue = value;
    }
  }

  // Current drawdown
  const currentPeak = Math.max(...equityCurve);
  const currentValue = equityCurve[equityCurve.length - 1];
  const currentDrawdown = currentPeak - currentValue;
  const currentDrawdownPercent = currentPeak > 0 ? currentDrawdown / currentPeak : 0;

  return {
    maxDrawdown,
    maxDrawdownPercent,
    currentDrawdown,
    currentDrawdownPercent,
    peakValue,
    troughValue,
  };
}

/**
 * Sharpe Ratio calculation
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const annualizedReturn = avgReturn * periodsPerYear;
  const annualizedStdDev = stdDev * Math.sqrt(periodsPerYear);

  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Sortino Ratio (downside risk adjusted)
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0.02,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate downside deviation
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return Infinity;

  const downsideVariance =
    negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
    negativeReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  const annualizedReturn = avgReturn * periodsPerYear;
  const annualizedDownside = downsideDeviation * Math.sqrt(periodsPerYear);

  return (annualizedReturn - riskFreeRate) / annualizedDownside;
}

/**
 * Win rate and profit factor
 */
export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
}

export function calculateTradeStats(
  trades: Array<{ pnl: number }>
): TradeStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);

  const totalWin = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  const avgWin = wins.length > 0 ? totalWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;

  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
  };
}

/**
 * Calculate correlation between two return series
 */
export function calculateCorrelation(
  returns1: number[],
  returns2: number[]
): number {
  const n = Math.min(returns1.length, returns2.length);
  if (n < 2) return 0;

  const mean1 = returns1.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const mean2 = returns2.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let variance1 = 0;
  let variance2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    covariance += diff1 * diff2;
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
  }

  if (variance1 === 0 || variance2 === 0) return 0;

  return covariance / Math.sqrt(variance1 * variance2);
}

/**
 * Calculate Beta (market correlation)
 */
export function calculateBeta(
  assetReturns: number[],
  marketReturns: number[]
): number {
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 2) return 1;

  const meanAsset = assetReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanMarket = marketReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let marketVariance = 0;

  for (let i = 0; i < n; i++) {
    const diffAsset = assetReturns[i] - meanAsset;
    const diffMarket = marketReturns[i] - meanMarket;
    covariance += diffAsset * diffMarket;
    marketVariance += diffMarket * diffMarket;
  }

  if (marketVariance === 0) return 1;

  return covariance / marketVariance;
}

/**
 * Calculate stop loss price
 */
export interface StopLossParams {
  entryPrice: number;
  riskPercentage: number;
  direction: 'long' | 'short';
  atr?: number; // Average True Range for ATR-based stops
  atrMultiplier?: number;
}

export function calculateStopLoss(params: StopLossParams): number {
  const {
    entryPrice,
    riskPercentage,
    direction,
    atr,
    atrMultiplier = 2,
  } = params;

  // ATR-based stop if ATR provided
  if (atr && atr > 0) {
    const atrStop = atr * atrMultiplier;
    return direction === 'long'
      ? entryPrice - atrStop
      : entryPrice + atrStop;
  }

  // Percentage-based stop
  return direction === 'long'
    ? entryPrice * (1 - riskPercentage)
    : entryPrice * (1 + riskPercentage);
}

/**
 * Calculate take profit price
 */
export interface TakeProfitParams {
  entryPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  direction: 'long' | 'short';
}

export function calculateTakeProfit(params: TakeProfitParams): number {
  const { entryPrice, stopLoss, riskRewardRatio, direction } = params;

  const riskAmount = Math.abs(entryPrice - stopLoss);
  const rewardAmount = riskAmount * riskRewardRatio;

  return direction === 'long'
    ? entryPrice + rewardAmount
    : entryPrice - rewardAmount;
}
