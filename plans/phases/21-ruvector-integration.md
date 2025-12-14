# Phase 21: RuVector Integration - TDD Specification

## Overview

RuVector is a self-learning vector database that provides:
- **61µs search latency** for pattern matching
- **Graph Neural Networks** that improve search over time
- **Semantic routing** for intelligent AI model selection
- **Tiered storage** for cost-effective memory management

**Philosophy**: The system learns from every successful trade, making future pattern recognition faster and more accurate.

---

## 21.1 Core RuVector Setup (Test-First)

**Test File**: `src/memory/RuVectorStore.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuVectorStore } from './RuVectorStore';

describe('RuVectorStore', () => {
  let store: RuVectorStore;

  beforeEach(async () => {
    store = new RuVectorStore({
      collection: 'test_patterns',
      dimensions: 1536, // OpenAI embedding size
      hnswConfig: {
        m: 16,
        efConstruction: 200,
        efSearch: 100
      }
    });
    await store.initialize();
  });

  afterEach(async () => {
    await store.destroy();
  });

  describe('Initialization', () => {
    it('should_create_collection_with_hnsw_index', async () => {
      const info = await store.getCollectionInfo();

      expect(info.name).toBe('test_patterns');
      expect(info.indexType).toBe('hnsw');
      expect(info.dimensions).toBe(1536);
    });

    it('should_support_multiple_collections_per_user', async () => {
      const userStore = new RuVectorStore({
        collection: 'user_123_patterns',
        dimensions: 1536
      });
      await userStore.initialize();

      const info = await userStore.getCollectionInfo();
      expect(info.name).toBe('user_123_patterns');

      await userStore.destroy();
    });
  });

  describe('Vector Storage', () => {
    it('should_store_pattern_with_embedding', async () => {
      const pattern = {
        id: 'pattern_1',
        embedding: new Float32Array(1536).fill(0.1),
        metadata: {
          symbol: 'BTC/USDT',
          type: 'double_bottom',
          timestamp: new Date(),
          profitability: 0.15
        }
      };

      const result = await store.upsert(pattern);

      expect(result.id).toBe('pattern_1');
      expect(result.success).toBe(true);
    });

    it('should_batch_upsert_multiple_patterns', async () => {
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        id: `pattern_${i}`,
        embedding: new Float32Array(1536).fill(i / 100),
        metadata: { index: i }
      }));

      const results = await store.batchUpsert(patterns);

      expect(results.successCount).toBe(100);
      expect(results.failCount).toBe(0);
    });
  });

  describe('Similarity Search', () => {
    it('should_find_similar_patterns_within_latency_target', async () => {
      // Seed with patterns
      for (let i = 0; i < 1000; i++) {
        await store.upsert({
          id: `pattern_${i}`,
          embedding: new Float32Array(1536).fill(i / 1000),
          metadata: { index: i }
        });
      }

      const queryEmbedding = new Float32Array(1536).fill(0.5);
      const startTime = performance.now();

      const results = await store.search({
        embedding: queryEmbedding,
        topK: 10
      });

      const latency = performance.now() - startTime;

      expect(results.length).toBe(10);
      expect(latency).toBeLessThan(100); // Target: < 100ms
    });

    it('should_return_similarity_scores', async () => {
      await store.upsert({
        id: 'exact_match',
        embedding: new Float32Array(1536).fill(0.5),
        metadata: {}
      });

      const results = await store.search({
        embedding: new Float32Array(1536).fill(0.5),
        topK: 1
      });

      expect(results[0].score).toBeGreaterThan(0.99);
    });

    it('should_filter_by_metadata', async () => {
      await store.batchUpsert([
        { id: 'btc_1', embedding: new Float32Array(1536).fill(0.1), metadata: { symbol: 'BTC/USDT' } },
        { id: 'eth_1', embedding: new Float32Array(1536).fill(0.1), metadata: { symbol: 'ETH/USDT' } },
        { id: 'btc_2', embedding: new Float32Array(1536).fill(0.2), metadata: { symbol: 'BTC/USDT' } }
      ]);

      const results = await store.search({
        embedding: new Float32Array(1536).fill(0.1),
        topK: 10,
        filter: { symbol: 'BTC/USDT' }
      });

      expect(results.length).toBe(2);
      expect(results.every(r => r.metadata.symbol === 'BTC/USDT')).toBe(true);
    });
  });

  describe('Multi-Tenancy', () => {
    it('should_isolate_patterns_by_user', async () => {
      const user1Store = new RuVectorStore({ collection: 'user_1_patterns', dimensions: 1536 });
      const user2Store = new RuVectorStore({ collection: 'user_2_patterns', dimensions: 1536 });

      await user1Store.initialize();
      await user2Store.initialize();

      await user1Store.upsert({
        id: 'private_pattern',
        embedding: new Float32Array(1536).fill(0.1),
        metadata: { secret: 'user1_data' }
      });

      const user2Results = await user2Store.search({
        embedding: new Float32Array(1536).fill(0.1),
        topK: 10
      });

      expect(user2Results.length).toBe(0);

      await user1Store.destroy();
      await user2Store.destroy();
    });
  });
});
```

