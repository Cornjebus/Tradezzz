"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Link2,
  Bot,
  LineChart,
  ArrowRight,
  Shield,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PortfolioData {
  value: number;
}

interface TradingStatus {
  mode: "paper" | "live";
  isLive: boolean;
}

interface RiskMetrics {
  riskScore: number;
  dailyPnLPercent: number;
  openPositionsCount: number;
  warnings: Array<{ message: string; severity: string }>;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
}

// Trading state type
interface TradingState {
  mode: "paper" | "live";
  exchangeId: string | null;
  exchangeName: string | null;
  isConnected: boolean;
  canTrade: boolean;
}

// Price data type
interface PriceInfo {
  symbol: string;
  price: number;
  changePercent24h: number;
}

// Connect Exchange Prompt - Shown when no exchange is connected
function ConnectExchangePrompt() {
  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Link2 className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-semibold">Connect Your Exchange</h3>
            <p className="text-sm text-muted-foreground">
              Connect Coinbase to start paper trading with real prices
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          All prices and trading will use data from your connected exchange.
          Paper trades simulate orders against real market prices.
          When you&apos;re ready, flip to live trading - same experience, real money.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard/exchanges">
            <Link2 className="h-4 w-4 mr-2" />
            Connect Exchange
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Quick Trade Panel Component with Live Prices from YOUR Exchange
function QuickTradePanel({
  tradingState,
  onTradeComplete
}: {
  tradingState: TradingState;
  onTradeComplete: () => void;
}) {
  const [symbol, setSymbol] = useState("BTC/USD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("0.001");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [prices, setPrices] = useState<PriceInfo[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);

  // Fetch live prices from YOUR connected exchange
  useEffect(() => {
    if (!tradingState.canTrade) {
      setPricesLoading(false);
      return;
    }

    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/trading?action=prices");
        if (res.ok) {
          const data = await res.json();
          setPrices(data.prices || []);
        }
      } catch (err) {
        console.error("Failed to fetch prices:", err);
      } finally {
        setPricesLoading(false);
      }
    };

    fetchPrices();
    // Refresh prices every 5 seconds
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [tradingState.canTrade]);

  const currentPrice = prices.find(p => p.symbol === symbol);
  const estimatedCost = currentPrice ? parseFloat(quantity) * currentPrice.price : 0;

  const handleTrade = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-order",
          symbol,
          side,
          type: "market",
          quantity: parseFloat(quantity),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const filledPrice = data.order?.averagePrice || currentPrice?.price || 0;
        const modeLabel = data.mode === "live" ? "LIVE" : "PAPER";
        setMessage({
          type: "success",
          text: `[${modeLabel}] ${side.toUpperCase()} ${quantity} ${symbol.split("/")[0]} @ $${filledPrice.toLocaleString()}`
        });
        onTradeComplete();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to place order" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`${tradingState.mode === "live" ? "border-red-500/50 bg-red-500/5" : "border-indigo-500/30 bg-indigo-500/5"}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tradingState.mode === "live" ? "bg-red-500/20" : "bg-indigo-500/20"}`}>
              <ShoppingCart className={`h-5 w-5 ${tradingState.mode === "live" ? "text-red-400" : "text-indigo-400"}`} />
            </div>
            <div>
              <h3 className="font-semibold">
                {tradingState.mode === "live" ? "Live Trading" : "Paper Trading"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Real-time prices from {tradingState.exchangeName}
              </p>
            </div>
          </div>
          {currentPrice && (
            <div className="text-right">
              <p className="text-lg font-bold">${currentPrice.price.toLocaleString()}</p>
              <p className={`text-sm ${currentPrice.changePercent24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {currentPrice.changePercent24h >= 0 ? "+" : ""}{currentPrice.changePercent24h.toFixed(2)}% 24h
              </p>
            </div>
          )}
        </div>

        {tradingState.mode === "live" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-4">
            <p className="text-sm text-red-400 font-medium">
              ⚠️ LIVE MODE - Real money will be used for trades
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div>
            <Label htmlFor="symbol" className="text-xs">Symbol</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger id="symbol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pricesLoading ? (
                  <SelectItem value="BTC/USD">Loading prices...</SelectItem>
                ) : prices.length === 0 ? (
                  <SelectItem value="BTC/USD">No prices available</SelectItem>
                ) : (
                  prices.map(p => (
                    <SelectItem key={p.symbol} value={p.symbol}>
                      <div className="flex justify-between w-full gap-4">
                        <span>{p.symbol}</span>
                        <span className="text-muted-foreground">${p.price.toLocaleString()}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="side" className="text-xs">Side</Label>
            <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
              <SelectTrigger id="side">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">
                  <span className="text-green-400">BUY</span>
                </SelectItem>
                <SelectItem value="sell">
                  <span className="text-red-400">SELL</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity" className="text-xs">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.0001"
              min="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Est. Cost</Label>
            <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 text-sm">
              ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleTrade}
              disabled={loading || pricesLoading || prices.length === 0}
              className={`w-full ${side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {loading ? "Placing..." : side === "buy" ? "Buy" : "Sell"}
            </Button>
          </div>
        </div>

        {message && (
          <div className={`text-sm p-2 rounded ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quick action cards for getting started
function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  completed = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  completed?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-indigo-500/50 transition-all cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${completed ? "bg-green-500/20" : "bg-indigo-500/20"}`}>
              <Icon className={`h-6 w-6 ${completed ? "text-green-400" : "text-indigo-400"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{title}</h3>
                {completed && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                    Done
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Stats card component
function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  loading = false,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <>
                <p className="text-2xl font-bold mt-1">{value}</p>
                {change && (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${
                    changeType === "positive" ? "text-green-400" :
                    changeType === "negative" ? "text-red-400" :
                    "text-muted-foreground"
                  }`}>
                    {changeType === "positive" && <TrendingUp className="h-4 w-4" />}
                    {changeType === "negative" && <TrendingDown className="h-4 w-4" />}
                    {change}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/20">
            <Icon className="h-6 w-6 text-indigo-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardOverview() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [strategyCount, setStrategyCount] = useState(0);
  const [aiProviderCount, setAiProviderCount] = useState(0);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // First get trading state (always works)
      const tradingStateRes = await fetch("/api/trading");
      if (tradingStateRes.ok) {
        const data = await tradingStateRes.json();
        setTradingState(data);

        // Only fetch trading data if exchange is connected
        if (data.canTrade) {
          const [portfolioRes, tradesRes] = await Promise.all([
            fetch("/api/trading?action=portfolio"),
            fetch("/api/trading?action=trades"),
          ]);

          if (portfolioRes.ok) {
            const pData = await portfolioRes.json();
            setPortfolio(pData);
          }

          if (tradesRes.ok) {
            const tData = await tradesRes.json();
            setRecentTrades(tData.trades?.slice(0, 5) || []);
          }
        }
      }

      // Fetch other data in parallel
      const [riskRes, exchangesRes, strategiesRes, aiRes] = await Promise.all([
        fetch("/api/risk"),
        fetch("/api/exchanges"),
        fetch("/api/strategies"),
        fetch("/api/ai-providers"),
      ]);

      if (riskRes.ok) {
        const data = await riskRes.json();
        setRiskMetrics(data.metrics);
      }

      if (exchangesRes.ok) {
        const data = await exchangesRes.json();
        setExchangeCount(data.exchanges?.length || 0);
      }

      if (strategiesRes.ok) {
        const data = await strategiesRes.json();
        setStrategyCount(data.strategies?.length || 0);
      }

      if (aiRes.ok) {
        const data = await aiRes.json();
        setAiProviderCount(data.providers?.length || 0);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="p-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.firstName || "Trader"}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your trading.
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Trading Mode Banner */}
      {tradingState && tradingState.canTrade && (
        <Card className={`mb-6 ${tradingState.mode === "live" ? "border-red-500/50 bg-red-500/5" : "border-yellow-500/50 bg-yellow-500/5"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tradingState.mode === "live" ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
                  <Shield className={`h-5 w-5 ${tradingState.mode === "live" ? "text-red-400" : "text-yellow-400"}`} />
                </div>
                <div>
                  <p className="font-medium">
                    {tradingState.mode === "live" ? "Live Trading Mode" : "Paper Trading Mode"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tradingState.mode === "live"
                      ? "Real money at risk - trade carefully"
                      : `Practice with virtual funds via ${tradingState.exchangeName}`}
                  </p>
                </div>
              </div>
              <Badge variant={tradingState.mode === "live" ? "destructive" : "secondary"}>
                {tradingState.mode.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trading Panel - Shows Connect Prompt OR Quick Trade */}
      <div className="mb-6">
        {tradingState && tradingState.canTrade ? (
          <QuickTradePanel tradingState={tradingState} onTradeComplete={fetchDashboardData} />
        ) : (
          <ConnectExchangePrompt />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Portfolio Value"
          value={portfolio ? formatCurrency(portfolio.value) : "$0.00"}
          change={riskMetrics ? `${riskMetrics.dailyPnLPercent >= 0 ? "+" : ""}${riskMetrics.dailyPnLPercent.toFixed(2)}% today` : undefined}
          changeType={riskMetrics ? (riskMetrics.dailyPnLPercent > 0 ? "positive" : riskMetrics.dailyPnLPercent < 0 ? "negative" : "neutral") : "neutral"}
          icon={DollarSign}
          loading={loading}
        />
        <StatCard
          title="Risk Score"
          value={riskMetrics ? `${riskMetrics.riskScore}/100` : "--"}
          change={riskMetrics?.riskScore && riskMetrics.riskScore < 30 ? "Low risk" : riskMetrics?.riskScore && riskMetrics.riskScore < 70 ? "Moderate" : "High risk"}
          changeType={riskMetrics?.riskScore && riskMetrics.riskScore < 30 ? "positive" : riskMetrics?.riskScore && riskMetrics.riskScore < 70 ? "neutral" : "negative"}
          icon={Shield}
          loading={loading}
        />
        <StatCard
          title="Active Strategies"
          value={strategyCount.toString()}
          change={strategyCount === 0 ? "Create one to start" : `${strategyCount} running`}
          changeType="neutral"
          icon={LineChart}
          loading={loading}
        />
        <StatCard
          title="Open Positions"
          value={riskMetrics ? riskMetrics.openPositionsCount.toString() : "0"}
          change="Current positions"
          changeType="neutral"
          icon={Activity}
          loading={loading}
        />
      </div>

      {/* Getting Started */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
        <p className="text-muted-foreground mb-6">
          Complete these steps to start automated trading
        </p>
        <div className="grid gap-4">
          <QuickActionCard
            icon={Link2}
            title="Connect an Exchange"
            description="Link your Binance, Coinbase, or other exchange accounts"
            href="/dashboard/exchanges"
            completed={exchangeCount > 0}
          />
          <QuickActionCard
            icon={Bot}
            title="Add an AI Provider"
            description="Connect OpenAI, Anthropic, or DeepSeek for intelligent trading"
            href="/dashboard/ai-providers"
            completed={aiProviderCount > 0}
          />
          <QuickActionCard
            icon={LineChart}
            title="Create a Strategy"
            description="Set up your first AI-powered trading strategy"
            href="/dashboard/strategies"
            completed={strategyCount > 0}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {recentTrades.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${trade.side === "buy" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                        {trade.side === "buy" ? (
                          <TrendingUp className={`h-4 w-4 text-green-400`} />
                        ) : (
                          <TrendingDown className={`h-4 w-4 text-red-400`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{trade.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          {trade.side.toUpperCase()} {trade.quantity} @ {formatCurrency(trade.price)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(trade.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">No activity yet</h3>
              <p className="text-muted-foreground mb-4">
                Connect your exchanges and create a strategy to start trading
              </p>
              <Button asChild>
                <Link href="/dashboard/exchanges">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Risk Warnings */}
      {riskMetrics && riskMetrics.warnings && riskMetrics.warnings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">Risk Alerts</h2>
          <div className="space-y-2">
            {riskMetrics.warnings.map((warning, idx) => (
              <Card key={idx} className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="p-4">
                  <p className="text-yellow-400">{warning.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
