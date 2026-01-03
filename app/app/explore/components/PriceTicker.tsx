'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

interface PriceTickerProps {
  prices: PriceData[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
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

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

function getCoinIcon(symbol: string): string {
  const base = symbol.split('/')[0];
  const icons: Record<string, string> = {
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  };
  return icons[base] || '';
}

export function PriceTicker({
  prices,
  selectedSymbol,
  onSelectSymbol,
  isLoading = false,
}: PriceTickerProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card/50 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
              <div className="text-right">
                <div className="h-5 bg-muted rounded w-24 mb-2" />
                <div className="h-3 bg-muted rounded w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {prices.map((price) => {
        const isPositive = price.changePercent24h > 0;
        const isNegative = price.changePercent24h < 0;
        const isSelected = selectedSymbol === price.symbol;

        return (
          <button
            key={price.symbol}
            onClick={() => onSelectSymbol(price.symbol)}
            className={cn(
              'w-full bg-card/80 border rounded-lg p-4 transition-all hover:border-indigo-500/50',
              'flex items-center gap-3 text-left',
              isSelected && 'border-indigo-500 bg-indigo-500/10',
              !isSelected && 'border-border'
            )}
          >
            {/* Coin Icon */}
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {getCoinIcon(price.symbol) ? (
                <img
                  src={getCoinIcon(price.symbol)}
                  alt={price.symbol}
                  className="w-6 h-6"
                />
              ) : (
                <span className="text-xs font-bold">
                  {price.symbol.split('/')[0].slice(0, 2)}
                </span>
              )}
            </div>

            {/* Symbol & Volume */}
            <div className="flex-1">
              <div className="font-semibold" data-testid={`${price.symbol.replace('/', '-').toLowerCase()}-symbol`}>
                {price.symbol}
              </div>
              <div className="text-xs text-muted-foreground">
                Vol: {formatVolume(price.volume24h)}
              </div>
            </div>

            {/* Price & Change */}
            <div className="text-right">
              <div
                className="font-mono text-lg font-semibold"
                data-testid={`${price.symbol.split('/')[0].toLowerCase()}-price`}
              >
                ${formatPrice(price.price)}
              </div>
              <div
                className={cn(
                  'text-sm flex items-center justify-end gap-1',
                  isPositive && 'text-green-500',
                  isNegative && 'text-red-500',
                  !isPositive && !isNegative && 'text-muted-foreground'
                )}
              >
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                <span>
                  {isPositive ? '+' : ''}
                  {price.changePercent24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
