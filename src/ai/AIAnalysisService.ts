/**
 * AIAnalysisService - Phase 16: AI Analysis & Trading Intelligence
 *
 * Comprehensive market analysis with:
 * - Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
 * - Pattern recognition (trends, candlestick patterns)
 * - Market analysis and recommendations
 * - Risk metrics (Sharpe ratio, max drawdown, VaR)
 */

// ============================================
// TYPES
// ============================================

export interface PriceCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
}

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  significance: number;
}

export interface TechnicalIndicators {
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi: number;
  macd: MACDResult;
  bollingerBands: BollingerBands;
}

export interface VolumeAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  averageVolume: number;
  relativeVolume: number;
}

export interface MarketAnalysis {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number;
  indicators: TechnicalIndicators;
  signals: string[];
  volumeAnalysis: VolumeAnalysis;
  confidence: number;
  timestamp: Date;
}

export interface TradingRecommendation {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  minimumConfidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
}

export interface PositionSizeParams {
  accountBalance: number;
  riskPerTrade: number;
  entryPrice: number;
  stopLossPrice: number;
}

export interface PositionSize {
  quantity: number;
  riskAmount: number;
  positionValue: number;
}

export interface AssetPerformance {
  symbol: string;
  returnPercent: number;
  prices: number[];
}

export interface AssetComparison {
  rankings: AssetPerformance[];
  bestPerformer: string;
  worstPerformer: string;
}

// ============================================
// AI ANALYSIS SERVICE
// ============================================

