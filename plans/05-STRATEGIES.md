# Trading Strategies - Phase 5

## 🎯 Overview

Implementation of multiple trading strategies with a flexible framework for creating custom strategies. Includes momentum, mean reversion, sentiment-based, and multi-factor strategies.

**Timeline**: Week 5
**Dependencies**: Phases 3-4 (Agents & Data Feeds)
**Deliverables**: Production-ready strategy library with backtesting

## 📋 Implementation Checklist

- [ ] Strategy framework and base class
- [ ] Momentum strategy implementation
- [ ] Mean reversion strategy
- [ ] Sentiment-based strategy
- [ ] Multi-factor strategy
- [ ] Strategy backtesting engine
- [ ] Performance comparison tools
- [ ] Custom strategy templates

## 🏗️ Strategy Framework

### Base Strategy Class

**File**: `src/strategies/BaseStrategy.ts`

```typescript
import { AgentDB } from 'agentdb';

export interface Signal {
  type: 'buy' | 'sell' | 'hold';
  symbol: string;
  confidence: number; // 0-1
  reasoning: string;
  metadata?: any;
}

export interface MarketState {
  symbol: string;
  prices: number[];      // Historical prices
  volumes: number[];     // Historical volumes
  timestamp: number;
  indicators?: {
    sma?: number;
    ema?: number;
    rsi?: number;
    macd?: number;
    bollinger?: { upper: number; middle: number; lower: number };
  };
}

export abstract class BaseStrategy {
  protected db: AgentDB;
  protected config: any;
  public abstract readonly name: string;

  constructor(db: AgentDB, config?: any) {
    this.db = db;
    this.config = config || {};
  }

  /**
   * Analyze market state and generate trading signal
   */
  abstract analyze(state: MarketState): Promise<Signal>;

  /**
   * Calculate technical indicators
   */
  protected calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  protected calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  protected calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  protected calculateMACD(prices: number[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // Calculate signal line (9-period EMA of MACD)
    const macdValues = [macd]; // Simplified, should use historical MACD values
    const signal = this.calculateEMA(macdValues, 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  protected calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    const middle = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);

    // Calculate standard deviation
    const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  /**
   * Store strategy performance for learning
   */
  protected async recordPerformance(
    signal: Signal,
    actualOutcome: number
  ): Promise<void> {
    await this.db.insert({
      collection: 'strategy_performance',
      data: {
        strategy: this.name,
        signal,
        outcome: actualOutcome,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Get historical performance metrics
   */
  async getPerformance(): Promise<StrategyMetrics> {
    const results = await this.db.query({
      collection: 'strategy_performance',
      filter: { strategy: this.name }
    });

    let totalTrades = results.length;
    let successfulTrades = 0;
    let totalReturn = 0;

    for (const result of results) {
      if (result.outcome > 0) {
        successfulTrades++;
      }
      totalReturn += result.outcome;
    }

    return {
      name: this.name,
      totalTrades,
      winRate: totalTrades > 0 ? successfulTrades / totalTrades : 0,
      avgReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
      totalReturn
    };
  }
}

export interface StrategyMetrics {
  name: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
}
```

## 📈 Strategy Implementations

### 1. Momentum Strategy

**File**: `src/strategies/MomentumStrategy.ts`