---

## 21.2 Pattern Memory Service (Test-First)

**Test File**: `src/memory/PatternMemory.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternMemory } from './PatternMemory';
import { OpenAIProvider } from '../ai/providers/adapters/OpenAIProvider';

describe('PatternMemory', () => {
  let memory: PatternMemory;
  let mockAIProvider: any;

  beforeEach(async () => {
    mockAIProvider = {
      getEmbedding: vi.fn().mockResolvedValue(new Float32Array(1536).fill(0.5))
    };

    memory = new PatternMemory({
      userId: 'user_1',
      aiProvider: mockAIProvider
    });
    await memory.initialize();
  });

  describe('Pattern Storage', () => {
    it('should_store_trading_pattern_with_embedding', async () => {
      const pattern = {
        symbol: 'BTC/USDT',
        type: 'double_bottom',
        indicators: {
          rsi: 28,
          macd: -150,
          volume: 1500000
        },
        priceAction: {
          entry: 42000,
          exit: 45000,
          stopLoss: 41000
        },
        outcome: {
          profit: 0.07, // 7%
          duration: 48 // hours
        }
      };

      const stored = await memory.storePattern(pattern);

      expect(stored.id).toBeDefined();
      expect(mockAIProvider.getEmbedding).toHaveBeenCalled();
    });

    it('should_embed_pattern_description_for_semantic_search', async () => {
      const pattern = {
        symbol: 'ETH/USDT',
        type: 'ascending_triangle',
        description: 'Bullish breakout pattern with increasing volume'
      };

      await memory.storePattern(pattern);

      expect(mockAIProvider.getEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('ascending_triangle')
      );
    });
  });

  describe('Pattern Retrieval', () => {
    it('should_find_similar_historical_patterns', async () => {
      // Store historical patterns
      await memory.storePattern({
        symbol: 'BTC/USDT',
        type: 'oversold_bounce',
        indicators: { rsi: 22 },
        outcome: { profit: 0.12 }
      });

      await memory.storePattern({
        symbol: 'BTC/USDT',
        type: 'oversold_bounce',
        indicators: { rsi: 25 },
        outcome: { profit: 0.08 }
      });

      // Query for similar pattern
      const currentMarket = {
        symbol: 'BTC/USDT',
        indicators: { rsi: 24 }
      };

      const similar = await memory.findSimilarPatterns(currentMarket, { topK: 5 });

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].pattern.type).toBe('oversold_bounce');
    });

    it('should_return_pattern_success_rate', async () => {
      // Store mix of profitable and unprofitable patterns
      for (let i = 0; i < 10; i++) {
        await memory.storePattern({
          symbol: 'BTC/USDT',
          type: 'head_and_shoulders',
          outcome: { profit: i % 3 === 0 ? -0.05 : 0.10 }
        });
      }

      const stats = await memory.getPatternStats('head_and_shoulders');

      expect(stats.successRate).toBeGreaterThan(0.6);
      expect(stats.averageProfit).toBeGreaterThan(0);
      expect(stats.sampleSize).toBe(10);
    });
  });

  describe('Learning from Outcomes', () => {
    it('should_update_pattern_with_trade_outcome', async () => {
      const stored = await memory.storePattern({
        symbol: 'BTC/USDT',
        type: 'bullish_flag',
        indicators: { rsi: 45 }
      });

      await memory.recordOutcome(stored.id, {
        profit: 0.15,
        duration: 24,
        exitReason: 'take_profit'
      });

      const pattern = await memory.getPattern(stored.id);

      expect(pattern.outcome.profit).toBe(0.15);
      expect(pattern.outcome.exitReason).toBe('take_profit');
    });

    it('should_improve_pattern_ranking_after_successful_trade', async () => {
      const stored = await memory.storePattern({
        symbol: 'ETH/USDT',
        type: 'cup_and_handle',
        indicators: {}
      });

      const initialRank = await memory.getPatternConfidence(stored.id);

      await memory.recordOutcome(stored.id, {
        profit: 0.20,
        duration: 72,
        exitReason: 'take_profit'
      });

      const updatedRank = await memory.getPatternConfidence(stored.id);

      expect(updatedRank).toBeGreaterThan(initialRank);
    });
  });
});
```

