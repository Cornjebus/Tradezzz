import type { NeonDatabase } from '../database/NeonDatabase';

export interface AgentPerformanceSummary {
  agentId: string;
  trades: number;
  cumulativePnl: number;
  averagePnlPerTrade: number;
}

export interface SwarmSummary {
  agents: AgentPerformanceSummary[];
  totalTrades: number;
}

/**
 * SwarmMemoryService
 *
 * First iteration: computes per-agent performance summaries using
 * Neon trades table and a simple convention that stores agentId in
 * trades.trades JSON metadata (when present). Later phases can
 * mirror this into RuVector for graph-based weighting.
 */
export class SwarmMemoryService {
  private readonly db: NeonDatabase;

  constructor(db: NeonDatabase) {
    this.db = db;
  }

  async getAgentSummary(userId: string): Promise<SwarmSummary> {
    // For now, use all live trades; in future we can filter by metadata.
    const trades = await this.db.trades.findByUserId(userId, { mode: 'live' });

    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        agents: [],
        totalTrades: 0,
      };
    }

    const byAgent: Record<string, { trades: number; pnl: number }> = {};

    for (const trade of trades as any[]) {
      // Default to a synthetic agent id when not captured explicitly.
      const agentId = (trade.metadata && trade.metadata.agentId) || 'default-agent';
      const pnl = typeof trade.pnl === 'number' ? trade.pnl : 0;

      if (!byAgent[agentId]) {
        byAgent[agentId] = { trades: 0, pnl: 0 };
      }
      byAgent[agentId].trades += 1;
      byAgent[agentId].pnl += pnl;
    }

    const agents: AgentPerformanceSummary[] = Object.entries(byAgent).map(
      ([agentId, stats]) => ({
        agentId,
        trades: stats.trades,
        cumulativePnl: stats.pnl,
        averagePnlPerTrade:
          stats.trades > 0 ? stats.pnl / stats.trades : 0,
      }),
    );

    // Sort by cumulative PnL descending
    agents.sort((a, b) => b.cumulativePnl - a.cumulativePnl);

    return {
      agents,
      totalTrades: trades.length,
    };
  }
}

