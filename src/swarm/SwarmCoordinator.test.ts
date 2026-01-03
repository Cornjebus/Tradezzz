import { describe, it, expect } from 'vitest';
import { SwarmCoordinator, Agent, AgentContext, AgentAction } from './SwarmCoordinator';

class FixedAgent implements Agent {
  id: string;
  role: any;
  private action: AgentAction | null;

  constructor(id: string, action: AgentAction | null) {
    this.id = id;
    this.role = 'trader';
    this.action = action;
  }

  async decide(_context: AgentContext): Promise<AgentAction | null> {
    return this.action;
  }
}

describe('SwarmCoordinator', () => {
  it('aggregates actions from multiple agents', async () => {
    const coordinator = new SwarmCoordinator();

    coordinator.registerAgent(
      new FixedAgent('a1', {
        id: 'act-1',
        agentId: 'a1',
        role: 'trader',
        type: 'order',
        symbol: 'BTC/USDT',
        side: 'buy',
        confidence: 0.8,
        size: 0.1,
      }),
    );

    coordinator.registerAgent(
      new FixedAgent('a2', {
        id: 'act-2',
        agentId: 'a2',
        role: 'trader',
        type: 'order',
        symbol: 'ETH/USDT',
        side: 'sell',
        confidence: 0.7,
        size: 1,
      }),
    );

    const result = await coordinator.coordinate({
      timestamp: Date.now(),
      mode: 'paper',
    });

    expect(result.actions.length).toBe(2);
    expect(result.conflicts.length).toBe(0);
  });

  it('detects and resolves conflicting actions on the same symbol', async () => {
    const coordinator = new SwarmCoordinator();

    coordinator.registerAgent(
      new FixedAgent('a1', {
        id: 'act-1',
        agentId: 'a1',
        role: 'trader',
        type: 'order',
        symbol: 'BTC/USDT',
        side: 'buy',
        confidence: 0.9,
        size: 0.1,
      }),
    );

    coordinator.registerAgent(
      new FixedAgent('a2', {
        id: 'act-2',
        agentId: 'a2',
        role: 'trader',
        type: 'order',
        symbol: 'BTC/USDT',
        side: 'sell',
        confidence: 0.6,
        size: 0.1,
      }),
    );

    const result = await coordinator.coordinate({
      timestamp: Date.now(),
      mode: 'paper',
    });

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].symbol).toBe('BTC/USDT');
    // Only the higher-confidence action should remain
    expect(result.actions.length).toBe(1);
    expect(result.actions[0].id).toBe('act-1');
  });
});