---

## 21.3 GNN Self-Learning (Test-First)

**Test File**: `src/memory/GNNLearning.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GNNLearning } from './GNNLearning';

describe('GNNLearning', () => {
  let gnn: GNNLearning;

  beforeEach(async () => {
    gnn = new GNNLearning({
      graphId: 'test_graph',
      attentionMechanism: 'graph_aware'
    });
    await gnn.initialize();
  });

  describe('Graph Building', () => {
    it('should_create_nodes_for_patterns', async () => {
      await gnn.addPatternNode({
        id: 'pattern_1',
        embedding: new Float32Array(1536).fill(0.1),
        metadata: { type: 'double_bottom' }
      });

      const node = await gnn.getNode('pattern_1');

      expect(node).toBeDefined();
      expect(node.metadata.type).toBe('double_bottom');
    });

    it('should_create_edges_between_related_patterns', async () => {
      await gnn.addPatternNode({ id: 'p1', embedding: new Float32Array(1536).fill(0.1), metadata: {} });
      await gnn.addPatternNode({ id: 'p2', embedding: new Float32Array(1536).fill(0.1), metadata: {} });

      await gnn.createEdge('p1', 'p2', {
        relationship: 'followed_by',
        weight: 0.8
      });

      const edges = await gnn.getEdges('p1');

      expect(edges.length).toBe(1);
      expect(edges[0].target).toBe('p2');
      expect(edges[0].weight).toBe(0.8);
    });
  });

  describe('Attention Mechanism', () => {
    it('should_use_graph_attention_for_pattern_scoring', async () => {
      // Create pattern graph
      await gnn.addPatternNode({ id: 'profitable_1', embedding: new Float32Array(1536).fill(0.5), metadata: { profit: 0.15 } });
      await gnn.addPatternNode({ id: 'profitable_2', embedding: new Float32Array(1536).fill(0.5), metadata: { profit: 0.12 } });
      await gnn.addPatternNode({ id: 'loss_1', embedding: new Float32Array(1536).fill(0.5), metadata: { profit: -0.08 } });

      // Connect profitable patterns
      await gnn.createEdge('profitable_1', 'profitable_2', { weight: 0.9 });

      const query = new Float32Array(1536).fill(0.5);
      const results = await gnn.attentionSearch(query, { topK: 3 });

      // Profitable patterns should rank higher due to graph structure
      expect(results[0].id).toMatch(/profitable/);
    });

    it('should_strengthen_connections_after_positive_feedback', async () => {
      await gnn.addPatternNode({ id: 'p1', embedding: new Float32Array(1536).fill(0.1), metadata: {} });
      await gnn.addPatternNode({ id: 'p2', embedding: new Float32Array(1536).fill(0.1), metadata: {} });
      await gnn.createEdge('p1', 'p2', { weight: 0.5 });

      // Positive feedback: p1 → p2 led to profit
      await gnn.reinforceConnection('p1', 'p2', { reward: 1.0 });

      const edges = await gnn.getEdges('p1');

      expect(edges[0].weight).toBeGreaterThan(0.5);
    });

    it('should_weaken_connections_after_negative_feedback', async () => {
      await gnn.addPatternNode({ id: 'p1', embedding: new Float32Array(1536).fill(0.1), metadata: {} });
      await gnn.addPatternNode({ id: 'p2', embedding: new Float32Array(1536).fill(0.1), metadata: {} });
      await gnn.createEdge('p1', 'p2', { weight: 0.5 });

      // Negative feedback: p1 → p2 led to loss
      await gnn.reinforceConnection('p1', 'p2', { reward: -1.0 });

      const edges = await gnn.getEdges('p1');

      expect(edges[0].weight).toBeLessThan(0.5);
    });
  });

  describe('Self-Improvement', () => {
    it('should_improve_search_accuracy_over_time', async () => {
      // Seed patterns
      for (let i = 0; i < 100; i++) {
        await gnn.addPatternNode({
          id: `pattern_${i}`,
          embedding: new Float32Array(1536).fill(i / 100),
          metadata: { profitable: i % 2 === 0 }
        });
      }

      // Simulate usage: repeatedly search and provide feedback
      const query = new Float32Array(1536).fill(0.5);

      let initialAccuracy = 0;
      let finalAccuracy = 0;

      // Measure initial accuracy
      for (let i = 0; i < 10; i++) {
        const results = await gnn.attentionSearch(query, { topK: 5 });
        const profitable = results.filter(r => r.metadata.profitable).length;
        initialAccuracy += profitable / 5;
      }
      initialAccuracy /= 10;

      // Simulate learning: provide feedback for 50 queries
      for (let i = 0; i < 50; i++) {
        const results = await gnn.attentionSearch(query, { topK: 5 });
        for (const result of results) {
          if (result.metadata.profitable) {
            await gnn.recordPositiveFeedback(result.id);
          } else {
            await gnn.recordNegativeFeedback(result.id);
          }
        }
      }

      // Measure final accuracy
      for (let i = 0; i < 10; i++) {
        const results = await gnn.attentionSearch(query, { topK: 5 });
        const profitable = results.filter(r => r.metadata.profitable).length;
        finalAccuracy += profitable / 5;
      }
      finalAccuracy /= 10;

      expect(finalAccuracy).toBeGreaterThan(initialAccuracy);
    });
  });
});
```

