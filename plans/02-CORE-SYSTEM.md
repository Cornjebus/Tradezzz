# Core System Implementation - Phase 2

## 🎯 Overview

This plan covers the implementation of the core trading engine foundation, including AgentDB integration, memory management, configuration system, and monitoring infrastructure.

**Timeline**: Week 2
**Dependencies**: Phase 1 (Architecture) must be completed
**Deliverables**: Working core engine with AgentDB persistence

## 📋 Implementation Checklist

- [ ] Trading engine foundation
- [ ] AgentDB integration with vector storage
- [ ] Memory management system
- [ ] Configuration system
- [ ] Logging and monitoring
- [ ] Error handling and recovery
- [ ] State persistence
- [ ] Health check system

## 🏗️ Core Components

### 1. Trading Engine Foundation

**File**: `src/core/TradingEngine.ts`

```typescript
import { AgentDB } from 'agentdb';
import { EventEmitter } from 'events';

export interface EngineConfig {
  mode: 'paper' | 'live' | 'backtest';
  agentdb: {
    path: string;
    quantization?: 'none' | 'uint8' | 'uint4';
    enableHNSW?: boolean;
  };
  risk: {
    maxPositionSize: number;
    maxDrawdown: number;
    stopLoss: number;
  };
}

export class TradingEngine extends EventEmitter {
  private db: AgentDB;
  private state: EngineState;
  private config: EngineConfig;
  private isRunning: boolean = false;

  constructor(config: EngineConfig) {
    super();
    this.config = config;
    this.state = {
      portfolio: {},
      positions: [],
      balance: 0,
      equity: 0,
      timestamp: Date.now()
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Trading Engine...');

    // 1. Initialize AgentDB with optimized settings
    this.db = new AgentDB({
      path: this.config.agentdb.path,
      embeddings: {
        model: 'all-MiniLM-L6-v2',
        quantization: this.config.agentdb.quantization || 'uint8'
      },
      indexing: {
        type: this.config.agentdb.enableHNSW ? 'hnsw' : 'flat',
        params: {
          M: 16,
          efConstruction: 200,
          efSearch: 100
        }
      }
    });

    await this.db.connect();

    // 2. Create collections for different data types
    await this.createCollections();

    // 3. Load persisted state
    await this.loadState();

    // 4. Initialize monitoring
    this.initializeMonitoring();

    console.log('✅ Trading Engine initialized');
    this.emit('initialized');
  }

  private async createCollections(): Promise<void> {
    // Market data collection
    await this.db.createCollection('market_data', {
      schema: {
        symbol: 'string',
        timestamp: 'number',
        price: 'number',
        volume: 'number',
        indicators: 'object'
      },
      indexes: ['symbol', 'timestamp']
    });

    // Trading patterns collection
    await this.db.createCollection('patterns', {
      schema: {
        name: 'string',
        type: 'string',
        success_rate: 'number',
        conditions: 'object',
        actions: 'array'
      },
      vectorIndex: true // Enable vector search for pattern matching
    });

    // Execution history collection
    await this.db.createCollection('executions', {
      schema: {
        orderId: 'string',
        symbol: 'string',
        side: 'string',
        quantity: 'number',
        price: 'number',
        timestamp: 'number',
        strategy: 'string'
      },
      indexes: ['symbol', 'timestamp', 'strategy']
    });

    // Performance metrics collection
    await this.db.createCollection('metrics', {
      schema: {
        timestamp: 'number',
        sharpe: 'number',
        drawdown: 'number',
        winRate: 'number',
        totalPnL: 'number'
      },
      timeSeries: true
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Engine already running');
    }

    console.log(`🎯 Starting Trading Engine in ${this.config.mode} mode`);
    this.isRunning = true;

    // Start event loop
    this.startEventLoop();

    this.emit('started');
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Trading Engine...');
    this.isRunning = false;

    // Save state before shutdown
    await this.saveState();

    // Close connections
    await this.db.close();

    this.emit('stopped');
  }

  private async loadState(): Promise<void> {
    const savedState = await this.db.query({
      collection: 'engine_state',
      filter: { key: 'latest' }
    });

    if (savedState.length > 0) {
      this.state = savedState[0].data;
      console.log('📥 Loaded persisted state');
    }
  }

  private async saveState(): Promise<void> {
    await this.db.upsert({
      collection: 'engine_state',
      data: {
        key: 'latest',
        data: this.state,
        timestamp: Date.now()
      }
    });
    console.log('💾 State saved');
  }

  private startEventLoop(): void {
    // Main event loop for processing market data and signals
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.processMarketData();
        await this.updateMetrics();
      } catch (error) {
        this.handleError(error);
      }
    }, 1000); // 1 second intervals
  }

  private async processMarketData(): Promise<void> {
    // Process incoming market data
    this.emit('tick', this.state);
  }

  private async updateMetrics(): Promise<void> {
    const metrics = {
      timestamp: Date.now(),
      sharpe: this.calculateSharpe(),
      drawdown: this.calculateDrawdown(),
      winRate: this.calculateWinRate(),
      totalPnL: this.calculatePnL()
    };

    await this.db.insert({
      collection: 'metrics',
      data: metrics
    });

    this.emit('metrics', metrics);
  }

  private initializeMonitoring(): void {
    // Set up health checks
    setInterval(() => {
      const health = {
        isRunning: this.isRunning,
        dbConnected: this.db.isConnected(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      this.emit('health', health);
    }, 5000); // 5 second intervals
  }

  private handleError(error: any): void {
    console.error('❌ Engine error:', error);
    this.emit('error', error);
  }

  // Metric calculations
  private calculateSharpe(): number {
    // Implementation
    return 0;
  }

  private calculateDrawdown(): number {
    // Implementation
    return 0;
  }

  private calculateWinRate(): number {
    // Implementation
    return 0;
  }

  private calculatePnL(): number {
    // Implementation
    return 0;
  }

  // Public API
  getState(): EngineState {
    return { ...this.state };
  }

  async getMetrics(timeRange?: { start: number; end: number }): Promise<any[]> {
    return this.db.query({
      collection: 'metrics',
      filter: timeRange ? {
        timestamp: { $gte: timeRange.start, $lte: timeRange.end }
      } : {}
    });
  }

  async storePattern(pattern: any): Promise<void> {
    await this.db.insert({
      collection: 'patterns',
      data: pattern,
      vector: await this.db.embed(JSON.stringify(pattern))
    });
  }

  async searchSimilarPatterns(pattern: any, topK: number = 5): Promise<any[]> {
    const vector = await this.db.embed(JSON.stringify(pattern));
    return this.db.vectorSearch({
      collection: 'patterns',
      vector,
      topK,
      includeDistance: true
    });
  }
}

interface EngineState {
  portfolio: Record<string, number>;
  positions: Position[];
  balance: number;
  equity: number;
  timestamp: number;
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}
```

