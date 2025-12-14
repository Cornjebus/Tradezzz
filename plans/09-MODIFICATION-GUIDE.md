# Modification Guide - Customizing Neural Trading System

## 🎯 Overview

This guide shows you how to modify and extend the Neural Trading System for your specific needs. Whether you want to add new strategies, integrate different data sources, or customize agent behavior, this guide has you covered.

## 📋 Table of Contents

1. [Adding New Trading Strategies](#adding-new-trading-strategies)
2. [Integrating Data Sources](#integrating-data-sources)
3. [Customizing Agent Behavior](#customizing-agent-behavior)
4. [Extending GOAP Planning](#extending-goap-planning)
5. [Modifying SAFLA Learning](#modifying-safla-learning)
6. [Creating Custom Indicators](#creating-custom-indicators)
7. [Building Plugins](#building-plugins)
8. [Swarm Customization](#swarm-customization)

## 1. Adding New Trading Strategies

### Step 1: Create Strategy Class

```typescript
// src/strategies/my-custom-strategy.ts
import { BaseStrategy } from './base-strategy';
import { MarketState, Signal } from '../types';

export class MyCustomStrategy extends BaseStrategy {
  // Strategy configuration
  protected config = {
    lookbackPeriod: 20,
    threshold: 0.7,
    riskLevel: 'medium'
  };

  // Strategy name and description
  public readonly name = 'MyCustomStrategy';
  public readonly description = 'Custom strategy based on [your logic]';

  // Main analysis method
  async analyze(state: MarketState): Promise<Signal> {
    // 1. Calculate your indicators
    const indicator1 = this.calculateIndicator1(state.prices);
    const indicator2 = this.calculateIndicator2(state.volumes);

    // 2. Generate signal
    const signal = this.generateSignal(indicator1, indicator2);

    // 3. Add confidence
    signal.confidence = this.calculateConfidence(signal);

    // 4. Return signal
    return signal;
  }

  // Custom indicator calculation
  private calculateIndicator1(prices: number[]): number {
    // Your logic here
    return prices.reduce((a, b) => a + b) / prices.length;
  }

  // Signal generation logic
  private generateSignal(ind1: number, ind2: number): Signal {
    if (ind1 > this.config.threshold && ind2 > 0) {
      return {
        type: 'BUY',
        strength: ind1,
        confidence: 0,
        metadata: { ind1, ind2 }
      };
    }

    return {
      type: 'NEUTRAL',
      strength: 0,
      confidence: 0,
      metadata: { ind1, ind2 }
    };
  }

  // Confidence calculation
  private calculateConfidence(signal: Signal): number {
    const { ind1, ind2 } = signal.metadata;
    return Math.min(1, (ind1 + ind2) / 2);
  }
}
```

### Step 2: Register Strategy

```typescript
// src/strategies/index.ts
import { MyCustomStrategy } from './my-custom-strategy';

export const STRATEGIES = {
  momentum: MomentumStrategy,
  meanReversion: MeanReversionStrategy,
  sentiment: SentimentStrategy,
  myCustom: MyCustomStrategy, // Add your strategy here
};

// Export strategy factory
export function createStrategy(name: string, config?: any): BaseStrategy {
  const StrategyClass = STRATEGIES[name];
  if (!StrategyClass) {
    throw new Error(`Unknown strategy: ${name}`);
  }
  return new StrategyClass(config);
}
```

### Step 3: Configure and Use

```typescript
// config/strategies.yaml
strategies:
  - name: myCustom
    enabled: true
    weight: 0.25
    config:
      lookbackPeriod: 30
      threshold: 0.8
      riskLevel: high

// Usage
const strategy = createStrategy('myCustom', {
  lookbackPeriod: 30,
  threshold: 0.8
});

const signal = await strategy.analyze(marketState);
```

### Step 4: Backtest Your Strategy

```bash
# Backtest your custom strategy
neural-trading backtest \
  --strategy myCustom \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --capital 100000

# Compare with other strategies
neural-trading compare \
  --strategies momentum,meanReversion,myCustom \
  --period 1y
```

## 2. Integrating Data Sources

### Step 1: Create Data Feed Class

```typescript
// src/data/feeds/my-custom-feed.ts
import { DataFeed } from './base-feed';
import { Quote, MarketData } from '../types';

export class MyCustomFeed extends DataFeed {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: FeedConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.example.com';
  }

  async initialize(): Promise<void> {
    // Connect to your data source
    await this.connect();
  }

  async getQuote(symbol: string): Promise<Quote> {
    const response = await fetch(
      `${this.baseUrl}/quote/${symbol}`,
      {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }
    );

    const data = await response.json();

    return this.normalizeQuote(data);
  }

  async streamQuotes(symbols: string[], callback: (quote: Quote) => void): Promise<void> {
    // Setup WebSocket or streaming connection
    const ws = new WebSocket(`${this.baseUrl}/stream`);

    ws.on('message', (data) => {
      const quote = this.normalizeQuote(JSON.parse(data));
      callback(quote);
    });
  }

  private normalizeQuote(data: any): Quote {
    return {
      symbol: data.symbol,
      price: data.last_price,
      bid: data.bid,
      ask: data.ask,
      volume: data.volume,
      timestamp: new Date(data.timestamp)
    };
  }
}
```

### Step 2: Register Data Feed

```typescript
// src/data/feeds/index.ts
import { MyCustomFeed } from './my-custom-feed';

export const DATA_FEEDS = {
  alpaca: AlpacaFeed,
  polygon: PolygonFeed,
  myCustom: MyCustomFeed, // Add your feed here
};

export function createFeed(type: string, config: FeedConfig): DataFeed {
  const FeedClass = DATA_FEEDS[type];
  if (!FeedClass) {
    throw new Error(`Unknown feed type: ${type}`);
  }
  return new FeedClass(config);
}
```

### Step 3: Configure Feed

```yaml
# config/data-feeds.yaml
feeds:
  - type: myCustom
    enabled: true
    priority: high
    config:
      apiKey: ${MY_CUSTOM_API_KEY}
      baseUrl: https://api.example.com
      symbols:
        - AAPL
        - GOOGL
        - MSFT
```

### Step 4: Use with Midstreamer

```typescript
// Integration with midstreamer
import { Midstreamer } from 'midstreamer';

const streamer = new Midstreamer({
  sources: ['myCustom', 'alpaca', 'polygon'],
  buffer: 1000,
  realtime: true
});

streamer.on('data', async (data) => {
  // Process streaming data
  await tradingSystem.processMarketData(data);
});
```

## 3. Customizing Agent Behavior

### Step 1: Create Custom Agent

```typescript
// src/agents/my-custom-agent.ts
import { BaseAgent } from './base-agent';
import { Task, Result } from '../types';

export class MyCustomAgent extends BaseAgent {
  public readonly type = 'custom';
  public readonly capabilities = [
    'custom-analysis',
    'special-calculation',
    'unique-feature'
  ];

  async execute(task: Task): Promise<Result> {
    switch (task.type) {
      case 'custom-analysis':
        return await this.performCustomAnalysis(task);
      case 'special-calculation':
        return await this.performSpecialCalculation(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async performCustomAnalysis(task: Task): Promise<Result> {
    // Your custom logic here
    const data = task.data;
    const result = this.analyze(data);

    // Store result in AgentDB
    await this.storeResult(result);

    return {
      success: true,
      data: result,
      metadata: {
        agent: this.name,
        task: task.type,
        timestamp: Date.now()
      }
    };
  }

  // Override decision-making
  async makeDecision(context: Context): Promise<Decision> {
    // 1. Gather information
    const info = await this.gatherInfo(context);

    // 2. Use GOAP for planning
    const plan = await this.goap.createPlan(context.goal, context.state);

    // 3. Check with SAFLA for similar patterns
    const patterns = await this.safla.findSimilarPatterns(context.state);

    // 4. Make informed decision
    return this.synthesizeDecision(plan, patterns, info);
  }
}
```

### Step 2: Register Agent in Swarm

```typescript
// src/coordination/agent-registry.ts
import { MyCustomAgent } from '../agents/my-custom-agent';

export const AGENT_TYPES = {
  researcher: ResearchAgent,
  analyst: AnalystAgent,
  trader: TraderAgent,
  myCustom: MyCustomAgent, // Add your agent
};

// Spawn in swarm
async function spawnCustomAgent(): Promise<void> {
  await mcp('agent_spawn', {
    type: 'myCustom',
    name: 'Custom Agent',
    capabilities: ['custom-analysis', 'special-calculation'],
    swarmId: swarmId
  });
}
```

## 4. Extending GOAP Planning

### Step 1: Add Custom Actions

```typescript
// src/goap/actions/custom-actions.ts
import { Action } from '../types';

export const customActions: Action[] = [
  {
    name: 'analyzeWithCustomIndicator',
    cost: 1,
    preconditions: {
      hasMarketData: true,
      indicatorCalculated: false
    },
    effects: {
      indicatorCalculated: true,
      analysisComplete: false
    },
    async execute(state: State): Promise<State> {
      // Calculate your custom indicator
      const indicator = calculateCustomIndicator(state.marketData);

      return {
        ...state,
        customIndicator: indicator,
        indicatorCalculated: true
      };
    }
  },
  {
    name: 'generateCustomSignal',
    cost: 2,
    preconditions: {
      indicatorCalculated: true,
      analysisComplete: false
    },
    effects: {
      analysisComplete: true,
      signalGenerated: true
    },
    async execute(state: State): Promise<State> {
      // Generate signal from indicator
      const signal = generateSignal(state.customIndicator);

      return {
        ...state,
        signal,
        analysisComplete: true,
        signalGenerated: true
      };
    }
  }
];
```

### Step 2: Add Custom Goals

```typescript
// src/goap/goals/custom-goals.ts
export const customGoals = {
  executeCustomStrategy: {
    name: 'Execute Custom Strategy',
    priority: 8,
    conditions: {
      analysisComplete: true,
      signalGenerated: true,
      riskAssessed: true,
      tradeExecuted: true
    }
  },

  optimizeWithCustomLogic: {
    name: 'Optimize With Custom Logic',
    priority: 6,
    conditions: {
      portfolioAnalyzed: true,
      customOptimizationDone: true,
      rebalanced: true
    }
  }
};
```

### Step 3: Register Actions and Goals

```typescript
// src/goap/planner.ts
import { customActions } from './actions/custom-actions';
import { customGoals } from './goals/custom-goals';

export class GOAPPlanner {
  constructor() {
    // Register built-in actions
    this.actions = [...builtInActions, ...customActions];

    // Register built-in goals
    this.goals = { ...builtInGoals, ...customGoals };
  }

  // Use your custom goal
  async planCustomStrategy(state: State): Promise<Action[]> {
    const goal = this.goals.executeCustomStrategy;
    return await this.createPlan(goal, state);
  }
}
```

## 5. Modifying SAFLA Learning

### Step 1: Custom Feedback Processing

```typescript
// src/safla/custom-feedback.ts
export class CustomSAFLA extends SAFLALearning {
  // Override feedback processing
  async processFeedback(feedback: Feedback): Promise<void> {
    // 1. Store feedback
    await super.processFeedback(feedback);

    // 2. Add custom analysis
    const customMetrics = this.calculateCustomMetrics(feedback);

    // 3. Store custom metrics
    await this.storeCustomMetrics(customMetrics);

    // 4. Trigger custom adaptation
    if (this.shouldAdaptCustom(customMetrics)) {
      await this.customAdaptation(customMetrics);
    }
  }

  private calculateCustomMetrics(feedback: Feedback): CustomMetrics {
    return {
      volatilityAdjustedReturn: feedback.return / feedback.volatility,
      riskAdjustedPerformance: feedback.return / feedback.maxDrawdown,
      consistencyScore: this.calculateConsistency(feedback.history)
    };
  }

  private async customAdaptation(metrics: CustomMetrics): Promise<void> {
    // Adjust strategy parameters based on custom metrics
    if (metrics.volatilityAdjustedReturn < 0.5) {
      await this.increaseConservatism();
    }

    if (metrics.consistencyScore < 0.7) {
      await this.adjustForConsistency();
    }
  }

  // Custom pattern embedding
  protected patternToEmbedding(pattern: Pattern): number[] {
    // Add custom features to embedding
    const baseEmbedding = super.patternToEmbedding(pattern);

    const customFeatures = [
      pattern.volatility || 0,
      pattern.momentum || 0,
      pattern.sentiment || 0,
      pattern.customIndicator1 || 0,
      pattern.customIndicator2 || 0
    ];

    return [...baseEmbedding, ...customFeatures];
  }
}
```

### Step 2: Configure Custom SAFLA

```typescript
// config/safla.yaml
safla:
  learningRate: 0.01
  adaptationThreshold: 0.7
  feedbackWindow: 20
  customMetrics:
    - volatilityAdjustedReturn
    - riskAdjustedPerformance
    - consistencyScore
  adaptationRules:
    - condition: volatilityAdjustedReturn < 0.5
      action: increaseConservatism
    - condition: consistencyScore < 0.7
      action: adjustForConsistency
```

## 6. Creating Custom Indicators

### Step 1: Implement Indicator

```typescript
// src/indicators/my-custom-indicator.ts
export class MyCustomIndicator {
  private period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(data: number[]): number[] {
    const results: number[] = [];

    for (let i = this.period; i < data.length; i++) {
      const slice = data.slice(i - this.period, i);
      const value = this.calculateForPeriod(slice);
      results.push(value);
    }

    return results;
  }

  private calculateForPeriod(data: number[]): number {
    // Your calculation logic
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;

    const variance = data.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    // Return normalized value
    return (data[data.length - 1] - avg) / stdDev;
  }

  // Signal generation
  generateSignal(value: number): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (value > 2) return 'BUY';
    if (value < -2) return 'SELL';
    return 'NEUTRAL';
  }
}
```

### Step 2: Use in Strategy

```typescript
// Use your indicator in a strategy
import { MyCustomIndicator } from '../indicators/my-custom-indicator';

export class StrategyWithCustomIndicator extends BaseStrategy {
  private indicator: MyCustomIndicator;

  constructor(config: any) {
    super(config);
    this.indicator = new MyCustomIndicator(config.period || 14);
  }

  async analyze(state: MarketState): Promise<Signal> {
    // Calculate indicator
    const values = this.indicator.calculate(state.prices);
    const currentValue = values[values.length - 1];

    // Generate signal
    const type = this.indicator.generateSignal(currentValue);

    return {
      type,
      strength: Math.abs(currentValue),
      confidence: this.calculateConfidence(currentValue),
      metadata: { indicatorValue: currentValue }
    };
  }
}
```

## 7. Building Plugins

### Step 1: Create Plugin Interface

```typescript
// src/plugins/plugin-interface.ts
export interface Plugin {
  name: string;
  version: string;
  initialize(system: NeuralTrader): Promise<void>;
  onMarketData?(data: MarketData): Promise<void>;
  onTrade?(trade: Trade): Promise<void>;
  onError?(error: Error): Promise<void>;
  shutdown(): Promise<void>;
}
```

### Step 2: Implement Plugin

```typescript
// plugins/my-custom-plugin.ts
export class MyCustomPlugin implements Plugin {
  public name = 'MyCustomPlugin';
  public version = '1.0.0';

  private trader: NeuralTrader;

  async initialize(system: NeuralTrader): Promise<void> {
    this.trader = system;

    // Setup your plugin
    await this.setup();

    console.log(`${this.name} v${this.version} initialized`);
  }

  async onMarketData(data: MarketData): Promise<void> {
    // Process market data
    const analysis = await this.analyzeData(data);

    // Send to trader if needed
    if (analysis.shouldAlert) {
      await this.trader.notify(analysis);
    }
  }

  async onTrade(trade: Trade): Promise<void> {
    // Log or process trades
    console.log('Trade executed:', trade);

    // Store in external system
    await this.storeTradeExternal(trade);
  }

  async shutdown(): Promise<void> {
    // Cleanup
    console.log(`${this.name} shutting down`);
  }

  private async setup(): Promise<void> {
    // Plugin-specific setup
  }
}
```

### Step 3: Load Plugin

```typescript
// config/plugins.yaml
plugins:
  - name: MyCustomPlugin
    enabled: true
    path: ./plugins/my-custom-plugin
    config:
      option1: value1
      option2: value2

// Load in system
const system = new NeuralTrader(config);
await system.loadPlugin(new MyCustomPlugin());
await system.initialize();
```

## 8. Swarm Customization

### Custom Swarm Topology

```typescript
// src/coordination/custom-topology.ts
export class CustomSwarmTopology {
  async initialize(): Promise<void> {
    // Create custom topology
    await mcp('swarm_init', {
      topology: 'custom',
      maxAgents: 15,
      structure: {
        coordinator: 1,
        strategists: 5,
        executors: 5,
        monitors: 4
      }
    });

    // Define custom communication patterns
    await this.setupCustomCommunication();
  }

  private async setupCustomCommunication(): Promise<void> {
    // Coordinator broadcasts to all
    // Strategists share with each other
    // Executors report to coordinator
    // Monitors observe all
  }
}
```

## 📚 Examples

See the `examples/` folder for complete examples:
- `examples/custom-strategy.ts` - Complete custom strategy
- `examples/custom-feed.ts` - Data feed integration
- `examples/custom-agent.ts` - Agent customization
- `examples/plugin-example.ts` - Plugin development

## 🧪 Testing Your Modifications

```bash
# Test custom strategy
npm run test:strategy -- --name myCustom

# Backtest modifications
neural-trading backtest --strategy myCustom --period 1y

# Test in paper mode
neural-trading start --paper --strategy myCustom

# Run with swarm
neural-trading swarm --agents 5 --strategy myCustom
```

## 📖 Best Practices

1. **Always extend base classes** - Don't reinvent the wheel
2. **Use TypeScript types** - Leverage type safety
3. **Write tests** - Test your modifications
4. **Document your code** - Help future you
5. **Follow naming conventions** - Stay consistent
6. **Use configuration files** - Don't hardcode
7. **Handle errors gracefully** - Expect failures
8. **Log important events** - Aid debugging

---

**Need Help?** Check the [API Documentation](../docs/API.md) or open an issue on GitHub.