---

## 21.4 Semantic AI Routing (Test-First)

**Test File**: `src/memory/SemanticRouter.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticRouter } from './SemanticRouter';
import { AIProviderFactory } from '../ai/providers/AIProviderFactory';

describe('SemanticRouter', () => {
  let router: SemanticRouter;

  beforeEach(async () => {
    router = new SemanticRouter({
      userId: 'user_1',
      providers: {
        cheap: { provider: 'deepseek', model: 'deepseek-v3.2' },
        balanced: { provider: 'openai', model: 'gpt-4.1' },
        premium: { provider: 'anthropic', model: 'claude-opus-4.5' },
        reasoning: { provider: 'openai', model: 'o3' },
        fast: { provider: 'groq', model: 'llama-3.3-70b-versatile' }
      }
    });
    await router.initialize();
  });

  describe('Query Classification', () => {
    it('should_route_simple_queries_to_cheap_model', async () => {
      const query = 'What is the current price of BTC?';

      const route = await router.classify(query);

      expect(route.tier).toBe('cheap');
      expect(route.provider).toBe('deepseek');
    });

    it('should_route_complex_analysis_to_premium_model', async () => {
      const query = `
        Analyze the correlation between BTC dominance,
        altcoin market cap, DeFi TVL, and stablecoin flows
        to predict the likely market regime for Q1 2025.
        Consider macro factors and on-chain metrics.
      `;

      const route = await router.classify(query);

      expect(route.tier).toBe('premium');
      expect(['anthropic', 'openai']).toContain(route.provider);
    });

    it('should_route_multi_step_reasoning_to_reasoning_model', async () => {
      const query = `
        Given a portfolio of BTC (40%), ETH (30%), SOL (20%), LINK (10%),
        and current market conditions showing RSI divergence on BTC,
        accumulation patterns on ETH, and SOL in a descending channel,
        create a step-by-step rebalancing plan that minimizes tax impact
        while maximizing risk-adjusted returns over 6 months.
      `;

      const route = await router.classify(query);

      expect(route.tier).toBe('reasoning');
      expect(route.model).toBe('o3');
    });

    it('should_route_latency_sensitive_queries_to_fast_model', async () => {
      const query = 'Quick: Is RSI above 70?';

      const route = await router.classify(query, { latencyPriority: true });

      expect(route.tier).toBe('fast');
      expect(route.provider).toBe('groq');
    });

    it('should_route_sentiment_analysis_to_balanced_model', async () => {
      const query = 'Analyze the sentiment of this tweet: "BTC to 100k soon! 🚀"';

      const route = await router.classify(query);

      expect(['cheap', 'balanced']).toContain(route.tier);
    });
  });

  describe('Cost Optimization', () => {
    it('should_prefer_cheaper_model_when_confidence_is_high', async () => {
      // Train router with successful cheap model responses
      for (let i = 0; i < 10; i++) {
        await router.recordSuccess('cheap', {
          queryType: 'price_check',
          latency: 200,
          quality: 0.95
        });
      }

      const route = await router.classify('What is ETH price?');

      expect(route.tier).toBe('cheap');
      expect(route.confidence).toBeGreaterThan(0.9);
    });

    it('should_upgrade_to_better_model_after_failures', async () => {
      // Record failures from cheap model
      for (let i = 0; i < 5; i++) {
        await router.recordFailure('cheap', {
          queryType: 'market_analysis',
          error: 'low_quality_response'
        });
      }

      const route = await router.classify('Analyze the market');

      expect(['balanced', 'premium']).toContain(route.tier);
    });

    it('should_estimate_cost_before_routing', async () => {
      const query = 'Detailed market analysis for BTC';

      const route = await router.classify(query);

      expect(route.estimatedCost).toBeDefined();
      expect(route.estimatedCost).toBeGreaterThan(0);
      expect(route.estimatedTokens).toBeDefined();
    });
  });

  describe('User Budget Awareness', () => {
    it('should_respect_user_cost_limit', async () => {
      router.setUserBudget({
        dailyLimit: 1.00, // $1/day
        currentSpend: 0.95 // Already spent $0.95
      });

      const route = await router.classify('Complex analysis needed');

      expect(route.tier).toBe('cheap'); // Forced to cheap
      expect(route.budgetWarning).toBe(true);
    });

    it('should_suggest_local_model_when_budget_exhausted', async () => {
      router.setUserBudget({
        dailyLimit: 1.00,
        currentSpend: 1.00
      });

      const route = await router.classify('Any analysis');

      expect(route.tier).toBe('local');
      expect(route.provider).toBe('ollama');
      expect(route.message).toContain('budget');
    });
  });

  describe('Learning', () => {
    it('should_learn_optimal_routing_from_feedback', async () => {
      // Simulate: user rates responses
      for (let i = 0; i < 20; i++) {
        const query = 'Analyze momentum indicators';
        const route = await router.classify(query);

        // Provide feedback
        await router.recordFeedback(route.requestId, {
          rating: route.tier === 'balanced' ? 5 : 3,
          useful: route.tier === 'balanced'
        });
      }

      // After learning, should prefer balanced for this query type
      const finalRoute = await router.classify('Analyze momentum indicators');

      expect(finalRoute.tier).toBe('balanced');
    });
  });
});
```