export class AIAnalysisService {
  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);

    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   */
  calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD
   */
  calculateMACD(prices: number[]): MACDResult {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);

    if (ema12.length === 0 || ema26.length === 0) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];

    // Calculate signal line (9-period EMA of MACD)
    const macdValues = ema12.slice(-Math.min(ema12.length, ema26.length)).map((e12, i) => {
      const offset = ema26.length - Math.min(ema12.length, ema26.length);
      return e12 - ema26[offset + i];
    });

    const signalLine = macdValues.length >= 9
      ? this.calculateEMA(macdValues, 9).pop() || 0
      : macdLine;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): BollingerBands {
    if (prices.length < period) {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return { upper: avg, middle: avg, lower: avg };
    }

    const recentPrices = prices.slice(-period);
    const middle = recentPrices.reduce((a, b) => a + b, 0) / period;

    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: middle + stdDev * std,
      middle,
      lower: middle - stdDev * std
    };
  }

  /**
   * Detect support and resistance levels
   */
  detectSupportResistance(priceData: { high: number; low: number }[]): SupportResistance {
    const highs = priceData.map(p => p.high);
    const lows = priceData.map(p => p.low);

    // Find local maxima for resistance
    const resistance: number[] = [];
    for (let i = 1; i < highs.length - 1; i++) {
      if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
        resistance.push(highs[i]);
      }
    }

    // Find local minima for support
    const support: number[] = [];
    for (let i = 1; i < lows.length - 1; i++) {
      if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
        support.push(lows[i]);
      }
    }

    // If no levels found, use min/max
    if (support.length === 0) support.push(Math.min(...lows));
    if (resistance.length === 0) resistance.push(Math.max(...highs));

    return { support, resistance };
  }

  /**
   * Detect trend direction
   */
  detectTrend(prices: number[]): 'bullish' | 'bearish' | 'neutral' {
    if (prices.length < 2) return 'neutral';

    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePercent = (secondAvg - firstAvg) / firstAvg;

    if (changePercent > 0.01) return 'bullish';
    if (changePercent < -0.01) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate trend strength (0-1)
   */
  calculateTrendStrength(prices: number[]): number {
    if (prices.length < 2) return 0;

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const totalChange = Math.abs(lastPrice - firstPrice);

    // Calculate total path length
    let pathLength = 0;
    for (let i = 1; i < prices.length; i++) {
      pathLength += Math.abs(prices[i] - prices[i - 1]);
    }

    if (pathLength === 0) return 0;

    // Strength is ratio of direct change to total movement
    const strength = totalChange / pathLength;
    return Math.min(1, strength);
  }

  /**
   * Detect candlestick patterns
   */
  detectCandlestickPattern(candle: { open: number; high: number; low: number; close: number }): CandlestickPattern {
    const bodySize = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const totalRange = candle.high - candle.low;

    // Doji - very small body
    if (bodySize / totalRange < 0.1) {
      return { name: 'doji', type: 'neutral', significance: 0.7 };
    }

    // Hammer - small body at top, long lower wick
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && candle.close > candle.open) {
      return { name: 'hammer', type: 'bullish', significance: 0.75 };
    }

    // Inverted Hammer
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && candle.close > candle.open) {
      return { name: 'inverted_hammer', type: 'bullish', significance: 0.65 };
    }

    // Shooting Star
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && candle.close < candle.open) {
      return { name: 'shooting_star', type: 'bearish', significance: 0.7 };
    }

    // Bullish/Bearish candle
    if (candle.close > candle.open) {
      return { name: 'bullish', type: 'bullish', significance: 0.5 };
    }

    return { name: 'bearish', type: 'bearish', significance: 0.5 };
  }

  /**
   * Calculate historical volatility
   */
  calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Generate comprehensive market analysis
   */
  analyzeMarket(symbol: string, priceData: PriceCandle[]): MarketAnalysis {
    const closePrices = priceData.map(p => p.close);
    const volumes = priceData.map(p => p.volume);

    // Calculate indicators
    const rsi = this.calculateRSI(closePrices);
    const macd = this.calculateMACD(closePrices);
    const bollingerBands = this.calculateBollingerBands(closePrices);

    // Determine trend
    const trend = this.detectTrend(closePrices);
    const trendStrength = this.calculateTrendStrength(closePrices);

    // Volume analysis
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeTrend = recentVolume > avgVolume * 1.1 ? 'increasing' :
                        recentVolume < avgVolume * 0.9 ? 'decreasing' : 'stable';

    // Generate signals
    const signals: string[] = [];
    if (rsi > 70) signals.push('RSI overbought');
    if (rsi < 30) signals.push('RSI oversold');
    if (macd.histogram > 0 && macd.macd > macd.signal) signals.push('MACD bullish');
    if (macd.histogram < 0 && macd.macd < macd.signal) signals.push('MACD bearish');

    const lastPrice = closePrices[closePrices.length - 1];
    if (lastPrice > bollingerBands.upper) signals.push('Above upper Bollinger Band');
    if (lastPrice < bollingerBands.lower) signals.push('Below lower Bollinger Band');

    // Calculate confidence based on indicator agreement
    let confidence = 0.5;
    if (trend === 'bullish' && rsi < 70 && macd.histogram > 0) confidence = 0.7;
    if (trend === 'bearish' && rsi > 30 && macd.histogram < 0) confidence = 0.7;

    return {
      symbol,
      trend,
      trendStrength,
      indicators: {
        rsi,
        macd,
        bollingerBands
      },
      signals,
      volumeAnalysis: {
        trend: volumeTrend,
        averageVolume: avgVolume,
        relativeVolume: recentVolume / avgVolume
      },
      confidence,
      timestamp: new Date()
    };
  }

  /**
   * Generate trading recommendation
   */
  generateRecommendation(
    symbol: string,
    priceData: PriceCandle[],
    options: { riskTolerance: 'low' | 'medium' | 'high' }
  ): TradingRecommendation {
    const analysis = this.analyzeMarket(symbol, priceData);
    const lastPrice = priceData[priceData.length - 1].close;

    // Set minimum confidence based on risk tolerance
    const minConfidence = options.riskTolerance === 'low' ? 0.7 :
                          options.riskTolerance === 'medium' ? 0.55 : 0.4;

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let reasoning = '';

    if (analysis.trend === 'bullish' && analysis.confidence >= minConfidence) {
      action = 'buy';
      reasoning = `Bullish trend with ${(analysis.confidence * 100).toFixed(0)}% confidence. ${analysis.signals.join('. ')}`;
    } else if (analysis.trend === 'bearish' && analysis.confidence >= minConfidence) {
      action = 'sell';
      reasoning = `Bearish trend with ${(analysis.confidence * 100).toFixed(0)}% confidence. ${analysis.signals.join('. ')}`;
    } else {
      reasoning = 'No clear signal. Market is consolidating or confidence is below threshold.';
    }

    const recommendation: TradingRecommendation = {
      action,
      confidence: analysis.confidence,
      reasoning,
      minimumConfidence: minConfidence
    };

    // Add entry/exit levels for non-hold recommendations
    if (action !== 'hold') {
      const atr = this.calculateATR(priceData);
      recommendation.entryPrice = lastPrice;
      recommendation.stopLoss = action === 'buy'
        ? lastPrice - atr * 2
        : lastPrice + atr * 2;
      recommendation.takeProfit = action === 'buy'
        ? lastPrice + atr * 4
        : lastPrice - atr * 4;
      recommendation.riskRewardRatio = 2;
    }

    return recommendation;
  }

  /**
   * Calculate Average True Range
   */
  private calculateATR(priceData: PriceCandle[], period: number = 14): number {
    if (priceData.length < 2) return priceData[0]?.close * 0.02 || 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < priceData.length; i++) {
      const high = priceData[i].high;
      const low = priceData[i].low;
      const prevClose = priceData[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
  }

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(params: PositionSizeParams): PositionSize {
    const { accountBalance, riskPerTrade, entryPrice, stopLossPrice } = params;

    const riskAmount = accountBalance * riskPerTrade;
    const priceRisk = Math.abs(entryPrice - stopLossPrice);
    const quantity = priceRisk > 0 ? riskAmount / priceRisk : 0;

    return {
      quantity,
      riskAmount,
      positionValue: quantity * entryPrice
    };
  }

  /**
   * Calculate correlation between two price series
   */
  calculateCorrelation(prices1: number[], prices2: number[]): number {
    const n = Math.min(prices1.length, prices2.length);
    if (n < 2) return 0;

    const p1 = prices1.slice(-n);
    const p2 = prices2.slice(-n);

    const mean1 = p1.reduce((a, b) => a + b, 0) / n;
    const mean2 = p2.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = p1[i] - mean1;
      const diff2 = p2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1 * denom2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Compare performance of multiple assets
   */
  compareAssets(assets: { symbol: string; prices: number[] }[]): AssetComparison {
    const performances: AssetPerformance[] = assets.map(asset => {
      const firstPrice = asset.prices[0];
      const lastPrice = asset.prices[asset.prices.length - 1];
      const returnPercent = ((lastPrice - firstPrice) / firstPrice) * 100;

      return {
        symbol: asset.symbol,
        returnPercent,
        prices: asset.prices
      };
    });

    performances.sort((a, b) => b.returnPercent - a.returnPercent);

    return {
      rankings: performances,
      bestPerformer: performances[0].symbol,
      worstPerformer: performances[performances.length - 1].symbol
    };
  }

  /**
   * Calculate Sharpe Ratio
   */
  calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const excessReturn = avgReturn - riskFreeRate;

    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : excessReturn / stdDev;
  }

  /**
   * Calculate Maximum Drawdown
   */
  calculateMaxDrawdown(equityCurve: number[]): number {
    let maxDrawdown = 0;
    let peak = equityCurve[0];

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  calculateVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return sorted[index] || sorted[0];
  }
}