### 2. Memory Management System

**File**: `src/core/MemoryManager.ts`

```typescript
import { AgentDB } from 'agentdb';

export class MemoryManager {
  private db: AgentDB;
  private cache: Map<string, CacheEntry>;
  private maxCacheSize: number = 1000;

  constructor(db: AgentDB) {
    this.db = db;
    this.cache = new Map();
  }

  async store(key: string, value: any, metadata?: any): Promise<void> {
    // Store in AgentDB with vector embedding
    const vector = await this.db.embed(JSON.stringify(value));

    await this.db.insert({
      collection: 'memory',
      data: {
        key,
        value,
        metadata,
        timestamp: Date.now()
      },
      vector
    });

    // Update cache
    this.updateCache(key, value);
  }

  async retrieve(key: string): Promise<any | null> {
    // Check cache first
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.lastAccessed = Date.now();
      return entry.value;
    }

    // Query AgentDB
    const results = await this.db.query({
      collection: 'memory',
      filter: { key }
    });

    if (results.length > 0) {
      const value = results[0].value;
      this.updateCache(key, value);
      return value;
    }

    return null;
  }

  async searchSimilar(query: string, topK: number = 5): Promise<any[]> {
    const vector = await this.db.embed(query);

    return this.db.vectorSearch({
      collection: 'memory',
      vector,
      topK,
      includeDistance: true
    });
  }

  private updateCache(key: string, value: any): void {
    // Implement LRU cache eviction
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestEntry();
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      lastAccessed: Date.now()
    });
  }

  private findOldestEntry(): string {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  async clearOld(maxAge: number): Promise<number> {
    const cutoff = Date.now() - maxAge;

    const result = await this.db.delete({
      collection: 'memory',
      filter: {
        timestamp: { $lt: cutoff }
      }
    });

    return result.deletedCount;
  }
}

interface CacheEntry {
  value: any;
  lastAccessed: number;
}
```

### 3. Configuration System