```typescript
import { BaseStrategy, Signal, MarketState } from './BaseStrategy';
import { AgentDB } from 'agentdb';

export class MomentumStrategy extends BaseStrategy {
  public readonly name = 'Momentum';

  protected config = {
    shortPeriod: 12,
    longPeriod: 26,
    signalPeriod: 9,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    ...this.config
  };

  async analyze(state: MarketState): Promise<Signal> {
    const { prices, symbol } = state;

    // Calculate indicators
    const rsi = this.calculateRSI(prices, this.config.rsiPeriod);
    const macd = this.calculateMACD(prices);
    const sma50 = this.calculateSMA(prices, 50);
    const sma200 = this.calculateSMA(prices, 200);

    const currentPrice = prices[prices.length - 1];

    // Momentum signals
    let score = 0;
    let reasoning: string[] = [];

    // MACD bullish crossover
    if (macd.macd > macd.signal && macd.histogram > 0) {
      score += 0.3;
      reasoning.push('MACD bullish crossover');
    } else if (macd.macd < macd.signal && macd.histogram < 0) {
      score -= 0.3;
      reasoning.push('MACD bearish crossover');
    }

    // RSI momentum
    if (rsi < this.config.rsiOversold) {
      score += 0.2;
      reasoning.push(`RSI oversold (${rsi.toFixed(1)})`);
    } else if (rsi > this.config.rsiOverbought) {
      score -= 0.2;
      reasoning.push(`RSI overbought (${rsi.toFixed(1)})`);
    }

    // Golden/Death cross
    if (sma50 > sma200) {
      score += 0.3;
      reasoning.push('Golden cross (SMA50 > SMA200)');
    } else if (sma50 < sma200) {
      score -= 0.3;
      reasoning.push('Death cross (SMA50 < SMA200)');
    }

    // Price above/below moving averages
    if (currentPrice > sma50) {
      score += 0.2;
      reasoning.push('Price above SMA50');
    } else {
      score -= 0.2;
      reasoning.push('Price below SMA50');
    }

    // Generate signal
    let type: 'buy' | 'sell' | 'hold';
    let confidence: number;

    if (score > 0.4) {
      type = 'buy';
      confidence = Math.min(score, 1.0);
    } else if (score < -0.4) {
      type = 'sell';
      confidence = Math.min(Math.abs(score), 1.0);
    } else {
      type = 'hold';
      confidence = 1.0 - Math.abs(score);
    }

    return {
      type,
      symbol,
      confidence,
      reasoning: reasoning.join(', '),
      metadata: {
        rsi,
        macd: macd.macd,
        signal: macd.signal,
        sma50,
        sma200,
        score
      }
    };
  }
}
```

### 2. Mean Reversion Strategy

**File**: `src/strategies/MeanReversionStrategy.ts`

```typescript
import { BaseStrategy, Signal, MarketState } from './BaseStrategy';
import { AgentDB } from 'agentdb';

export class MeanReversionStrategy extends BaseStrategy {
  public readonly name = 'MeanReversion';

  protected config = {
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    rsiPeriod: 14,
    reversionThreshold: 0.02, // 2% deviation
    ...this.config
  };

  async analyze(state: MarketState): Promise<Signal> {
    const { prices, symbol } = state;

    // Calculate indicators
    const bollinger = this.calculateBollingerBands(
      prices,
      this.config.bollingerPeriod,
      this.config.bollingerStdDev
    );

    const rsi = this.calculateRSI(prices, this.config.rsiPeriod);
    const currentPrice = prices[prices.length - 1];

    // Mean reversion logic
    let score = 0;
    let reasoning: string[] = [];

    // Bollinger Bands
    const upperDeviation = (currentPrice - bollinger.upper) / bollinger.middle;
    const lowerDeviation = (bollinger.lower - currentPrice) / bollinger.middle;

    if (currentPrice > bollinger.upper) {
      // Price above upper band - expect reversion down
      score -= Math.min(upperDeviation * 2, 1.0);
      reasoning.push(`Price above upper Bollinger Band (${(upperDeviation * 100).toFixed(1)}%)`);
    } else if (currentPrice < bollinger.lower) {
      // Price below lower band - expect reversion up
      score += Math.min(lowerDeviation * 2, 1.0);
      reasoning.push(`Price below lower Bollinger Band (${(lowerDeviation * 100).toFixed(1)}%)`);
    }

    // RSI extremes
    if (rsi < 30) {
      score += 0.3;
      reasoning.push(`RSI oversold (${rsi.toFixed(1)}) - expect bounce`);
    } else if (rsi > 70) {
      score -= 0.3;
      reasoning.push(`RSI overbought (${rsi.toFixed(1)}) - expect pullback`);
    }

    // Distance from moving average
    const distanceFromMean = (currentPrice - bollinger.middle) / bollinger.middle;
    if (Math.abs(distanceFromMean) > this.config.reversionThreshold) {
      if (distanceFromMean > 0) {
        score -= 0.2;
        reasoning.push(`Price ${(distanceFromMean * 100).toFixed(1)}% above mean`);
      } else {
        score += 0.2;
        reasoning.push(`Price ${(Math.abs(distanceFromMean) * 100).toFixed(1)}% below mean`);
      }
    }

    // Generate signal
    let type: 'buy' | 'sell' | 'hold';
    let confidence: number;

    if (score > 0.3) {
      type = 'buy';
      confidence = Math.min(score, 1.0);
    } else if (score < -0.3) {
      type = 'sell';
      confidence = Math.min(Math.abs(score), 1.0);
    } else {
      type = 'hold';
      confidence = 1.0 - Math.abs(score);
    }

    return {
      type,
      symbol,
      confidence,
      reasoning: reasoning.join(', '),
      metadata: {
        rsi,
        bollinger,
        currentPrice,
        distanceFromMean,
        score
      }
    };
  }
}
```