---

## 21.5 Multi-Asset Correlation Graph (Test-First)

**Test File**: `src/memory/AssetCorrelationGraph.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AssetCorrelationGraph } from './AssetCorrelationGraph';

describe('AssetCorrelationGraph', () => {
  let graph: AssetCorrelationGraph;

  beforeEach(async () => {
    graph = new AssetCorrelationGraph({
      userId: 'user_1'
    });
    await graph.initialize();
  });

  describe('Asset Nodes', () => {
    it('should_create_asset_nodes', async () => {
      await graph.addAsset('BTC/USDT', {
        sector: 'large_cap',
        category: 'store_of_value'
      });

      const node = await graph.getAsset('BTC/USDT');

      expect(node).toBeDefined();
      expect(node.metadata.sector).toBe('large_cap');
    });
  });

  describe('Correlation Edges', () => {
    it('should_track_correlation_between_assets', async () => {
      await graph.addAsset('BTC/USDT', {});
      await graph.addAsset('ETH/USDT', {});

      await graph.updateCorrelation('BTC/USDT', 'ETH/USDT', {
        correlation: 0.85,
        timeframe: '7d',
        sampleSize: 168 // hourly data
      });

      const correlation = await graph.getCorrelation('BTC/USDT', 'ETH/USDT');

      expect(correlation.value).toBe(0.85);
      expect(correlation.timeframe).toBe('7d');
    });

    it('should_query_highly_correlated_assets', async () => {
      await graph.addAsset('BTC/USDT', {});
      await graph.addAsset('ETH/USDT', {});
      await graph.addAsset('SOL/USDT', {});
      await graph.addAsset('DOGE/USDT', {});

      await graph.updateCorrelation('BTC/USDT', 'ETH/USDT', { correlation: 0.88 });
      await graph.updateCorrelation('BTC/USDT', 'SOL/USDT', { correlation: 0.72 });
      await graph.updateCorrelation('BTC/USDT', 'DOGE/USDT', { correlation: 0.45 });

      const correlated = await graph.findCorrelatedAssets('BTC/USDT', {
        minCorrelation: 0.7
      });

      expect(correlated.length).toBe(2);
      expect(correlated.map(a => a.symbol)).toContain('ETH/USDT');
      expect(correlated.map(a => a.symbol)).toContain('SOL/USDT');
    });

    it('should_find_inversely_correlated_assets', async () => {
      await graph.addAsset('BTC/USDT', {});
      await graph.addAsset('USDT/USD', {});

      await graph.updateCorrelation('BTC/USDT', 'USDT/USD', { correlation: -0.65 });

      const hedges = await graph.findHedgeAssets('BTC/USDT');

      expect(hedges.length).toBeGreaterThan(0);
      expect(hedges[0].correlation).toBeLessThan(0);
    });
  });

  describe('Graph Queries', () => {
    it('should_answer_what_happens_when_btc_drops', async () => {
      // Build graph with historical data
      await graph.addAsset('BTC/USDT', { historicalDrawdowns: [{ drop: -0.20, date: '2024-08' }] });
      await graph.addAsset('ETH/USDT', {});
      await graph.addAsset('SOL/USDT', {});

      await graph.recordEvent({
        trigger: { asset: 'BTC/USDT', action: 'drop', magnitude: -0.20 },
        effects: [
          { asset: 'ETH/USDT', change: -0.25, lag: '2h' },
          { asset: 'SOL/USDT', change: -0.35, lag: '4h' }
        ]
      });

      const prediction = await graph.predictImpact({
        asset: 'BTC/USDT',
        scenario: 'drop',
        magnitude: -0.10
      });

      expect(prediction.effects.length).toBeGreaterThan(0);
      expect(prediction.effects.find(e => e.asset === 'ETH/USDT')).toBeDefined();
    });
  });
});
```

