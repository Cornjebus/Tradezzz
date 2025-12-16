/**
 * Overview Tab - Connected Dashboard Overview
 *
 * Shows real stats from APIs:
 * - Portfolio value from paper trading
 * - Exchange connections count
 * - AI provider count
 * - Onboarding progress
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Moon, Wallet, TrendingUp, Activity, CheckCircle2, Circle } from 'lucide-react';
import { useExchanges, useAIProviders, useOnboarding, useTradingMode, useApi } from '../../hooks/useApi';

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const api = useApi();
  const { exchanges, fetchExchanges } = useExchanges();
  const { providers, fetchProviders } = useAIProviders();
  const { progress, fetchProgress } = useOnboarding();
  const { mode, fetchStatus } = useTradingMode();

  const [portfolio, setPortfolio] = useState<{
    totalValue: number;
    balances: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    try {
      const result = await api.get<{ totalValue: number; balances: Record<string, number> }>('/api/trading/paper/portfolio');
      if (result.success && result.data) {
        setPortfolio(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    }
  }, [api]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchExchanges(),
        fetchProviders(),
        fetchProgress(),
        fetchStatus(),
        fetchPortfolio(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchExchanges, fetchProviders, fetchProgress, fetchStatus, fetchPortfolio]);

  // Calculate setup steps completion
  const setupSteps = [
    {
      id: 'exchange',
      title: 'Connect an Exchange',
      description: 'Add your Binance, Coinbase, or Kraken API keys to start trading',
      completed: exchanges.length > 0,
      emoji: '🔗',
      action: () => onNavigate?.('exchanges'),
    },
    {
      id: 'ai',
      title: 'Add an AI Provider',
      description: 'Connect OpenAI, Anthropic, or DeepSeek for AI-powered analysis',
      completed: providers.length > 0,
      emoji: '🤖',
      action: () => onNavigate?.('ai-providers'),
    },
    {
      id: 'strategy',
      title: 'Create a Strategy',
      description: 'Build your first trading strategy using AI signals',
      completed: false, // TODO: Wire up when strategies are implemented
      emoji: '📈',
      action: () => onNavigate?.('strategies'),
    },
    {
      id: 'sleep',
      title: 'Start Sleeping',
      description: 'Let TradeZZZ trade while you dream 💤',
      completed: exchanges.length > 0 && providers.length > 0,
      emoji: '😴',
      action: undefined,
    },
  ];

  const completedSteps = setupSteps.filter(s => s.completed).length;
  const completionPercent = Math.round((completedSteps / setupSteps.length) * 100);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-2xl">💤</span>
        </div>
        <div className="text-sm text-gray-400">
          {mode === 'paper' ? (
            <span className="text-green-400">Paper Trading Mode</span>
          ) : (
            <span className="text-red-400">Live Trading Mode</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Portfolio Value"
          value={portfolio ? `$${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$100,000.00'}
          change={mode === 'paper' ? 'Paper' : 'Live'}
          positive
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="24h P&L"
          value="$0.00"
          change="0%"
          positive
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Exchanges"
          value={exchanges.length.toString()}
          subtitle={exchanges.length > 0 ? `${exchanges.filter(e => e.status === 'active').length} active` : 'None connected'}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="AI Providers"
          value={providers.length.toString()}
          subtitle={providers.length > 0 ? `${providers.filter(p => p.status === 'active').length} active` : 'None configured'}
          icon={<Moon className="h-5 w-5" />}
        />
      </div>

      {/* Getting Started - Show if not complete */}
      {completedSteps < setupSteps.length && (
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🌙</span>
              Start Your Sleep Trading Journey
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="text-sm text-gray-400">{completionPercent}%</span>
            </div>
          </div>
          <div className="space-y-3">
            {setupSteps.map((step, index) => (
              <SetupStep
                key={step.id}
                number={index + 1}
                title={step.title}
                description={step.description}
                completed={step.completed}
                emoji={step.emoji}
                onClick={step.action}
              />
            ))}
          </div>
        </div>
      )}

      {/* All done message */}
      {completedSteps === setupSteps.length && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-green-400">You're All Set!</h2>
              <p className="text-sm text-gray-400">
                TradeZZZ is ready to trade while you sleep. Sweet dreams! 💤
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {(exchanges.length > 0 || providers.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          {/* Connected Exchanges Summary */}
          {exchanges.length > 0 && (
            <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                <span>🔗</span> Connected Exchanges
              </h3>
              <div className="space-y-2">
                {exchanges.slice(0, 3).map((exchange) => (
                  <div key={exchange.id} className="flex items-center justify-between text-sm">
                    <span>{exchange.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      exchange.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {exchange.status}
                    </span>
                  </div>
                ))}
                {exchanges.length > 3 && (
                  <button
                    onClick={() => onNavigate?.('exchanges')}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    +{exchanges.length - 3} more...
                  </button>
                )}
              </div>
            </div>
          )}

          {/* AI Providers Summary */}
          {providers.length > 0 && (
            <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                <span>🤖</span> AI Providers
              </h3>
              <div className="space-y-2">
                {providers.slice(0, 3).map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between text-sm">
                    <span>{provider.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      provider.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {provider.status}
                    </span>
                  </div>
                ))}
                {providers.length > 3 && (
                  <button
                    onClick={() => onNavigate?.('ai-providers')}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    +{providers.length - 3} more...
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, change, positive, subtitle, icon }: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6 hover:border-indigo-500/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">{title}</span>
        <span className="text-indigo-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      {change && (
        <p className={`text-sm ${positive ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </p>
      )}
      {subtitle && (
        <p className="text-sm text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}

function SetupStep({ number, title, description, completed, emoji, onClick }: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  emoji: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-start gap-4 p-4 rounded-lg text-left transition-all ${
        completed
          ? 'bg-green-500/10'
          : onClick
            ? 'bg-indigo-900/10 hover:bg-indigo-900/20 cursor-pointer'
            : 'bg-indigo-900/10'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
        completed
          ? 'bg-green-500 text-white'
          : 'bg-indigo-500/20 border border-indigo-500/50'
      }`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : emoji}
      </div>
      <div className="flex-1">
        <h3 className={`font-medium ${completed ? 'text-green-400' : ''}`}>{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      {!completed && onClick && (
        <Circle className="w-5 h-5 text-gray-500 flex-shrink-0" />
      )}
    </button>
  );
}

export default OverviewTab;
