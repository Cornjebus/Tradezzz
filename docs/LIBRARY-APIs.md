# Library API Reference

## 📚 Installed Libraries

This document provides quick reference for the actual npm packages used in the Neural Trading System.

## 🧠 AgentDB v1.6.1

**Package**: `agentdb@1.6.1`
**Repository**: https://github.com/ruvnet/agentic-flow
**Homepage**: https://agentdb.ruv.io

### Core Features

#### Vector Search (150x Faster)
```typescript
import { WASMVectorSearch, HNSWIndex } from 'agentdb';

// WASM-powered vector search
const vectorSearch = new WASMVectorSearch({
  dimensions: 384,
  metric: 'cosine'
});

// HNSW hierarchical search index
const hnsw = new HNSWIndex({
  dimensions: 384,
  maxElements: 10000,
  M: 16,
  efConstruction: 200,
  efSearch: 100
});
```

#### Memory Systems
```typescript
import {
  CausalMemoryGraph,  // Causal reasoning
  ReflexionMemory,    // Self-critique
  SkillLibrary,       // Pattern storage
  NightlyLearner      // Background learning
} from 'agentdb';

// Reflexion Memory - Self-critique and learning
const reflexion = new ReflexionMemory({
  database: db,
  vectorSearch: vectorSearch
});

await reflexion.reflect({
  experience: { state, action, result },
  critique: 'Analysis of what happened'
});

// Skill Library - Store successful patterns
const skills = new SkillLibrary({
  database: db,
  vectorSearch: vectorSearch
});

await skills.addSkill({
  name: 'Momentum Breakout',
  description: 'High momentum entry pattern',
  code: JSON.stringify(pattern),
  tags: ['momentum', 'breakout'],
  metadata: { successRate: 0.75 }
});
```

#### Reinforcement Learning
```typescript
import { LearningSystem } from 'agentdb';

// 9 RL Algorithms Available:
// - decision_transformer
// - q_learning
// - sarsa
// - actor_critic
// - double_q
// - dqn
// - ppo
// - a3c
// - td3

const learner = new LearningSystem({
  algorithm: 'decision_transformer',
  stateSize: 50,
  actionSize: 3,
  learningRate: 0.01
});

await learner.learn({
  state: stateVector,
  action: actionIndex,
  reward: profitLoss,
  nextState: nextStateVector,
  done: true
});
```

#### Database Operations
```typescript
import { createDatabase, BatchOperations } from 'agentdb';

const db = await createDatabase({
  path: './data/trading.db',
  memory: false
});

// Batch operations for performance
const batch = new BatchOperations(db);
await batch.insertBatch('trades', tradesArray);
```

## 🔬 Lean-Agentic v0.3.2

**Package**: `lean-agentic@0.3.2`
**Repository**: https://github.com/agenticsorg/lean-agentic
**Homepage**: https://ruv.io

### Core Features

#### Theorem Proving
```typescript
import { LeanProver } from 'lean-agentic/node';

const prover = await LeanProver.create({
  hashConsing: true,      // 150x performance boost
  enableSignatures: true  // Ed25519 attestation
});

// Prove strategy safety properties
const proposition = `
  theorem strategy_safety (s : Strategy) :
    (∀ trade : Trade, profit trade ≥ -maxLoss) →
    safe_strategy s
`;

const proof = await prover.prove(proposition);

if (proof.success) {
  // Get cryptographic signature
  const signature = await prover.signProof(proof.term);
  console.log('Strategy formally verified:', signature);
}
```

#### Episodic Memory
```typescript
// Lean-Agentic integrates with AgentDB for memory
import { LeanProver } from 'lean-agentic/node';
import { EmbeddingService } from 'agentdb';

// Store proof episodes
await episodicMemory.store({
  proof: proof.term,
  context: strategyContext,
  timestamp: Date.now()
});
```

#### MCP Integration
```typescript
// Claude Code MCP server support
import { MCPServer } from 'lean-agentic/mcp';

const mcpServer = new MCPServer({
  port: 3001
});

await mcpServer.start();
```

## ⏱️ Midstreamer v0.2.3

**Package**: `midstreamer@0.2.3`
**Repository**: https://github.com/midstream/midstream
**License**: MIT

### Core Features

#### Temporal Analysis
```typescript
import { TemporalCompare } from 'midstreamer';

const temporal = new TemporalCompare(100); // 100-point window

// Dynamic Time Warping - Find similar patterns
const seq1 = new Float64Array([1, 2, 3, 4, 5]);
const seq2 = new Float64Array([1, 3, 2, 4, 5]);
const distance = temporal.dtw(seq1, seq2);

// Longest Common Subsequence
const lcsLength = temporal.lcs(seq1, seq2);
```

#### Nanosecond Scheduling
```typescript
import { NanoScheduler } from 'midstreamer';

const scheduler = new NanoScheduler();

// Schedule with nanosecond precision
const taskId = scheduler.schedule(() => {
  console.log('High-precision task executed');
}, 1_000_000); // 1ms in nanoseconds

// Repeating tasks
const repeatId = scheduler.schedule_repeating(() => {
  console.log('Repeating task');
}, 5_000_000); // 5ms interval

// Process tasks (call from event loop)
scheduler.tick();

// Cancel tasks
scheduler.cancel(taskId);
```

