export type AgentRole = 'trader' | 'risk' | 'analysis' | 'orchestrator';

export interface AgentAction {
  id: string;
  agentId: string;
  role: AgentRole;
  type: 'order' | 'alert' | 'noop';
  symbol?: string;
  side?: 'buy' | 'sell';
  confidence?: number;
  size?: number;
  reason?: string;
}

export interface AgentContext {
  timestamp: number;
  mode: 'paper' | 'live';
  portfolioValue?: number;
}

export interface Agent {
  id: string;
  role: AgentRole;
  decide(context: AgentContext): AgentAction | null | Promise<AgentAction | null>;
}

export interface CoordinatedDecision {
  actions: AgentAction[];
  conflicts: {
    symbol: string;
    sides: Set<'buy' | 'sell'>;
    agents: string[];
  }[];
}

export class SwarmCoordinator {
  private agents: Map<string, Agent> = new Map();

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  async coordinate(context: AgentContext): Promise<CoordinatedDecision> {
    const rawActions: AgentAction[] = [];

    for (const agent of this.agents.values()) {
      const result = await agent.decide(context);
      if (result && result.type !== 'noop') {
        rawActions.push(result);
      }
    }

    const conflicts = this.detectConflicts(rawActions);
    const resolved = this.resolveConflicts(rawActions, conflicts);

    return {
      actions: resolved,
      conflicts,
    };
  }

  private detectConflicts(actions: AgentAction[]): CoordinatedDecision['conflicts'] {
    const bySymbol: Record<string, { sides: Set<'buy' | 'sell'>; agents: Set<string> }> = {};

    for (const action of actions) {
      if (!action.symbol || !action.side) continue;
      const key = action.symbol;
      if (!bySymbol[key]) {
        bySymbol[key] = { sides: new Set(), agents: new Set() };
      }
      bySymbol[key].sides.add(action.side);
      bySymbol[key].agents.add(action.agentId);
    }

    const conflicts: CoordinatedDecision['conflicts'] = [];
    for (const [symbol, info] of Object.entries(bySymbol)) {
      if (info.sides.size > 1) {
        conflicts.push({
          symbol,
          sides: info.sides,
          agents: Array.from(info.agents),
        });
      }
    }

    return conflicts;
  }

  private resolveConflicts(actions: AgentAction[], conflicts: CoordinatedDecision['conflicts']): AgentAction[] {
    if (conflicts.length === 0) return actions;

    const conflictSymbols = new Set(conflicts.map((c) => c.symbol));

    // Simple policy: for symbols with conflicting sides, keep only the highest-confidence action.
    const bySymbol: Record<string, AgentAction[]> = {};
    for (const action of actions) {
      if (!action.symbol) continue;
      const key = action.symbol;
      if (!bySymbol[key]) bySymbol[key] = [];
      bySymbol[key].push(action);
    }

    const result: AgentAction[] = [];
    for (const action of actions) {
      if (!action.symbol || !conflictSymbols.has(action.symbol)) {
        result.push(action);
        continue;
      }

      const group = bySymbol[action.symbol];
      const best = group.reduce((acc, curr) => {
        const accConf = acc.confidence ?? 0;
        const currConf = curr.confidence ?? 0;
        return currConf > accConf ? curr : acc;
      }, group[0]);

      if (action.id === best.id) {
        result.push(action);
      }
    }

    return result;
  }
}