**File**: `src/core/ConfigManager.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export class ConfigManager {
  private config: TradingConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config.yaml');
  }

  async load(): Promise<TradingConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      this.config = yaml.load(content) as TradingConfig;

      // Validate configuration
      this.validate();

      return this.config;
    } catch (error) {
      console.warn('⚠️ Failed to load config, using defaults');
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  async save(): Promise<void> {
    const content = yaml.dump(this.config);
    await fs.writeFile(this.configPath, content, 'utf-8');
  }

  get(): TradingConfig {
    return { ...this.config };
  }

  set(updates: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private validate(): void {
    if (!this.config.risk) {
      throw new Error('Missing risk configuration');
    }
    if (this.config.risk.maxPositionSize > 1 || this.config.risk.maxPositionSize < 0) {
      throw new Error('Invalid maxPositionSize (must be 0-1)');
    }
  }

  private getDefaultConfig(): TradingConfig {
    return {
      mode: 'paper',
      agentdb: {
        path: './data/agentdb.db',
        quantization: 'uint8',
        enableHNSW: true
      },
      risk: {
        maxPositionSize: 0.2,
        maxPortfolioRisk: 0.5,
        stopLoss: 0.05,
        takeProfit: 0.15,
        maxDrawdown: 0.25
      },
      execution: {
        slippage: 0.001,
        commission: 0.001,
        minOrderSize: 100
      },
      monitoring: {
        logLevel: 'info',
        enableMetrics: true,
        metricsInterval: 60000
      }
    };
  }
}

export interface TradingConfig {
  mode: 'paper' | 'live' | 'backtest';
  agentdb: {
    path: string;
    quantization?: 'none' | 'uint8' | 'uint4';
    enableHNSW?: boolean;
  };
  risk: {
    maxPositionSize: number;
    maxPortfolioRisk: number;
    stopLoss: number;
    takeProfit: number;
    maxDrawdown: number;
  };
  execution: {
    slippage: number;
    commission: number;
    minOrderSize: number;
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    metricsInterval: number;
  };
}
```

## 🧪 Testing

### Unit Tests

**File**: `tests/core/TradingEngine.test.ts`

```typescript
import { TradingEngine } from '../../src/core/TradingEngine';

describe('TradingEngine', () => {
  let engine: TradingEngine;

  beforeEach(() => {
    engine = new TradingEngine({
      mode: 'paper',
      agentdb: {
        path: ':memory:',
        quantization: 'uint8'
      },
      risk: {
        maxPositionSize: 0.2,
        maxDrawdown: 0.25,
        stopLoss: 0.05
      }
    });
  });

  afterEach(async () => {
    await engine.stop();
  });

  it('should initialize successfully', async () => {
    await expect(engine.initialize()).resolves.not.toThrow();
  });

  it('should start and stop', async () => {
    await engine.initialize();
    await engine.start();
    expect(engine.getState()).toBeDefined();
    await engine.stop();
  });

  it('should store and retrieve patterns', async () => {
    await engine.initialize();

    const pattern = {
      name: 'Momentum Breakout',
      type: 'entry',
      conditions: { rsi: { $gt: 70 } }
    };

    await engine.storePattern(pattern);
    const similar = await engine.searchSimilarPatterns(pattern, 1);

    expect(similar.length).toBeGreaterThan(0);
    expect(similar[0].name).toBe('Momentum Breakout');
  });
});
```

## 🚀 Integration with Swarm

```bash
# Use swarm coordination for core system development
npx claude-flow swarm "implement core trading engine" \
  --strategy development \
  --mode hierarchical \
  --agents 8 \
  --parallel
```

**Agent Distribution**:
- **Coordinator** (1): Overall orchestration
- **Database Engineer** (2): AgentDB integration
- **Backend Developer** (2): Core engine logic
- **Config Specialist** (1): Configuration system
- **Testing Engineer** (1): Unit and integration tests
- **Documentation** (1): Code documentation

## 📊 Success Metrics

- [ ] Engine initializes in < 5 seconds
- [ ] AgentDB HNSW provides 150x faster pattern search
- [ ] Memory usage stays under 500MB
- [ ] State persistence completes in < 1 second
- [ ] Health checks respond in < 100ms
- [ ] 90% test coverage

## 🔗 Next Steps

After completing Phase 2, proceed to:
- **Phase 3**: Agent Implementation (GOAP, SAFLA)
- **Phase 4**: Data Feed Integration
- **Phase 5**: Strategy Development

## 📚 Resources

- [AgentDB Documentation](https://agentdb.ruv.io/docs)
- [HNSW Indexing Guide](https://github.com/nmslib/hnswlib)
- [Trading Engine Patterns](https://www.quantstart.com/articles)

---

**Version**: 1.0.0
**Last Updated**: 2025-10-28
