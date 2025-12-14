# Agent Implementation - Phase 3

## 🎯 Overview

This plan covers the implementation of intelligent trading agents using GOAP (Goal-Oriented Action Planning), SAFLA (Self-Aware Feedback Loop Algorithm), and multi-agent coordination.

**Timeline**: Week 3
**Dependencies**: Phase 2 (Core System) must be completed
**Deliverables**: Intelligent agents with learning capabilities

## 📋 Implementation Checklist

- [ ] GOAP planner implementation
- [ ] SAFLA learning system
- [ ] Trading agent framework
- [ ] Risk management agent
- [ ] Portfolio optimization agent
- [ ] Multi-agent coordination
- [ ] Agent communication protocol
- [ ] Learning from feedback

## 🏗️ Core Components

### 1. GOAP Planner

**File**: `src/agents/GOAPPlanner.ts`

```typescript
import { AgentDB } from 'agentdb';

export interface Goal {
  name: string;
  conditions: Record<string, any>;
  priority: number;
}

export interface Action {
  name: string;
  cost: number;
  preconditions: Record<string, any>;
  effects: Record<string, any>;
  execute: (state: State) => Promise<State>;
}

export interface State {
  portfolio: Record<string, number>;
  cash: number;
  positions: Position[];
  market: MarketState;
  timestamp: number;
  [key: string]: any;
}

export class GOAPPlanner {
  private actions: Action[];
  private db: AgentDB;

  constructor(db: AgentDB) {
    this.db = db;
    this.actions = [];
  }

  registerAction(action: Action): void {
    this.actions.push(action);
    console.log(`✅ Registered GOAP action: ${action.name}`);
  }

  async createPlan(goal: Goal, currentState: State): Promise<Action[]> {
    console.log(`🎯 Planning for goal: ${goal.name}`);

    // A* search for optimal action sequence
    const openList: PlanNode[] = [{
      state: currentState,
      path: [],
      cost: 0,
      heuristic: this.calculateHeuristic(currentState, goal)
    }];

    const closedList = new Set<string>();
    let iterations = 0;
    const maxIterations = 1000;

    while (openList.length > 0 && iterations < maxIterations) {
      iterations++;

      // Get node with lowest f-cost (cost + heuristic)
      openList.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
      const current = openList.shift()!;

      // Check if goal is reached
      if (this.goalReached(current.state, goal)) {
        console.log(`✅ Plan found with ${current.path.length} actions`);
        await this.storePlan(goal, current.path);
        return current.path;
      }

      const stateHash = this.hashState(current.state);
      if (closedList.has(stateHash)) continue;
      closedList.add(stateHash);

      // Explore valid actions
      for (const action of this.getValidActions(current.state)) {
        const newState = await this.applyActionEffects(current.state, action);
        const newCost = current.cost + action.cost;
        const heuristic = this.calculateHeuristic(newState, goal);

        openList.push({
          state: newState,
          path: [...current.path, action],
          cost: newCost,
          heuristic
        });
      }
    }

    console.warn(`⚠️ No plan found for goal: ${goal.name}`);
    return [];
  }

  private getValidActions(state: State): Action[] {
    return this.actions.filter(action =>
      this.preconditionsMet(action.preconditions, state)
    );
  }

  private preconditionsMet(preconditions: Record<string, any>, state: State): boolean {
    for (const [key, value] of Object.entries(preconditions)) {
      if (typeof value === 'function') {
        if (!value(state[key], state)) return false;
      } else {
        if (state[key] !== value) return false;
      }
    }
    return true;
  }

  private applyActionEffects(state: State, action: Action): State {
    const newState = { ...state };
    for (const [key, value] of Object.entries(action.effects)) {
      if (typeof value === 'function') {
        newState[key] = value(newState[key], newState);
      } else {
        newState[key] = value;
      }
    }
    return newState;
  }

  private goalReached(state: State, goal: Goal): boolean {
    for (const [key, value] of Object.entries(goal.conditions)) {
      if (typeof value === 'function') {
        if (!value(state[key], state)) return false;
      } else {
        if (state[key] !== value) return false;
      }
    }
    return true;
  }

  private calculateHeuristic(state: State, goal: Goal): number {
    // Simple heuristic: count unmet goal conditions
    let unmetConditions = 0;
    for (const [key, value] of Object.entries(goal.conditions)) {
      if (typeof value === 'function') {
        if (!value(state[key], state)) unmetConditions++;
      } else {
        if (state[key] !== value) unmetConditions++;
      }
    }
    return unmetConditions;
  }

  private hashState(state: State): string {
    // Create deterministic hash of relevant state properties
    const relevant = {
      cash: state.cash,
      positions: state.positions.map(p => `${p.symbol}:${p.quantity}`).sort()
    };
    return JSON.stringify(relevant);
  }

  private async storePlan(goal: Goal, actions: Action[]): Promise<void> {
    await this.db.insert({
      collection: 'goap_plans',
      data: {
        goal: goal.name,
        actions: actions.map(a => a.name),
        timestamp: Date.now(),
        success: true
      }
    });
  }

  async executePlan(plan: Action[], state: State): Promise<State> {
    let currentState = state;

    for (const action of plan) {
      console.log(`🔄 Executing action: ${action.name}`);

      try {
        currentState = await action.execute(currentState);
        await this.recordActionExecution(action, true);
      } catch (error) {
        console.error(`❌ Action failed: ${action.name}`, error);
        await this.recordActionExecution(action, false);
        throw error;
      }
    }

    return currentState;
  }

  private async recordActionExecution(action: Action, success: boolean): Promise<void> {
    await this.db.insert({
      collection: 'action_executions',
      data: {
        action: action.name,
        success,
        timestamp: Date.now()
      }
    });
  }
}

interface PlanNode {
  state: State;
  path: Action[];
  cost: number;
  heuristic: number;
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
}

interface MarketState {
  prices: Record<string, number>;
  volumes: Record<string, number>;
  timestamp: number;
}
```

