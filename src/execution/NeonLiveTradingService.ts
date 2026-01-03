import type { NeonDatabase, Order as NeonOrder, Position as NeonPosition, Trade as NeonTrade } from '../database/NeonDatabase';

export interface LiveFillParams {
  orderId: string;
  price: number;
  feeRatePercent?: number;
}

export interface LiveFillResult {
  order: NeonOrder;
  position?: NeonPosition;
  trade: NeonTrade;
}

/**
 * NeonLiveTradingService
 *
 * Minimal live-execution helper for the Neon/Clerk stack. It:
 * - Fills pending Neon orders at a given price
 * - Updates or creates positions with basic long/short semantics
 * - Records trades with realized PnL for closed positions
 *
 * This service does not talk to exchanges directly; callers are expected
 * to provide the execution price (e.g., from an exchange adapter or a
 * deterministic simulator).
 */
export class NeonLiveTradingService {
  private db: NeonDatabase;

  constructor(db: NeonDatabase) {
    this.db = db;
  }

  async fillOrder(params: LiveFillParams): Promise<LiveFillResult> {
    const { orderId, price, feeRatePercent = 0.1 } = params;

    const order = await this.db.orders.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'pending') {
      throw new Error('Order is not pending');
    }

    const userId = order.user_id;
    const symbol = order.symbol;
    const mode = order.mode;

    const fee = order.quantity * price * (feeRatePercent / 100);

    const updatedOrder = await this.db.orders.update(order.id, {
      status: 'filled',
      filledPrice: price,
      filledQuantity: order.quantity,
      fee,
      filledAt: new Date(),
    });

    const positionResult = await this.updatePositionForFill(updatedOrder, price);

    const trade = await this.db.trades.create({
      userId,
      strategyId: order.strategy_id,
      orderId: updatedOrder.id,
      positionId: positionResult?.position?.id,
      symbol,
      side: order.side,
      quantity: order.quantity,
      price,
      fee,
      pnl: positionResult?.realizedPnl ?? 0,
      mode,
    });

    return {
      order: updatedOrder,
      position: positionResult?.position,
      trade,
    };
  }

  private async updatePositionForFill(
    order: NeonOrder,
    price: number,
  ): Promise<{ position: NeonPosition; realizedPnl: number } | undefined> {
    const userId = order.user_id;
    const symbol = order.symbol;
    const side = order.side;
    const quantity = order.quantity;
    const mode = order.mode;

    const openPositions = await this.db.positions.findOpen(userId, symbol);
    const existing = openPositions[0];

    // No existing position: open a new one
    if (!existing) {
      const pos = await this.db.positions.create({
        userId,
        strategyId: order.strategy_id,
        symbol,
        side: side === 'buy' ? 'long' : 'short',
        quantity,
        entryPrice: price,
        mode,
      });
      return { position: pos, realizedPnl: 0 };
    }

    // Existing position logic mirrors the in-memory OrderService semantics,
    // but operates against Neon positions.
    if (side === 'buy') {
      if (existing.side === 'long') {
        // Add to long position
        const totalCost =
          existing.entry_price * existing.quantity + price * quantity;
        const totalQty = existing.quantity + quantity;
        const newEntry = totalCost / totalQty;

        const pos = await this.db.positions.update(existing.id, {
          entryPrice: newEntry,
          quantity: totalQty,
        } as any);
        return { position: pos, realizedPnl: 0 };
      }

      // Reducing short position
      if (quantity >= existing.quantity) {
        // Close entire short
        const realizedPnl = (existing.entry_price - price) * existing.quantity;
        const closed = await this.db.positions.close(
          existing.id,
          price,
          realizedPnl,
        );

        // If we bought more than we closed, open a new long
        if (quantity > existing.quantity) {
          const newPos = await this.db.positions.create({
            userId,
            strategyId: order.strategy_id,
            symbol,
            side: 'long',
            quantity: quantity - existing.quantity,
            entryPrice: price,
            mode,
          });
          return { position: newPos, realizedPnl };
        }

        return { position: closed, realizedPnl };
      }

      // Partial close of short: reduce quantity, realized PnL proportional to closed size.
      const closeQty = quantity;
      const remainingQty = existing.quantity - closeQty;
      const realizedPnl = (existing.entry_price - price) * closeQty;
      const pos = await this.db.positions.update(existing.id, {
        quantity: remainingQty,
      } as any);
      return { position: pos, realizedPnl };
    }

    // Sell order
    if (existing.side === 'short') {
      // Add to short position
      const totalCost =
        existing.entry_price * existing.quantity + price * quantity;
      const totalQty = existing.quantity + quantity;
      const newEntry = totalCost / totalQty;

      const pos = await this.db.positions.update(existing.id, {
        entryPrice: newEntry,
        quantity: totalQty,
      } as any);
      return { position: pos, realizedPnl: 0 };
    }

    // Reducing long position
    if (quantity >= existing.quantity) {
      // Close entire long
      const realizedPnl = (price - existing.entry_price) * existing.quantity;
      const closed = await this.db.positions.close(
        existing.id,
        price,
        realizedPnl,
      );

      // If we sold more than we closed, open a new short
      if (quantity > existing.quantity) {
        const newPos = await this.db.positions.create({
          userId,
          strategyId: order.strategy_id,
          symbol,
          side: 'short',
          quantity: quantity - existing.quantity,
          entryPrice: price,
          mode,
        });
        return { position: newPos, realizedPnl };
      }

      return { position: closed, realizedPnl };
    }

    // Partial close of long: reduce quantity, realized PnL proportional to closed size.
    const closeQty = quantity;
    const remainingQty = existing.quantity - closeQty;
    const realizedPnl = (price - existing.entry_price) * closeQty;
    const pos = await this.db.positions.update(existing.id, {
      quantity: remainingQty,
    } as any);
    return { position: pos, realizedPnl };
  }
}
