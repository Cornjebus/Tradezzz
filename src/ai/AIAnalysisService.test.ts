import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIAnalysisService,
  MarketAnalysis,
  TechnicalIndicators,
  TradingRecommendation
} from './AIAnalysisService';

describe('AIAnalysisService', () => {
  let analysisService: AIAnalysisService;

  beforeEach(() => {
    analysisService = new AIAnalysisService();
  });

  describe('Technical Analysis', () => {
    it('should_calculate_sma', () => {
      const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
      const sma = analysisService.calculateSMA(prices, 5);

      expect(sma).toBeDefined();
      expect(sma.length).toBe(6); // 10 prices - 5 period + 1
      expect(sma[sma.length - 1]).toBeCloseTo(108, 0);
    });

    it('should_calculate_ema', () => {
      const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
      const ema = analysisService.calculateEMA(prices, 5);

      expect(ema).toBeDefined();
      expect(ema.length).toBeGreaterThan(0);
    });

    it('should_calculate_rsi', () => {
      const prices = [44, 44.25, 44.5, 43.75, 44.5, 44.25, 44.5, 44, 43.5, 44, 43.5, 44.25, 44.5, 44.25];
      const rsi = analysisService.calculateRSI(prices, 14);

      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should_calculate_macd', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10);
      const macd = analysisService.calculateMACD(prices);

      expect(macd.macd).toBeDefined();
      expect(macd.signal).toBeDefined();
      expect(macd.histogram).toBeDefined();
    });

    it('should_calculate_bollinger_bands', () => {
      const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109, 108, 110, 112, 111, 113, 115, 114, 116, 118, 117];
      const bb = analysisService.calculateBollingerBands(prices, 20, 2);

      expect(bb.upper).toBeDefined();
      expect(bb.middle).toBeDefined();
      expect(bb.lower).toBeDefined();
      expect(bb.upper).toBeGreaterThan(bb.middle);
      expect(bb.lower).toBeLessThan(bb.middle);
    });

    it('should_detect_support_resistance_levels', () => {
      const priceData = [
        { high: 110, low: 100 },
        { high: 112, low: 105 },
        { high: 108, low: 100 },
        { high: 115, low: 108 },
        { high: 120, low: 112 },
        { high: 118, low: 110 },
        { high: 122, low: 115 },
      ];

      const levels = analysisService.detectSupportResistance(priceData);

      expect(levels.support).toBeDefined();
      expect(levels.resistance).toBeDefined();
      expect(levels.support.length).toBeGreaterThan(0);
      expect(levels.resistance.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Recognition', () => {
    it('should_detect_trend_direction', () => {
      const uptrend = [100, 102, 104, 106, 108, 110, 112];
      const downtrend = [112, 110, 108, 106, 104, 102, 100];
      const sideways = [100, 101, 100, 101, 100, 101, 100];

      expect(analysisService.detectTrend(uptrend)).toBe('bullish');
      expect(analysisService.detectTrend(downtrend)).toBe('bearish');
      expect(analysisService.detectTrend(sideways)).toBe('neutral');
    });

    it('should_calculate_trend_strength', () => {
      // Strong consistent trend (goes straight up)
      const strongTrend = [100, 105, 110, 115, 120, 125, 130];
      // Choppy weak trend (lots of back and forth)
      const choppyTrend = [100, 102, 100, 103, 101, 104, 103];

      const strongStrength = analysisService.calculateTrendStrength(strongTrend);
      const choppyStrength = analysisService.calculateTrendStrength(choppyTrend);

      // Strong trend should have higher strength (more direct path)
      expect(strongStrength).toBeGreaterThan(choppyStrength);
      expect(strongStrength).toBeGreaterThanOrEqual(0);
      expect(strongStrength).toBeLessThanOrEqual(1);
    });

    it('should_detect_candlestick_patterns', () => {
      // Doji pattern (open ≈ close)
      const doji = { open: 100, high: 105, low: 95, close: 100.1 };

      // Hammer pattern (small body at top, long lower wick, no upper wick)
      // Body size = 1, lower wick = 8, upper wick = 0
      const hammer = { open: 104, high: 105, low: 96, close: 105 };

      const dojiPattern = analysisService.detectCandlestickPattern(doji);
      const hammerPattern = analysisService.detectCandlestickPattern(hammer);

      expect(dojiPattern.name).toBe('doji');
      expect(hammerPattern.name).toBe('hammer');
    });

    it('should_calculate_volatility', () => {
      const lowVol = [100, 100.5, 100.2, 100.8, 100.3, 100.6, 100.4];
      const highVol = [100, 110, 95, 115, 90, 120, 85];

      const lowVolatility = analysisService.calculateVolatility(lowVol);
      const highVolatility = analysisService.calculateVolatility(highVol);

      expect(highVolatility).toBeGreaterThan(lowVolatility);
    });
  });

  describe('Market Analysis', () => {
    it('should_generate_market_analysis', () => {
      const priceData = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i * 0.5,
        high: 102 + i * 0.5,
        low: 99 + i * 0.5,
        close: 101 + i * 0.5,
        volume: 1000 + i * 10
      }));

      const analysis = analysisService.analyzeMarket('BTC/USDT', priceData);

      expect(analysis.symbol).toBe('BTC/USDT');
      expect(analysis.trend).toBeDefined();
      expect(analysis.indicators).toBeDefined();
      expect(analysis.signals).toBeDefined();
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should_include_volume_analysis', () => {
      const priceData = Array.from({ length: 30 }, (_, i) => ({
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000 * (1 + Math.random())
      }));

      const analysis = analysisService.analyzeMarket('ETH/USDT', priceData);

      expect(analysis.volumeAnalysis).toBeDefined();
      expect(analysis.volumeAnalysis.trend).toBeDefined();
      expect(analysis.volumeAnalysis.averageVolume).toBeGreaterThan(0);
    });

    it('should_detect_overbought_oversold', () => {
      // Create data that would result in high RSI (overbought)
      const overboughtData = Array.from({ length: 20 }, (_, i) => ({
        open: 100 + i * 2,
        high: 102 + i * 2,
        low: 99 + i * 2,
        close: 101 + i * 2,
        volume: 1000
      }));

      const analysis = analysisService.analyzeMarket('SOL/USDT', overboughtData);

      expect(analysis.indicators.rsi).toBeDefined();
    });
  });

  describe('Trading Recommendations', () => {
    it('should_generate_trading_recommendation', () => {
      const priceData = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i * 0.5,
        high: 102 + i * 0.5,
        low: 99 + i * 0.5,
        close: 101 + i * 0.5,
        volume: 1000
      }));

      const recommendation = analysisService.generateRecommendation(
        'BTC/USDT',
        priceData,
        { riskTolerance: 'medium' }
      );

      expect(recommendation.action).toBeDefined();
      expect(['buy', 'sell', 'hold']).toContain(recommendation.action);
      expect(recommendation.confidence).toBeDefined();
      expect(recommendation.reasoning).toBeDefined();
    });

    it('should_include_risk_management_levels', () => {
      const priceData = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000
      }));

      const recommendation = analysisService.generateRecommendation(
        'BTC/USDT',
        priceData,
        { riskTolerance: 'low' }
      );

      if (recommendation.action !== 'hold') {
        expect(recommendation.entryPrice).toBeDefined();
        expect(recommendation.stopLoss).toBeDefined();
        expect(recommendation.takeProfit).toBeDefined();
      }
    });

    it('should_adjust_for_risk_tolerance', () => {
      const priceData = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i * 0.5,
        high: 102 + i * 0.5,
        low: 99 + i * 0.5,
        close: 101 + i * 0.5,
        volume: 1000
      }));

      const lowRisk = analysisService.generateRecommendation('BTC/USDT', priceData, { riskTolerance: 'low' });
      const highRisk = analysisService.generateRecommendation('BTC/USDT', priceData, { riskTolerance: 'high' });

      // Low risk should require higher confidence
      expect(lowRisk.minimumConfidence).toBeGreaterThan(highRisk.minimumConfidence);
    });

    it('should_calculate_position_size', () => {
      const positionSize = analysisService.calculatePositionSize({
        accountBalance: 10000,
        riskPerTrade: 0.02, // 2%
        entryPrice: 50000,
        stopLossPrice: 49000
      });

      expect(positionSize.quantity).toBeDefined();
      expect(positionSize.riskAmount).toBe(200); // 2% of 10000
      expect(positionSize.quantity).toBeGreaterThan(0);
    });
  });

  describe('Multi-Asset Analysis', () => {
    it('should_analyze_correlation', () => {
      const btcPrices = [100, 102, 105, 103, 108, 110, 112];
      const ethPrices = [50, 51, 53, 52, 54, 56, 57];

      const correlation = analysisService.calculateCorrelation(btcPrices, ethPrices);

      expect(correlation).toBeGreaterThanOrEqual(-1);
      expect(correlation).toBeLessThanOrEqual(1);
      expect(correlation).toBeGreaterThan(0.5); // Should be positively correlated
    });

    it('should_compare_asset_performance', () => {
      const assets = [
        { symbol: 'BTC/USDT', prices: [100, 105, 110, 108, 115] },
        { symbol: 'ETH/USDT', prices: [50, 55, 52, 58, 60] },
        { symbol: 'SOL/USDT', prices: [20, 22, 25, 24, 28] }
      ];

      const comparison = analysisService.compareAssets(assets);

      expect(comparison.rankings).toBeDefined();
      expect(comparison.rankings.length).toBe(3);
      expect(comparison.bestPerformer).toBeDefined();
      expect(comparison.worstPerformer).toBeDefined();
    });
  });

  describe('Risk Metrics', () => {
    it('should_calculate_sharpe_ratio', () => {
      const returns = [0.02, 0.01, -0.01, 0.03, 0.02, -0.005, 0.015];
      const riskFreeRate = 0.001;

      const sharpeRatio = analysisService.calculateSharpeRatio(returns, riskFreeRate);

      expect(sharpeRatio).toBeDefined();
      expect(typeof sharpeRatio).toBe('number');
    });

    it('should_calculate_max_drawdown', () => {
      const equityCurve = [1000, 1100, 1050, 1200, 1150, 1000, 1100, 1300];

      const maxDrawdown = analysisService.calculateMaxDrawdown(equityCurve);

      expect(maxDrawdown).toBeDefined();
      expect(maxDrawdown).toBeGreaterThan(0);
      expect(maxDrawdown).toBeLessThan(1);
    });

    it('should_calculate_value_at_risk', () => {
      const returns = [0.02, -0.01, 0.03, -0.02, 0.01, -0.03, 0.02, -0.01, 0.01, -0.02];

      const var95 = analysisService.calculateVaR(returns, 0.95);

      expect(var95).toBeDefined();
      expect(var95).toBeLessThan(0); // VaR should be negative (potential loss)
    });
  });
});
