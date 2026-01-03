import type { NeonDatabase } from '../database/NeonDatabase';
import type { RuVectorClient } from './RuVectorClient';

export interface GraphRiskFactor {
  label: string;
  severity: 'low' | 'medium' | 'high';
  detail?: string;
}

export interface GraphRiskSummary {
  score: number; // 0 (safe) -> 100 (very risky)
  factors: GraphRiskFactor[];
  openLivePositions: number;
  openLiveOrders: number;
  totalNotional: number;
}

/**
 * RiskGraphService
 *
 * First iteration: computes a deterministic, Neon-only graph-like risk
 * summary based on open live positions/orders and basic exposure metrics.
 * RuVector can be layered in later to incorporate cross-user and regime
 * patterns.
 */
export class RiskGraphService {
  private readonly db: NeonDatabase;
  private readonly client: RuVectorClient | null;

  constructor(db: NeonDatabase, client: RuVectorClient | null) {
    this.db = db;
    this.client = client;
  }

  async getGraphRisk(userId: string): Promise<GraphRiskSummary> {
    const openLiveOrders = await this.db.orders.findByUserId(userId, {
      status: 'pending',
      mode: 'live',
    });
    const openPositions = await this.db.positions.findOpen(userId);
    const livePositions = openPositions.filter((p: any) => p.mode === 'live');

    let totalNotional = 0;
    const exposureBySymbol: Record<string, number> = {};

    for (const pos of livePositions) {
      const price = (pos as any).current_price || pos.entry_price;
      const notional = Math.abs(Number(pos.quantity) * Number(price));
      totalNotional += notional;
      const key = pos.symbol;
      exposureBySymbol[key] = (exposureBySymbol[key] || 0) + notional;
    }

    const positionsCount = livePositions.length;
    const ordersCount = openLiveOrders.length;

    const factors: GraphRiskFactor[] = [];

    if (positionsCount === 0 && ordersCount === 0) {
      factors.push({
        label: 'No live exposure',
        severity: 'low',
        detail: 'No open live positions or pending live orders',
      });
      return {
        score: 5,
        factors,
        openLivePositions: 0,
        openLiveOrders: 0,
        totalNotional: 0,
      };
    }

    // Simple heuristics for initial scoring
    const distinctSymbols = Object.keys(exposureBySymbol).length;
    const largestSymbolNotional = Object.values(exposureBySymbol).reduce(
      (max, v) => (v > max ? v : max),
      0,
    );
    const concentration =
      totalNotional > 0 ? largestSymbolNotional / totalNotional : 0;

    if (concentration > 0.6) {
      factors.push({
        label: 'Concentrated exposure',
        severity: 'high',
        detail: 'More than 60% of notional in a single symbol',
      });
    } else if (concentration > 0.3) {
      factors.push({
        label: 'Moderate concentration',
        severity: 'medium',
        detail: 'More than 30% of notional in a single symbol',
      });
    } else {
      factors.push({
        label: 'Diversified exposure',
        severity: 'low',
        detail: `${distinctSymbols} symbols with relatively balanced notional`,
      });
    }

    if (ordersCount > 5) {
      factors.push({
        label: 'Many pending live orders',
        severity: 'medium',
        detail: `${ordersCount} open live orders`,
      });
    }

    // Base score from simple heuristics
    let score = 0;
    if (concentration > 0.6) score += 40;
    else if (concentration > 0.3) score += 20;

    if (ordersCount > 5) score += 10;
    if (positionsCount > 5) score += 10;

    // Clamp score to [0, 100]
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      factors,
      openLivePositions: positionsCount,
      openLiveOrders: ordersCount,
      totalNotional,
    };
  }
}