### 3. Sentiment Strategy

**File**: `src/strategies/SentimentStrategy.ts`

```typescript
import { BaseStrategy, Signal, MarketState } from './BaseStrategy';
import { AgentDB } from 'agentdb';

export class SentimentStrategy extends BaseStrategy {
  public readonly name = 'Sentiment';

  protected config = {
    sentimentWeight: 0.6,
    volumeWeight: 0.2,
    trendWeight: 0.2,
    sentimentThreshold: 0.3,
    ...this.config
  };

  async analyze(state: MarketState): Promise<Signal> {
    const { symbol, prices } = state;

    // Fetch sentiment data from AgentDB
    const sentimentData = await this.db.query({
      collection: 'feed_sentiment',
      filter: { symbol },
      sort: { timestamp: -1 },
      limit: 100
    });

    if (sentimentData.length === 0) {
      return {
        type: 'hold',
        symbol,
        confidence: 0,
        reasoning: 'No sentiment data available'
      };
    }

    // Aggregate sentiment scores
    const avgSentiment = sentimentData.reduce((sum, d) => sum + d.sentiment, 0) / sentimentData.length;
    const sentimentTrend = this.calculateSentimentTrend(sentimentData);
    const volumeScore = this.calculateVolumeScore(sentimentData);

    // Calculate price trend
    const sma20 = this.calculateSMA(prices, 20);
    const currentPrice = prices[prices.length - 1];
    const priceTrend = (currentPrice - sma20) / sma20;

    // Weighted score
    let score = 0;
    let reasoning: string[] = [];

    // Sentiment component
    const sentimentScore = avgSentiment * this.config.sentimentWeight;
    score += sentimentScore;
    reasoning.push(`Avg sentiment: ${(avgSentiment * 100).toFixed(1)}%`);

    // Sentiment trend component
    if (sentimentTrend > 0.1) {
      score += 0.2;
      reasoning.push('Positive sentiment trend');
    } else if (sentimentTrend < -0.1) {
      score -= 0.2;
      reasoning.push('Negative sentiment trend');
    }

    // Volume component
    score += volumeScore * this.config.volumeWeight;
    reasoning.push(`Sentiment volume: ${volumeScore.toFixed(2)}`);

    // Price trend alignment
    if (priceTrend > 0 && avgSentiment > 0) {
      score += this.config.trendWeight;
      reasoning.push('Sentiment aligns with price trend');
    } else if (priceTrend < 0 && avgSentiment < 0) {
      score -= this.config.trendWeight;
      reasoning.push('Negative sentiment confirmed by price');
    }

    // Generate signal
    let type: 'buy' | 'sell' | 'hold';
    let confidence: number;

    if (score > this.config.sentimentThreshold) {
      type = 'buy';
      confidence = Math.min(score, 1.0);
    } else if (score < -this.config.sentimentThreshold) {
      type = 'sell';
      confidence = Math.min(Math.abs(score), 1.0);
    } else {
      type = 'hold';
      confidence = 1.0 - Math.abs(score);
    }

    return {
      type,
      symbol,
      confidence,
      reasoning: reasoning.join(', '),
      metadata: {
        avgSentiment,
        sentimentTrend,
        volumeScore,
        priceTrend,
        score,
        dataPoints: sentimentData.length
      }
    };
  }

  private calculateSentimentTrend(data: any[]): number {
    if (data.length < 2) return 0;

    const recentSentiment = data.slice(0, Math.floor(data.length / 2))
      .reduce((sum, d) => sum + d.sentiment, 0) / (data.length / 2);

    const olderSentiment = data.slice(Math.floor(data.length / 2))
      .reduce((sum, d) => sum + d.sentiment, 0) / (data.length / 2);

    return recentSentiment - olderSentiment;
  }

  private calculateVolumeScore(data: any[]): number {
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    return Math.tanh(avgVolume / 1000); // Normalize to -1 to 1
  }
}
```

## 🧪 Backtesting Engine

**File**: `src/strategies/BacktestEngine.ts`

