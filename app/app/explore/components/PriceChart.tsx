'use client';

import { useEffect, useRef, useState } from 'react';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  isLoading?: boolean;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'];

export function PriceChart({ symbol, candles, isLoading }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  useEffect(() => {
    if (!canvasRef.current || candles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, width, height);

    // Find price range
    const prices = candles.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.1;

    const scaleY = (price: number): number => {
      return (
        padding.top +
        chartHeight -
        ((price - minPrice + pricePadding) / (priceRange + pricePadding * 2)) * chartHeight
      );
    };

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRange * i) / priceSteps;
      const y = scaleY(price);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(formatPrice(price), width - padding.right + 5, y + 3);
    }

    // Draw candles
    const candleWidth = Math.max(1, (chartWidth / candles.length) * 0.8);
    const spacing = chartWidth / candles.length;

    candles.forEach((candle, i) => {
      const x = padding.left + i * spacing + spacing / 2;
      const isGreen = candle.close >= candle.open;
      const color = isGreen ? '#22c55e' : '#ef4444';

      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, scaleY(candle.high));
      ctx.lineTo(x, scaleY(candle.low));
      ctx.stroke();

      // Draw body
      const bodyTop = Math.min(scaleY(candle.open), scaleY(candle.close));
      const bodyBottom = Math.max(scaleY(candle.open), scaleY(candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Draw current price line
    if (candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const priceY = scaleY(lastPrice);
      const isPositive = candles[candles.length - 1].close >= candles[0].open;

      ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, priceY);
      ctx.lineTo(width - padding.right, priceY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current price label
      ctx.fillStyle = isPositive ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`$${formatPrice(lastPrice)}`, width - padding.right + 5, priceY - 5);
    }
  }, [candles]);

  function formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) {
      return price.toFixed(2);
    }
    return price.toFixed(6);
  }

  if (isLoading) {
    return (
      <div className="bg-card/80 border border-border rounded-xl p-4" data-testid="price-chart">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <div key={tf} className="h-6 w-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="h-[300px] bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const priceChange = lastCandle && firstCandle ? lastCandle.close - firstCandle.open : 0;
  const priceChangePercent = firstCandle && firstCandle.open > 0
    ? (priceChange / firstCandle.open) * 100
    : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="bg-card/80 border border-border rounded-xl p-4" data-testid="price-chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{symbol}</h3>
          {lastCandle && (
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono font-bold">
                ${formatPrice(lastCandle.close)}
              </span>
              <span
                className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}
              >
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeframe === tf
                  ? 'bg-indigo-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-[300px]"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Hover tooltip */}
        {hoveredCandle && (
          <div className="absolute top-4 left-4 bg-card/95 border border-border rounded p-2 text-xs font-mono">
            <div>O: ${formatPrice(hoveredCandle.open)}</div>
            <div>H: ${formatPrice(hoveredCandle.high)}</div>
            <div>L: ${formatPrice(hoveredCandle.low)}</div>
            <div>C: ${formatPrice(hoveredCandle.close)}</div>
            <div>V: {hoveredCandle.volume.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* OHLCV Summary */}
      {lastCandle && (
        <div className="mt-4 grid grid-cols-5 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="block text-muted-foreground/60">Open</span>
            <span className="font-mono">${formatPrice(lastCandle.open)}</span>
          </div>
          <div>
            <span className="block text-muted-foreground/60">High</span>
            <span className="font-mono text-green-500">${formatPrice(lastCandle.high)}</span>
          </div>
          <div>
            <span className="block text-muted-foreground/60">Low</span>
            <span className="font-mono text-red-500">${formatPrice(lastCandle.low)}</span>
          </div>
          <div>
            <span className="block text-muted-foreground/60">Close</span>
            <span className="font-mono">${formatPrice(lastCandle.close)}</span>
          </div>
          <div>
            <span className="block text-muted-foreground/60">Volume</span>
            <span className="font-mono">{lastCandle.volume.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
