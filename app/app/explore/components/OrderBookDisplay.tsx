'use client';

import { cn } from '@/lib/utils';

export interface OrderBookEntry {
  price: number;
  quantity: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  symbol: string;
}

interface OrderBookDisplayProps {
  orderBook: OrderBookData | null;
  isLoading?: boolean;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toFixed(2);
  }
  return price.toFixed(6);
}

function formatQuantity(qty: number): string {
  if (qty >= 1000) {
    return qty.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (qty >= 1) {
    return qty.toFixed(4);
  }
  return qty.toFixed(6);
}

export function OrderBookDisplay({ orderBook, isLoading }: OrderBookDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-card/80 border border-border rounded-xl p-4" data-testid="order-book">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-muted rounded w-24 animate-pulse" />
          <div className="h-4 bg-muted rounded w-16 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!orderBook) {
    return (
      <div className="bg-card/80 border border-border rounded-xl p-4" data-testid="order-book">
        <p className="text-center text-muted-foreground py-8">
          Select a coin to view order book
        </p>
      </div>
    );
  }

  // Calculate max quantity for percentage bar width
  const allQuantities = [...orderBook.bids, ...orderBook.asks].map((e) => e.quantity);
  const maxQuantity = Math.max(...allQuantities, 0.001);

  // Take top 10 entries
  const topBids = orderBook.bids.slice(0, 10);
  const topAsks = orderBook.asks.slice(0, 10);

  // Calculate spread
  const bestBid = topBids[0]?.price || 0;
  const bestAsk = topAsks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return (
    <div className="bg-card/80 border border-border rounded-xl p-4" data-testid="order-book">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Order Book</h3>
        <span className="text-xs text-muted-foreground">
          Spread: ${formatPrice(spread)} ({spreadPercent.toFixed(3)}%)
        </span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div className="flex justify-between text-xs text-muted-foreground px-2">
          <span>Price (USD)</span>
          <span>Size</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-2">
          <span>Price (USD)</span>
          <span>Size</span>
        </div>
      </div>

      {/* Order Book Entries */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bids (Buy Orders) - Green */}
        <div className="space-y-1">
          {topBids.map((bid, i) => {
            const percentage = (bid.quantity / maxQuantity) * 100;
            return (
              <div
                key={`bid-${i}`}
                className="relative flex justify-between items-center px-2 py-1 rounded text-xs"
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-green-500/20 rounded"
                  style={{ width: `${percentage}%` }}
                />
                {/* Content */}
                <span className="relative font-mono text-green-500">
                  ${formatPrice(bid.price)}
                </span>
                <span className="relative font-mono text-muted-foreground">
                  {formatQuantity(bid.quantity)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Asks (Sell Orders) - Red */}
        <div className="space-y-1">
          {topAsks.map((ask, i) => {
            const percentage = (ask.quantity / maxQuantity) * 100;
            return (
              <div
                key={`ask-${i}`}
                className="relative flex justify-between items-center px-2 py-1 rounded text-xs"
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 right-0 bg-red-500/20 rounded"
                  style={{ width: `${percentage}%` }}
                />
                {/* Content */}
                <span className="relative font-mono text-red-500">
                  ${formatPrice(ask.price)}
                </span>
                <span className="relative font-mono text-muted-foreground">
                  {formatQuantity(ask.quantity)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-muted-foreground">
        <div>
          <span className="text-green-500">Bid Total:</span>{' '}
          {formatQuantity(topBids.reduce((sum, b) => sum + b.quantity, 0))}
        </div>
        <div>
          <span className="text-red-500">Ask Total:</span>{' '}
          {formatQuantity(topAsks.reduce((sum, a) => sum + a.quantity, 0))}
        </div>
      </div>
    </div>
  );
}