```typescript
import { BaseStrategy } from './BaseStrategy';

export class BacktestEngine {
  async backtest(
    strategy: BaseStrategy,
    historicalData: any[],
    initialCapital: number = 100000
  ): Promise<BacktestResults> {
    let capital = initialCapital;
    let position = 0;
    let trades: Trade[] = [];

    for (let i = 50; i < historicalData.length; i++) {
      const state = {
        symbol: historicalData[i].symbol,
        prices: historicalData.slice(Math.max(0, i - 200), i).map((d: any) => d.close),
        volumes: historicalData.slice(Math.max(0, i - 200), i).map((d: any) => d.volume),
        timestamp: historicalData[i].timestamp
      };

      const signal = await strategy.analyze(state);
      const currentPrice = historicalData[i].close;

      if (signal.type === 'buy' && position === 0 && signal.confidence > 0.6) {
        // Buy
        const shares = Math.floor(capital / currentPrice);
        position = shares;
        capital -= shares * currentPrice;

        trades.push({
          type: 'buy',
          price: currentPrice,
          shares,
          timestamp: state.timestamp,
          confidence: signal.confidence
        });
      } else if (signal.type === 'sell' && position > 0 && signal.confidence > 0.6) {
        // Sell
        capital += position * currentPrice;

        trades.push({
          type: 'sell',
          price: currentPrice,
          shares: position,
          timestamp: state.timestamp,
          confidence: signal.confidence
        });

        position = 0;
      }
    }

    // Close any open position
    if (position > 0) {
      const lastPrice = historicalData[historicalData.length - 1].close;
      capital += position * lastPrice;
      position = 0;
    }

    return this.calculateMetrics(trades, initialCapital, capital);
  }

  private calculateMetrics(
    trades: Trade[],
    initialCapital: number,
    finalCapital: number
  ): BacktestResults {
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;

    const buyTrades = trades.filter(t => t.type === 'buy');
    const sellTrades = trades.filter(t => t.type === 'sell');

    let profitableTrades = 0;
    let totalProfit = 0;

    for (let i = 0; i < Math.min(buyTrades.length, sellTrades.length); i++) {
      const profit = (sellTrades[i].price - buyTrades[i].price) * buyTrades[i].shares;
      if (profit > 0) profitableTrades++;
      totalProfit += profit;
    }

    const winRate = sellTrades.length > 0 ? (profitableTrades / sellTrades.length) * 100 : 0;

    return {
      initialCapital,
      finalCapital,
      totalReturn,
      totalTrades: trades.length / 2,
      winRate,
      avgProfit: sellTrades.length > 0 ? totalProfit / sellTrades.length : 0,
      trades
    };
  }
}

interface Trade {
  type: 'buy' | 'sell';
  price: number;
  shares: number;
  timestamp: number;
  confidence: number;
}

export interface BacktestResults {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  trades: Trade[];
}
```

## 📊 Usage Example

```typescript
import { MomentumStrategy } from './strategies/MomentumStrategy';
import { MeanReversionStrategy } from './strategies/MeanReversionStrategy';
import { SentimentStrategy } from './strategies/SentimentStrategy';
import { BacktestEngine } from './strategies/BacktestEngine';
import { AgentDB } from 'agentdb';

// Initialize database
const db = new AgentDB({ path: './data.db' });
await db.connect();

// Create strategies
const momentum = new MomentumStrategy(db);
const meanReversion = new MeanReversionStrategy(db);
const sentiment = new SentimentStrategy(db);

// Backtest
const backtest = new BacktestEngine();
const results = await backtest.backtest(momentum, historicalData, 100000);

console.log(`Total Return: ${results.totalReturn.toFixed(2)}%`);
console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
console.log(`Total Trades: ${results.totalTrades}`);
```

## 🚀 Swarm Integration

```bash
# Research optimal strategy parameters
npx claude-flow swarm "optimize trading strategy parameters" \
  --strategy research \
  --mode mesh \
  --agents 6

# Backtest multiple strategies in parallel
npx claude-flow swarm "backtest all strategies" \
  --strategy testing \
  --mode star \
  --parallel
```

## 📊 Success Metrics

- [ ] Strategy signals generated in < 50ms
- [ ] Backtesting performance > 60% win rate
- [ ] Multi-strategy ensemble improves returns by 15%+
- [ ] Support 10+ concurrent strategies
- [ ] 90% test coverage

---

**Version**: 1.0.0
**Last Updated**: 2025-10-28
