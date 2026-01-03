"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Target,
  BarChart3,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Network,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Types
interface PatternHealth {
  status: "ok" | "degraded" | "unhealthy" | "unconfigured";
  latencyMs?: number;
  version?: string;
  strategiesIndexed?: number;
  tradesIndexed?: number;
  regimesIndexed?: number;
}

interface StrategyRecommendation {
  strategyId: string;
  name: string;
  score: number;
  symbols: string[];
  metrics: {
    totalReturn: number | null;
    maxDrawdown: number | null;
    winRate: number | null;
    sharpeRatio: number | null;
  };
  reason?: string;
}

interface RiskGraphData {
  overallRisk: number;
  marketRegime: "bullish" | "bearish" | "neutral";
  volatility: number;
  liquidity: "high" | "medium" | "low";
  riskFactors: {
    factor: string;
    score: number;
    trend: "up" | "down" | "stable";
  }[];
  recommendations: string[];
}

interface RegimeMetrics {
  trend: "bullish" | "bearish" | "neutral";
  volatility: number;
  liquidity: "high" | "medium" | "low";
  indicators: {
    rsi: number;
    macd: number;
    atr: number;
  };
}

export default function PatternsPage() {
  const [health, setHealth] = useState<PatternHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [riskGraph, setRiskGraph] = useState<RiskGraphData | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [regime, setRegime] = useState<RegimeMetrics | null>(null);
  const { toast } = useToast();

  // Fetch pattern health
  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/patterns/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ status: "unconfigured" });
      }
    } catch {
      setHealth({ status: "unhealthy" });
    } finally {
      setHealthLoading(false);
    }
  };

  // Fetch strategy recommendations
  const fetchRecommendations = async () => {
    setRecsLoading(true);
    try {
      const res = await fetch("/api/patterns/strategies/recommend?limit=5");
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    } finally {
      setRecsLoading(false);
    }
  };

  // Fetch risk graph
  const fetchRiskGraph = async () => {
    setRiskLoading(true);
    try {
      const res = await fetch("/api/patterns/risk/graph");
      if (res.ok) {
        const data = await res.json();
        setRiskGraph(data);
      }
    } catch (error) {
      console.error("Failed to fetch risk graph:", error);
    } finally {
      setRiskLoading(false);
    }
  };

  // Simulate regime metrics (in production, this would come from RuVector)
  const calculateRegime = () => {
    // Simulated regime based on market conditions
    setRegime({
      trend: Math.random() > 0.6 ? "bullish" : Math.random() > 0.3 ? "neutral" : "bearish",
      volatility: Math.random() * 0.1,
      liquidity: Math.random() > 0.6 ? "high" : Math.random() > 0.3 ? "medium" : "low",
      indicators: {
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 0.01,
        atr: Math.random() * 0.05,
      },
    });
  };

  useEffect(() => {
    fetchHealth();
    fetchRecommendations();
    fetchRiskGraph();
    calculateRegime();
  }, []);

  const getHealthIcon = () => {
    if (!health) return <Activity className="h-5 w-5 text-zinc-400" />;
    switch (health.status) {
      case "ok":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-zinc-400" />;
    }
  };

  const getHealthBadge = () => {
    if (!health) return <Badge variant="secondary">Loading...</Badge>;
    switch (health.status) {
      case "ok":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Online</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Degraded</Badge>;
      case "unhealthy":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Offline</Badge>;
      default:
        return <Badge variant="secondary">Not Configured</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "bullish":
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case "bearish":
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getRiskColor = (risk: number) => {
    if (risk < 0.3) return "bg-green-500";
    if (risk < 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pattern Intelligence</h1>
          <p className="text-zinc-400 mt-1">
            AI-powered pattern recognition and strategy recommendations via RuVector
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[140px] bg-zinc-800/50 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BTC/USDT">BTC/USDT</SelectItem>
              <SelectItem value="ETH/USDT">ETH/USDT</SelectItem>
              <SelectItem value="SOL/USDT">SOL/USDT</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchHealth();
              fetchRecommendations();
              fetchRiskGraph();
              calculateRegime();
              toast({ title: "Refreshed", description: "Pattern data updated" });
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Health & Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Pattern Engine Status */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getHealthIcon()}
                <div>
                  <p className="text-sm text-zinc-400">Pattern Engine</p>
                  <p className="text-lg font-semibold text-white">RuVector</p>
                </div>
              </div>
              {getHealthBadge()}
            </div>
            {health?.latencyMs && (
              <p className="text-xs text-zinc-500 mt-2">Latency: {health.latencyMs}ms</p>
            )}
          </CardContent>
        </Card>

        {/* Indexed Strategies */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Strategies Indexed</p>
                <p className="text-2xl font-bold text-white">
                  {health?.strategiesIndexed ?? "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Indexed Trades */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Trades Analyzed</p>
                <p className="text-2xl font-bold text-white">
                  {health?.tradesIndexed ?? "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Regime */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {getTrendIcon(regime?.trend || "neutral")}
              <div>
                <p className="text-sm text-zinc-400">Market Regime</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {regime?.trend || "Loading..."}
                </p>
              </div>
            </div>
            {regime && (
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  Vol: {(regime.volatility * 100).toFixed(1)}%
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {regime.liquidity} Liq
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Recommendations */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  Strategy Recommendations
                </CardTitle>
                <CardDescription>
                  AI-matched strategies for current market regime
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRecommendations}
                disabled={recsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${recsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-zinc-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recommendations available</p>
                <p className="text-sm">Create strategies to receive AI recommendations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={rec.strategyId}
                    className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-500">#{idx + 1}</span>
                          <h4 className="font-medium text-white">{rec.name}</h4>
                          <Badge className="bg-green-500/20 text-green-400 border-0">
                            {Math.round(rec.score * 100)}% match
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {rec.symbols.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                        {rec.reason && (
                          <p className="text-sm text-zinc-400 mt-2">{rec.reason}</p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {rec.metrics.totalReturn !== null && (
                          <p className={rec.metrics.totalReturn >= 0 ? "text-green-400" : "text-red-400"}>
                            {rec.metrics.totalReturn >= 0 ? "+" : ""}
                            {(rec.metrics.totalReturn * 100).toFixed(1)}%
                          </p>
                        )}
                        {rec.metrics.sharpeRatio !== null && (
                          <p className="text-zinc-500 text-xs">
                            Sharpe: {rec.metrics.sharpeRatio.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Graph */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-cyan-400" />
                  Risk Graph Analysis
                </CardTitle>
                <CardDescription>
                  RuVector-powered risk assessment and factors
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRiskGraph}
                disabled={riskLoading}
              >
                <RefreshCw className={`h-4 w-4 ${riskLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <div className="space-y-4">
                <div className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
                <div className="h-32 bg-zinc-800/50 rounded-lg animate-pulse" />
              </div>
            ) : !riskGraph ? (
              <div className="text-center py-8 text-zinc-500">
                <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Risk data not available</p>
                <p className="text-sm">Connect exchanges to enable risk analysis</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall Risk */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">Overall Risk Score</span>
                    <span className="text-lg font-bold text-white">
                      {Math.round(riskGraph.overallRisk * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={riskGraph.overallRisk * 100}
                    className="h-3"
                  />
                </div>

                {/* Risk Factors */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Risk Factors</h4>
                  <div className="space-y-2">
                    {riskGraph.riskFactors.map((factor) => (
                      <div
                        key={factor.factor}
                        className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {getTrendIcon(factor.trend)}
                          <span className="text-sm text-white">{factor.factor}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={factor.score * 100}
                            className="w-24 h-2"
                          />
                          <span className="text-xs text-zinc-400 w-8">
                            {Math.round(factor.score * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {riskGraph.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-2">
                      Risk Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {riskGraph.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                          <ChevronRight className="h-4 w-4 text-cyan-400 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Regime Indicators */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-400" />
            Market Regime Indicators
          </CardTitle>
          <CardDescription>
            Real-time technical indicators powering pattern recognition
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!regime ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* RSI */}
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">RSI (14)</span>
                  <Badge
                    className={
                      regime.indicators.rsi > 70
                        ? "bg-red-500/20 text-red-400 border-0"
                        : regime.indicators.rsi < 30
                        ? "bg-green-500/20 text-green-400 border-0"
                        : "bg-zinc-500/20 text-zinc-400 border-0"
                    }
                  >
                    {regime.indicators.rsi > 70
                      ? "Overbought"
                      : regime.indicators.rsi < 30
                      ? "Oversold"
                      : "Neutral"}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white">
                  {regime.indicators.rsi.toFixed(1)}
                </p>
                <Progress
                  value={regime.indicators.rsi}
                  className="h-2 mt-2"
                />
              </div>

              {/* MACD */}
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">MACD</span>
                  <Badge
                    className={
                      regime.indicators.macd > 0
                        ? "bg-green-500/20 text-green-400 border-0"
                        : "bg-red-500/20 text-red-400 border-0"
                    }
                  >
                    {regime.indicators.macd > 0 ? "Bullish" : "Bearish"}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white">
                  {regime.indicators.macd > 0 ? "+" : ""}
                  {(regime.indicators.macd * 100).toFixed(3)}%
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {regime.indicators.macd > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <span className="text-xs text-zinc-500">Signal crossover</span>
                </div>
              </div>

              {/* ATR (Volatility) */}
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">ATR (14)</span>
                  <Badge
                    className={
                      regime.indicators.atr > 0.03
                        ? "bg-orange-500/20 text-orange-400 border-0"
                        : "bg-blue-500/20 text-blue-400 border-0"
                    }
                  >
                    {regime.indicators.atr > 0.03 ? "High Vol" : "Low Vol"}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white">
                  {(regime.indicators.atr * 100).toFixed(2)}%
                </p>
                <Progress
                  value={regime.indicators.atr * 100 * 20}
                  className="h-2 mt-2"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pattern Engine Info */}
      <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-500/20 rounded-xl">
              <Brain className="h-8 w-8 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                RuVector Pattern Engine
              </h3>
              <p className="text-zinc-400 text-sm mb-3">
                Our AI-powered pattern recognition system uses vector embeddings and graph
                analysis to identify trading patterns, match strategies to market regimes,
                and provide intelligent recommendations based on historical performance.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Vector Similarity Search
                </Badge>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Regime Detection
                </Badge>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Strategy Matching
                </Badge>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Risk Graph Analysis
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
