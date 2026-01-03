import type { NeonDatabase } from '../database/NeonDatabase';
import {
  SwarmCoordinator,
  Agent,
  AgentContext,
  AgentAction,
} from './SwarmCoordinator';

export class NeonSwarmService {
  private db: NeonDatabase;

  constructor(db: NeonDatabase) {
    this.db = db;
  }

  async preview(userId: string, mode: 'paper' | 'live' = 'paper') {
    const coordinator = new SwarmCoordinator();

    // Strategy agent: proposes a single trade idea based on the user's
    // first active, auto-execution strategy (if any).
    const strategyAgent: Agent = {
      id: 'strategy-agent',
      role: 'trader',
      decide: async (context: AgentContext): Promise<AgentAction | null> => {
        const strategies = await this.db.strategies.findByUserId(userId);
        const candidate = strategies.find(
          (s: any) => s.status === 'active' && (s.execution_mode || 'manual') === 'auto',
        );
        if (!candidate) return null;

        const cfg = candidate.config || {};
        const symbols = (cfg as any).symbols as string[] | undefined;
        const symbol = symbols && symbols.length > 0 ? symbols[0] : 'BTC/USDT';

        return {
          id: `strategy-${candidate.id}-${context.timestamp}`,
          agentId: 'strategy-agent',
          role: 'trader',
          type: 'order',
          symbol,
          side: 'buy',
          confidence: 0.75,
          size: 0.1,
          reason: `Auto strategy ${candidate.name} suggests entering ${symbol}`,
        };
      },
    };

    // Risk agent: emits alerts when exposure or open positions look high.
    const riskAgent: Agent = {
      id: 'risk-agent',
      role: 'risk',
      decide: async (_context: AgentContext): Promise<AgentAction | null> => {
        const positions = await this.db.positions.findOpen(userId);
        const openLive = positions.filter((p: any) => p.mode === 'live');

        if (openLive.length === 0) return null;

        return {
          id: `risk-${Date.now()}`,
          agentId: 'risk-agent',
          role: 'risk',
          type: 'alert',
          reason: `Risk agent sees ${openLive.length} open live positions; review exposure before adding more.`,
        };
      },
    };

    coordinator.registerAgent(strategyAgent);
    coordinator.registerAgent(riskAgent);

    const context: AgentContext = {
      timestamp: Date.now(),
      mode,
      portfolioValue: undefined,
    };

    return coordinator.coordinate(context);
  }
}

