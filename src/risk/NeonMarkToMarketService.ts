import type { NeonDatabase, Position, ExchangeConnection } from '../database/NeonDatabase';
import type { NeonExchangeAdapterService } from '../exchanges/NeonExchangeAdapterService';

export interface MarkToMarketResult {
  updatedPositions: number;
  totalUnrealizedPnl: number;
  lastMarkedAt: Date | null;
}

export class NeonMarkToMarketService {
  private db: NeonDatabase;
  private exchangeService: NeonExchangeAdapterService;

  constructor(db: NeonDatabase, exchangeService: NeonExchangeAdapterService) {
    this.db = db;
    this.exchangeService = exchangeService;
  }

  /**
   * Mark all open positions to market for a user.
   *
   * For now we:
   * - Focus on live positions (mode === 'live')
   * - Use the user's default exchange if configured, otherwise the first
   *   available exchange connection
   * - Update current_price and unrealized_pnl on each open position
   */
  async markToMarket(userId: string, options?: { mode?: 'live' | 'paper' | 'both' }): Promise<MarkToMarketResult> {
    const mode = options?.mode ?? 'live';

    const openPositions = await this.db.positions.findOpen(userId);
    let positions: Position[] = openPositions as Position[];

    if (mode === 'live') {
      positions = positions.filter((p) => p.mode === 'live');
    } else if (mode === 'paper') {
      positions = positions.filter((p) => p.mode === 'paper');
    }

    if (positions.length === 0) {
      return {
        updatedPositions: 0,
        totalUnrealizedPnl: 0,
        lastMarkedAt: null,
      };
    }

    const connections = await this.db.exchangeConnections.findByUserId(userId);
    if (!connections || connections.length === 0) {
      throw new Error('No exchange connections available for mark-to-market');
    }

    const connection = await this.pickConnection(connections as ExchangeConnection[], userId);

    let totalUnrealizedPnl = 0;
    let lastMarkedAt: Date | null = null;

    for (const pos of positions) {
      const ticker = await this.exchangeService.getTicker(connection.id, userId, pos.symbol);
      const currentPrice = ticker.last;

      const entryPrice = Number((pos as any).entry_price ?? pos.entry_price);
      const quantity = Number((pos as any).quantity ?? pos.quantity);

      if (!Number.isFinite(entryPrice) || !Number.isFinite(quantity)) {
        // Skip invalid numeric data rather than failing the whole run
        // eslint-disable-next-line no-continue
        continue;
      }

      const isLong = pos.side === 'long';
      const unrealizedPnl = isLong
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;

      const updated = await this.db.positions.update(pos.id, {
        currentPrice,
        unrealizedPnl,
      } as any);

      totalUnrealizedPnl += unrealizedPnl;

      const updatedAt = new Date((updated as any).updated_at || Date.now());
      if (!lastMarkedAt || updatedAt > lastMarkedAt) {
        lastMarkedAt = updatedAt;
      }
    }

    return {
      updatedPositions: positions.length,
      totalUnrealizedPnl,
      lastMarkedAt,
    };
  }

  private async pickConnection(connections: ExchangeConnection[], userId: string): Promise<ExchangeConnection> {
    // Use default exchange from user settings if configured, otherwise the
    // first available connection.
    try {
      const settings = await this.db.userSettings.findByUserId(userId);
      const preferredId = (settings as any)?.default_exchange as string | undefined;

      if (preferredId) {
        const byId = connections.find((c) => c.id === preferredId);
        if (byId) return byId;
        const byName = connections.find((c) => c.exchange === preferredId);
        if (byName) return byName;
      }
    } catch {
      // If settings are unavailable, fall back to first connection.
    }

    return connections[0];
  }
}