### 2. SAFLA Learning System

**File**: `src/agents/SAFLALearning.ts`

```typescript
import { AgentDB } from 'agentdb';

export interface Feedback {
  actionId: string;
  outcome: 'success' | 'failure';
  reward: number;
  state: any;
  metrics: {
    profitLoss: number;
    sharpeRatio?: number;
    drawdown?: number;
  };
}

export interface Pattern {
  id: string;
  type: string;
  conditions: any;
  actions: string[];
  successRate: number;
  avgReward: number;
  usageCount: number;
}

export class SAFLALearning {
  private db: AgentDB;
  private learningRate: number = 0.1;
  private explorationRate: number = 0.2;
  private patterns: Map<string, Pattern> = new Map();

  constructor(db: AgentDB) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    console.log('🧠 Initializing SAFLA learning system...');

    // Load existing patterns from AgentDB
    await this.loadPatterns();

    console.log(`✅ Loaded ${this.patterns.size} learned patterns`);
  }

  async processFeedback(feedback: Feedback): Promise<void> {
    console.log(`📊 Processing feedback for action: ${feedback.actionId}`);

    // 1. Update action value estimates
    await this.updateActionValue(feedback);

    // 2. Identify and store successful patterns
    if (feedback.outcome === 'success' && feedback.reward > 0) {
      await this.storePattern(feedback);
    }

    // 3. Adapt strategy based on performance
    await this.adaptStrategy(feedback);

    // 4. Update neural embeddings for similar situations
    await this.updateSimilarPatterns(feedback);
  }

  private async updateActionValue(feedback: Feedback): Promise<void> {
    const existingValue = await this.db.query({
      collection: 'action_values',
      filter: { actionId: feedback.actionId }
    });

    let newValue: number;
    if (existingValue.length > 0) {
      const oldValue = existingValue[0].value;
      // Q-learning style update
      newValue = oldValue + this.learningRate * (feedback.reward - oldValue);
    } else {
      newValue = feedback.reward;
    }

    await this.db.upsert({
      collection: 'action_values',
      data: {
        actionId: feedback.actionId,
        value: newValue,
        updateCount: (existingValue[0]?.updateCount || 0) + 1,
        lastUpdated: Date.now()
      }
    });
  }

  private async storePattern(feedback: Feedback): Promise<void> {
    const patternId = this.generatePatternId(feedback.state);

    // Create pattern embedding for similarity search
    const embedding = await this.db.embed(JSON.stringify({
      state: feedback.state,
      action: feedback.actionId,
      outcome: feedback.outcome
    }));

    await this.db.insert({
      collection: 'learned_patterns',
      data: {
        id: patternId,
        type: 'trading_pattern',
        state: feedback.state,
        action: feedback.actionId,
        reward: feedback.reward,
        successRate: 1.0,
        usageCount: 1,
        timestamp: Date.now()
      },
      vector: embedding
    });
  }

  private async adaptStrategy(feedback: Feedback): Promise<void> {
    // Adjust exploration vs exploitation
    if (feedback.outcome === 'failure') {
      this.explorationRate = Math.min(0.5, this.explorationRate * 1.1);
    } else {
      this.explorationRate = Math.max(0.05, this.explorationRate * 0.95);
    }

    // Adjust learning rate based on consistency
    const recentFeedback = await this.getRecentFeedback(10);
    const consistency = this.calculateConsistency(recentFeedback);

    if (consistency < 0.5) {
      this.learningRate = Math.min(0.3, this.learningRate * 1.2);
    } else {
      this.learningRate = Math.max(0.01, this.learningRate * 0.95);
    }

    console.log(`🎯 Adapted: exploration=${this.explorationRate.toFixed(3)}, learning=${this.learningRate.toFixed(3)}`);
  }

  private async updateSimilarPatterns(feedback: Feedback): Promise<void> {
    // Find similar historical patterns using vector search
    const queryEmbedding = await this.db.embed(JSON.stringify(feedback.state));

    const similarPatterns = await this.db.vectorSearch({
      collection: 'learned_patterns',
      vector: queryEmbedding,
      topK: 5,
      includeDistance: true
    });

    // Update similar patterns with partial credit/penalty
    for (const pattern of similarPatterns) {
      if (pattern.distance < 0.3) { // High similarity
        const updateWeight = 1 - pattern.distance;
        await this.updatePatternValue(pattern.id, feedback.reward * updateWeight);
      }
    }
  }

  async selectAction(state: any, availableActions: string[]): Promise<string> {
    // Epsilon-greedy action selection
    if (Math.random() < this.explorationRate) {
      // Explore: random action
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Exploit: best known action
    const bestAction = await this.getBestAction(state, availableActions);
    return bestAction || availableActions[0];
  }

  private async getBestAction(state: any, availableActions: string[]): Promise<string | null> {
    let bestAction: string | null = null;
    let bestValue = -Infinity;

    for (const action of availableActions) {
      const value = await this.getActionValue(action, state);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  private async getActionValue(action: string, state: any): Promise<number> {
    // Get value from AgentDB
    const results = await this.db.query({
      collection: 'action_values',
      filter: { actionId: action }
    });

    if (results.length > 0) {
      return results[0].value;
    }

    // Try to find similar state-action pairs using vector search
    const embedding = await this.db.embed(JSON.stringify({ state, action }));
    const similar = await this.db.vectorSearch({
      collection: 'learned_patterns',
      vector: embedding,
      topK: 1,
      includeDistance: true
    });

    if (similar.length > 0 && similar[0].distance < 0.2) {
      return similar[0].reward;
    }

    return 0; // Default value for unknown actions
  }

  private async loadPatterns(): Promise<void> {
    const patterns = await this.db.query({
      collection: 'learned_patterns',
      filter: {}
    });

    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern as Pattern);
    }
  }

  private async getRecentFeedback(count: number): Promise<Feedback[]> {
    const results = await this.db.query({
      collection: 'feedback_history',
      filter: {},
      sort: { timestamp: -1 },
      limit: count
    });

    return results as Feedback[];
  }

  private calculateConsistency(feedbacks: Feedback[]): number {
    if (feedbacks.length === 0) return 0.5;

    const successCount = feedbacks.filter(f => f.outcome === 'success').length;
    return successCount / feedbacks.length;
  }

  private generatePatternId(state: any): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async updatePatternValue(patternId: string, rewardDelta: number): Promise<void> {
    const pattern = await this.db.query({
      collection: 'learned_patterns',
      filter: { id: patternId }
    });

    if (pattern.length > 0) {
      const current = pattern[0];
      const newReward = current.reward + this.learningRate * rewardDelta;

      await this.db.update({
        collection: 'learned_patterns',
        filter: { id: patternId },
        data: {
          reward: newReward,
          lastUpdated: Date.now()
        }
      });
    }
  }

  getMetrics(): SAFLAMetrics {
    return {
      learningRate: this.learningRate,
      explorationRate: this.explorationRate,
      patternCount: this.patterns.size,
      avgSuccessRate: this.calculateAvgSuccessRate()
    };
  }

  private calculateAvgSuccessRate(): number {
    if (this.patterns.size === 0) return 0;

    let totalSuccessRate = 0;
    for (const pattern of this.patterns.values()) {
      totalSuccessRate += pattern.successRate;
    }

    return totalSuccessRate / this.patterns.size;
  }
}

interface SAFLAMetrics {
  learningRate: number;
  explorationRate: number;
  patternCount: number;
  avgSuccessRate: number;
}
```

