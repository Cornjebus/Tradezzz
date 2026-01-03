import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NeonDatabase } from '../database/NeonDatabase';
import { SwarmMemoryService } from './SwarmMemoryService';

function createStubDb(): NeonDatabase {
  const db: any = {
    trades: {
      findByUserId: vi.fn(),
    },
  };
  return db as NeonDatabase;
}

describe('SwarmMemoryService', () => {
  let db: NeonDatabase;
  let service: SwarmMemoryService;

  beforeEach(() => {
    db = createStubDb();
    service = new SwarmMemoryService(db);
  });

  it('returns empty summary when no trades exist', async () => {
    (db.trades.findByUserId as any).mockResolvedValue([]);

    const summary = await service.getAgentSummary('user-1');

    expect(summary.totalTrades).toBe(0);
    expect(summary.agents).toEqual([]);
  });

  it('aggregates trades by agentId and sorts by cumulative pnl', async () => {
    (db.trades.findByUserId as any).mockResolvedValue([
      { id: 't1', pnl: 10, metadata: { agentId: 'agent-a' } },
      { id: 't2', pnl: -5, metadata: { agentId: 'agent-b' } },
      { id: 't3', pnl: 20, metadata: { agentId: 'agent-a' } },
      { id: 't4', pnl: 5 }, // no metadata -> default-agent
    ]);

    const summary = await service.getAgentSummary('user-1');

    expect(summary.totalTrades).toBe(4);
    expect(summary.agents.length).toBe(3);

    const top = summary.agents[0];
    expect(top.agentId).toBe('agent-a');
    expect(top.cumulativePnl).toBe(30);
    expect(top.trades).toBe(2);
  });
});

