'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Moon, Sparkles, RefreshCw, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceTicker, PriceData } from './components/PriceTicker';
import { PriceChart, Candle } from './components/PriceChart';
import { OrderBookDisplay, OrderBookData } from './components/OrderBookDisplay';

// TradeZZZ Logo Component
function TradeZZZLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-lg' },
    md: { icon: 'h-8 w-8', text: 'text-2xl' },
    lg: { icon: 'h-12 w-12', text: 'text-4xl' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="relative">
        <Moon className={`${s.icon} text-indigo-400`} />
        <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1" />
      </div>
      <span className={`${s.text} font-bold`}>
        Trade<span className="text-indigo-400">ZZZ</span>
      </span>
    </Link>
  );
}

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExplorePage() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/public/prices`);
      if (!response.ok) throw new Error('Failed to fetch prices');

      const data = await response.json();
      if (data.success && data.prices) {
        setPrices(data.prices);
        setLastUpdate(new Date(data.timestamp));
        setError(null);

        // Auto-select first symbol if none selected
        if (!selectedSymbol && data.prices.length > 0) {
          setSelectedSymbol(data.prices[0].symbol);
        }
      }
    } catch (err: any) {
      console.error('Error fetching prices:', err);
      setError('Unable to load prices. Please try again.');
    } finally {
      setIsLoadingPrices(false);
    }
  }, [selectedSymbol]);

  // Fetch candles for selected symbol
  const fetchCandles = useCallback(async (symbol: string) => {
    setIsLoadingChart(true);
    try {
      const symbolParam = symbol.replace('/', '-');
      const response = await fetch(
        `${API_BASE}/api/public/candles/${symbolParam}?timeframe=1h&limit=100`
      );
      if (!response.ok) throw new Error('Failed to fetch candles');

      const data = await response.json();
      if (data.success && data.candles) {
        setCandles(data.candles);
      }
    } catch (err: any) {
      console.error('Error fetching candles:', err);
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  // Fetch order book for selected symbol
  const fetchOrderBook = useCallback(async (symbol: string) => {
    setIsLoadingOrderBook(true);
    try {
      const symbolParam = symbol.replace('/', '-');
      const response = await fetch(`${API_BASE}/api/public/orderbook/${symbolParam}`);
      if (!response.ok) throw new Error('Failed to fetch order book');

      const data = await response.json();
      if (data.success) {
        setOrderBook({
          symbol: data.symbol,
          bids: data.bids,
          asks: data.asks,
        });
      }
    } catch (err: any) {
      console.error('Error fetching order book:', err);
    } finally {
      setIsLoadingOrderBook(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchPrices();

    // Refresh prices every 5 seconds
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Fetch chart and order book when symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      fetchCandles(selectedSymbol);
      fetchOrderBook(selectedSymbol);
    }
  }, [selectedSymbol, fetchCandles, fetchOrderBook]);

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <TradeZZZLogo />

          <div className="flex items-center gap-4">
            {/* Last Update */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>
                  Updated {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* CTA Buttons */}
            <Link href="/sign-up">
              <Button variant="outline" size="sm">
                Sign Up
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-indigo-400" />
                Live Crypto Prices
              </h1>
              <p className="text-muted-foreground mt-1">
                Real-time market data from Coinbase. No sign-up required.
              </p>
            </div>

            <div className="hidden md:block">
              <Link href="/sign-up">
                <Button className="gap-2">
                  Start Paper Trading
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Price Ticker - Left Column */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24">
              <h2 className="text-lg font-semibold mb-4">Markets</h2>
              <PriceTicker
                prices={prices}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={handleSymbolSelect}
                isLoading={isLoadingPrices}
              />
            </div>
          </div>

          {/* Chart and Order Book - Right Column */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Price Chart */}
            <PriceChart
              symbol={selectedSymbol || 'BTC/USD'}
              candles={candles}
              isLoading={isLoadingChart}
            />

            {/* Order Book */}
            <OrderBookDisplay
              orderBook={orderBook}
              isLoading={isLoadingOrderBook}
            />

            {/* Paper Trade CTA */}
            <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/50 rounded-xl p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">Ready to start trading?</h3>
                  <p className="text-muted-foreground">
                    Sign up to paper trade with $10,000 virtual balance. No exchange connection required.
                  </p>
                </div>
                <Link href="/sign-up">
                  <Button size="lg" className="whitespace-nowrap">
                    Sign up to start trading
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              Data provided by Coinbase. Prices update every 5 seconds.
            </p>
            <p>
              Trading cryptocurrency involves substantial risk of loss.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