### 3. Trading Agent Framework

**File**: `src/agents/TradingAgent.ts`

```typescript
import { AgentDB } from 'agentdb';
import { GOAPPlanner, Goal, State } from './GOAPPlanner';
import { SAFLALearning, Feedback } from './SAFLALearning';
import { EventEmitter } from 'events';

export interface AgentConfig {
  name: string;
  type: 'momentum' | 'meanReversion' | 'sentiment' | 'multi';
  riskTolerance: number;
  learningEnabled: boolean;
}

export class TradingAgent extends EventEmitter {
  private db: AgentDB;
  private goap: GOAPPlanner;
  private safla: SAFLALearning;
  private config: AgentConfig;
  private currentGoal: Goal | null = null;

  constructor(db: AgentDB, config: AgentConfig) {
    super();
    this.db = db;
    this.config = config;
    this.goap = new GOAPPlanner(db);
    this.safla = new SAFLALearning(db);
  }

  async initialize(): Promise<void> {
    console.log(`🤖 Initializing agent: ${this.config.name}`);

    // Initialize SAFLA learning
    if (this.config.learningEnabled) {
      await this.safla.initialize();
    }

    // Register GOAP actions
    this.registerGOAPActions();

    console.log(`✅ Agent ${this.config.name} initialized`);
  }

  private registerGOAPActions(): void {
    // Buy action
    this.goap.registerAction({
      name: 'buy',
      cost: 1,
      preconditions: {
        cash: (val: number) => val > 0,
        signal: 'bullish'
      },
      effects: {
        hasPosition: true,
        cash: (val: number, state: State) => val - (state.market.prices['AAPL'] * 100)
      },
      execute: async (state: State) => {
        // Execute buy order
        this.emit('order', {
          type: 'buy',
          symbol: 'AAPL',
          quantity: 100,
          price: state.market.prices['AAPL']
        });
        return state;
      }
    });

    // Sell action
    this.goap.registerAction({
      name: 'sell',
      cost: 1,
      preconditions: {
        hasPosition: true
      },
      effects: {
        hasPosition: false,
        cash: (val: number, state: State) => val + (state.market.prices['AAPL'] * 100)
      },
      execute: async (state: State) => {
        // Execute sell order
        this.emit('order', {
          type: 'sell',
          symbol: 'AAPL',
          quantity: 100,
          price: state.market.prices['AAPL']
        });
        return state;
      }
    });

    // Wait action (do nothing)
    this.goap.registerAction({
      name: 'wait',
      cost: 0.1,
      preconditions: {},
      effects: {
        timestamp: (val: number) => val + 1000
      },
      execute: async (state: State) => {
        return { ...state, timestamp: state.timestamp + 1000 };
      }
    });
  }

  async setGoal(goal: Goal): Promise<void> {
    this.currentGoal = goal;
    console.log(`🎯 Agent ${this.config.name} received goal: ${goal.name}`);
  }

  async tick(state: State): Promise<void> {
    if (!this.currentGoal) {
      console.warn(`⚠️ Agent ${this.config.name} has no goal`);
      return;
    }

    // Create plan using GOAP
    const plan = await this.goap.createPlan(this.currentGoal, state);

    if (plan.length === 0) {
      console.warn(`⚠️ No plan found for goal: ${this.currentGoal.name}`);
      return;
    }

    // Execute plan
    try {
      await this.goap.executePlan(plan, state);

      // Learn from success
      if (this.config.learningEnabled) {
        await this.safla.processFeedback({
          actionId: plan[0].name,
          outcome: 'success',
          reward: this.calculateReward(state),
          state,
          metrics: {
            profitLoss: this.calculatePnL(state)
          }
        });
      }
    } catch (error) {
      console.error(`❌ Plan execution failed:`, error);

      // Learn from failure
      if (this.config.learningEnabled) {
        await this.safla.processFeedback({
          actionId: plan[0].name,
          outcome: 'failure',
          reward: -1,
          state,
          metrics: {
            profitLoss: 0
          }
        });
      }
    }
  }

  private calculateReward(state: State): number {
    // Simple reward based on portfolio value change
    return this.calculatePnL(state) / 1000; // Normalize
  }

  private calculatePnL(state: State): number {
    let totalPnL = 0;
    for (const position of state.positions) {
      const currentPrice = state.market.prices[position.symbol] || 0;
      totalPnL += (currentPrice - position.entryPrice) * position.quantity;
    }
    return totalPnL;
  }

  getSAFLAMetrics(): any {
    return this.safla.getMetrics();
  }
}
```