---

## 21.6 Strategy Embeddings (Test-First)

**Test File**: `src/memory/StrategyEmbeddings.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyEmbeddings } from './StrategyEmbeddings';

describe('StrategyEmbeddings', () => {
  let embeddings: StrategyEmbeddings;
  let mockAIProvider: any;

  beforeEach(async () => {
    mockAIProvider = {
      getEmbedding: vi.fn().mockResolvedValue(new Float32Array(1536).fill(0.5))
    };

    embeddings = new StrategyEmbeddings({
      userId: 'user_1',
      aiProvider: mockAIProvider
    });
    await embeddings.initialize();
  });

  describe('Strategy Storage', () => {
    it('should_embed_strategy_configuration', async () => {
      const strategy = {
        id: 'strat_1',
        name: 'RSI Momentum',
        type: 'momentum',
        config: {
          rsiPeriod: 14,
          oversoldThreshold: 30,
          overboughtThreshold: 70,
          symbols: ['BTC/USDT', 'ETH/USDT']
        },
        performance: {
          sharpeRatio: 1.8,
          winRate: 0.65,
          maxDrawdown: -0.12
        }
      };

      const stored = await embeddings.storeStrategy(strategy);

      expect(stored.id).toBeDefined();
      expect(mockAIProvider.getEmbedding).toHaveBeenCalled();
    });
  });

  describe('Strategy Search', () => {
    it('should_find_similar_successful_strategies', async () => {
      // Store multiple strategies
      await embeddings.storeStrategy({
        id: 'good_1',
        type: 'momentum',
        config: { rsiPeriod: 14 },
        performance: { sharpeRatio: 2.1, winRate: 0.70 }
      });

      await embeddings.storeStrategy({
        id: 'good_2',
        type: 'momentum',
        config: { rsiPeriod: 21 },
        performance: { sharpeRatio: 1.9, winRate: 0.68 }
      });

      await embeddings.storeStrategy({
        id: 'bad_1',
        type: 'mean_reversion',
        config: { rsiPeriod: 7 },
        performance: { sharpeRatio: 0.5, winRate: 0.45 }
      });

      // Query for similar strategies
      const query = {
        type: 'momentum',
        config: { rsiPeriod: 14 }
      };

      const similar = await embeddings.findSimilar(query, {
        topK: 5,
        minSharpe: 1.5
      });

      expect(similar.length).toBe(2);
      expect(similar.every(s => s.performance.sharpeRatio >= 1.5)).toBe(true);
    });

    it('should_recommend_strategy_improvements', async () => {
      // Store a user's underperforming strategy
      const userStrategy = await embeddings.storeStrategy({
        id: 'user_strat',
        type: 'momentum',
        config: { rsiPeriod: 7 }, // Too short
        performance: { sharpeRatio: 0.8, winRate: 0.52 }
      });

      // Store community best practices
      await embeddings.storeStrategy({
        id: 'community_best',
        type: 'momentum',
        config: { rsiPeriod: 14 },
        performance: { sharpeRatio: 2.0, winRate: 0.68 }
      });

      const recommendations = await embeddings.getImprovementSuggestions('user_strat');

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].suggestion).toContain('rsiPeriod');
    });
  });

  describe('Market Condition Matching', () => {
    it('should_find_strategies_that_worked_in_similar_conditions', async () => {
      // Store strategies with market condition tags
      await embeddings.storeStrategy({
        id: 'bull_strat',
        type: 'trend_following',
        marketConditions: { trend: 'bullish', volatility: 'high' },
        performance: { sharpeRatio: 2.5 }
      });

      await embeddings.storeStrategy({
        id: 'bear_strat',
        type: 'mean_reversion',
        marketConditions: { trend: 'bearish', volatility: 'low' },
        performance: { sharpeRatio: 1.8 }
      });

      // Query for current conditions
      const currentConditions = {
        trend: 'bullish',
        volatility: 'high'
      };

      const matches = await embeddings.findByConditions(currentConditions);

      expect(matches[0].id).toBe('bull_strat');
    });
  });
});
```

---

## Implementation Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 29 | Core Setup | RuVectorStore, Pattern Memory |
| 30 | Learning | GNN Self-Learning, Feedback loops |
| 31 | Routing | Semantic AI Router, Cost optimization |
| 32 | Graphs | Asset Correlation, Strategy Embeddings |

## Success Criteria

| Metric | Target |
|--------|--------|
| Search Latency | < 100ms (p95) |
| Pattern Accuracy | Improve 10% over baseline after 1000 trades |
| Cost Savings | 40% reduction via smart routing |
| Test Coverage | 90%+ |
| Tests | 30+ |

## Dependencies

- Phase 17: AI Provider Adapters (for embeddings and routing)
- Phase 18: AI Key Security (for secure embedding calls)