#### Meta-Learning with Strange Loop
```typescript
import { StrangeLoop } from 'midstreamer';

// Self-reflective meta-learning
const metaLearner = new StrangeLoop(0.01); // learning rate

// Observe pattern performance
metaLearner.observe('pattern_momentum_1', 0.75);
metaLearner.observe('pattern_reversion_2', 0.82);
metaLearner.observe('pattern_sentiment_3', 0.68);

// Get confidence for specific pattern
const confidence = metaLearner.get_confidence('pattern_momentum_1');
console.log('Pattern confidence:', confidence);

// Get best performing pattern
const bestPattern = metaLearner.best_pattern();
console.log('Best:', bestPattern.pattern_id, bestPattern.confidence);

// Meta-cognition: reflect on learning
const reflection = metaLearner.reflect();
console.log('Learning progress:', reflection);
```

#### Multi-stream QUIC
```typescript
import { QuicMultistream } from 'midstreamer';

const multistream = new QuicMultistream();

// Open prioritized streams
const highPriorityStream = multistream.open_stream(10);
const lowPriorityStream = multistream.open_stream(1);

// Send data
const data = new Uint8Array([1, 2, 3, 4]);
multistream.send(highPriorityStream, data);

// Receive data
const received = multistream.receive(highPriorityStream, 1024);

// Get stream statistics
const stats = multistream.get_stats(highPriorityStream);
console.log('Stream stats:', stats);

// Close stream
multistream.close_stream(highPriorityStream);
```

## 🔗 Integration Example

```typescript
import {
  WASMVectorSearch,
  HNSWIndex,
  ReflexionMemory,
  SkillLibrary,
  LearningSystem
} from 'agentdb';

import { LeanProver } from 'lean-agentic/node';

import {
  TemporalCompare,
  NanoScheduler,
  StrangeLoop
} from 'midstreamer';

class IntegratedTradingSystem {
  private vectorSearch: WASMVectorSearch;
  private hnsw: HNSWIndex;
  private reflexion: ReflexionMemory;
  private skills: SkillLibrary;
  private learner: LearningSystem;
  private prover: LeanProver;
  private temporal: TemporalCompare;
  private scheduler: NanoScheduler;
  private metaLearner: StrangeLoop;

  async initialize() {
    // AgentDB components
    this.vectorSearch = new WASMVectorSearch({ dimensions: 384 });
    this.hnsw = new HNSWIndex({ dimensions: 384, maxElements: 10000 });
    this.reflexion = new ReflexionMemory({ vectorSearch: this.vectorSearch });
    this.skills = new SkillLibrary({ vectorSearch: this.vectorSearch });
    this.learner = new LearningSystem({ algorithm: 'decision_transformer' });

    // Lean-Agentic components
    this.prover = await LeanProver.create({ hashConsing: true });

    // Midstreamer components
    this.temporal = new TemporalCompare(100);
    this.scheduler = new NanoScheduler();
    this.metaLearner = new StrangeLoop(0.01);

    console.log('✅ All libraries integrated');
  }

  async analyzeTrade(marketData: any) {
    // 1. Find similar patterns (AgentDB)
    const embedding = await this.vectorSearch.embed(JSON.stringify(marketData));
    const similar = this.hnsw.search(embedding, 5);

    // 2. Compare temporal similarity (Midstreamer)
    const dtw = this.temporal.dtw(
      new Float64Array(marketData.prices),
      new Float64Array(similar[0].prices)
    );

    // 3. Verify strategy safety (Lean-Agentic)
    const verification = await this.prover.prove(strategyProposition);

    // 4. Learn from outcome (AgentDB + Midstreamer)
    await this.learner.learn({ state, action, reward, nextState });
    this.metaLearner.observe(patternId, performance);

    // 5. Self-critique (AgentDB)
    await this.reflexion.reflect({ experience, critique });
  }
}
```

## 📊 Performance Characteristics

| Feature | Library | Performance |
|---------|---------|-------------|
| Vector Search | AgentDB | 150x faster with WASM |
| Pattern Matching | Midstreamer | Native WASM DTW/LCS |
| Scheduling | Midstreamer | Nanosecond precision |
| Theorem Proving | Lean-Agentic | 150x faster with hash-consing |
| Memory Storage | AgentDB | SQLite-based persistence |
| Meta-Learning | Midstreamer | Self-reflective Strange Loop |

## 🔗 External Resources

- **AgentDB Docs**: https://agentdb.ruv.io/docs
- **Lean-Agentic Examples**: https://github.com/agenticsorg/lean-agentic/tree/main/examples
- **Midstreamer Repository**: https://github.com/midstream/midstream

---

**Last Updated**: 2025-10-28
**Libraries Version**: AgentDB 1.6.1, Lean-Agentic 0.3.2, Midstreamer 0.2.3