## 🧪 Testing

```typescript
// tests/agents/TradingAgent.test.ts
import { TradingAgent } from '../../src/agents/TradingAgent';
import { AgentDB } from 'agentdb';

describe('TradingAgent', () => {
  let agent: TradingAgent;
  let db: AgentDB;

  beforeEach(async () => {
    db = new AgentDB({ path: ':memory:' });
    await db.connect();

    agent = new TradingAgent(db, {
      name: 'TestAgent',
      type: 'momentum',
      riskTolerance: 0.5,
      learningEnabled: true
    });

    await agent.initialize();
  });

  it('should create and execute plans', async () => {
    await agent.setGoal({
      name: 'maximize_profit',
      conditions: { profitTarget: 1000 },
      priority: 1
    });

    const state = {
      cash: 10000,
      positions: [],
      market: {
        prices: { 'AAPL': 150 },
        volumes: { 'AAPL': 1000000 },
        timestamp: Date.now()
      },
      portfolio: {},
      timestamp: Date.now()
    };

    await agent.tick(state);
    // Verify actions were taken
  });
});
```

## 🚀 Swarm Integration

```bash
# Deploy agent swarm
npx claude-flow swarm "build trading agents" \
  --strategy development \
  --mode hierarchical \
  --agents 6
```

## 📊 Success Metrics

- [ ] GOAP plans generated in < 100ms
- [ ] SAFLA learning improves win rate by 10%+
- [ ] Agent coordination latency < 50ms
- [ ] Pattern recognition accuracy > 80%
- [ ] 85% test coverage

---

**Version**: 1.0.0
**Last Updated**: 2025-10-28
