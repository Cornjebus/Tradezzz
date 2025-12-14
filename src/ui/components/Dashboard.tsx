/**
 * TradeZZZ Dashboard
 * Main authenticated user interface
 */

import { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Moon,
  LayoutDashboard,
  Link2,
  Bot,
  LineChart,
  History,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  TrendingUp,
  Activity,
  Wallet,
  Sparkles,
} from 'lucide-react';

// Tab types
type Tab = 'overview' | 'exchanges' | 'ai-providers' | 'strategies' | 'orders' | 'settings';

// TradeZZZ Logo Component
function TradeZZZLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Moon className="h-8 w-8 text-indigo-400" />
        <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1" />
      </div>
      <span className="text-xl font-bold">
        Trade<span className="text-indigo-400">ZZZ</span>
      </span>
    </div>
  );
}

export function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
    { id: 'exchanges' as Tab, label: 'Exchanges', icon: Link2 },
    { id: 'ai-providers' as Tab, label: 'AI Providers', icon: Bot },
    { id: 'strategies' as Tab, label: 'Strategies', icon: LineChart },
    { id: 'orders' as Tab, label: 'Orders', icon: History },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] to-[#12121f] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-indigo-900/30 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-indigo-900/30">
          <TradeZZZLogo />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'text-gray-400 hover:text-white hover:bg-indigo-900/20'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-indigo-900/30">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-indigo-900/20 transition-colors"
            >
              <img
                src={user?.imageUrl || `https://ui-avatars.com/api/?name=${user?.firstName || 'U'}&background=6366f1&color=fff`}
                alt="Avatar"
                className="h-8 w-8 rounded-full"
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{user?.firstName || 'Sleeper'}</p>
                <p className="text-xs text-indigo-400">😴 Dreamer Tier</p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-[#12121a] border border-indigo-900/30 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-indigo-900/20 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'exchanges' && <ExchangesTab />}
        {activeTab === 'ai-providers' && <AIProvidersTab />}
        {activeTab === 'strategies' && <StrategiesTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

// Overview Tab
function OverviewTab() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-2xl">💤</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Portfolio Value"
          value="$0.00"
          change="+0%"
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
          title="Open Positions"
          value="0"
          subtitle="Paper Mode"
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Active Strategies"
          value="0"
          subtitle="of 1 allowed"
          icon={<Moon className="h-5 w-5" />}
        />
      </div>

      {/* Getting Started */}
      <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🌙</span>
          Start Your Sleep Trading Journey
        </h2>
        <div className="space-y-4">
          <SetupStep
            number={1}
            title="Connect an Exchange"
            description="Add your Binance, Coinbase, or Kraken API keys to start trading"
            completed={false}
            emoji="🔗"
          />
          <SetupStep
            number={2}
            title="Add an AI Provider"
            description="Connect OpenAI, Anthropic, or DeepSeek for AI-powered analysis"
            completed={false}
            emoji="🤖"
          />
          <SetupStep
            number={3}
            title="Create a Strategy"
            description="Build your first trading strategy using AI signals"
            completed={false}
            emoji="📈"
          />
          <SetupStep
            number={4}
            title="Start Sleeping"
            description="Let TradeZZZ trade while you dream 💤"
            completed={false}
            emoji="😴"
          />
        </div>
      </div>
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

function SetupStep({ number, title, description, completed, emoji }: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  emoji: string;
}) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg ${completed ? 'bg-green-500/10' : 'bg-indigo-900/10'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
        completed ? 'bg-green-500 text-white' : 'bg-indigo-500/20 border border-indigo-500/50'
      }`}>
        {completed ? '✓' : emoji}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

// Exchanges Tab
function ExchangesTab() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Exchange Connections</h1>
          <span>🔗</span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          <Plus className="h-4 w-4" />
          Connect Exchange
        </button>
      </div>

      {/* Exchange Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <ExchangeCard name="Binance" logo="🟡" connected={false} />
        <ExchangeCard name="Coinbase" logo="🔵" connected={false} />
        <ExchangeCard name="Kraken" logo="🟣" connected={false} />
      </div>

      {/* Empty State */}
      <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">🔌</div>
        <h3 className="text-lg font-medium mb-2">No exchanges connected yet</h3>
        <p className="text-gray-400 mb-4">Connect your exchange to start trading while you sleep</p>
        <button className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          Connect Your First Exchange
        </button>
      </div>
    </div>
  );
}

function ExchangeCard({ name, logo, connected }: { name: string; logo: string; connected: boolean }) {
  return (
    <div className={`bg-[#12121a]/80 border rounded-xl p-6 transition-all hover:scale-105 ${connected ? 'border-green-500/50' : 'border-indigo-900/30 hover:border-indigo-500/50'}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{logo}</span>
        <span className="font-semibold">{name}</span>
        {connected && <span className="ml-auto text-green-400 text-sm">✓ Connected</span>}
      </div>
      {connected ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Balance:</span>
            <span>$1,234.56</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className="text-green-400">Active</span>
          </div>
        </div>
      ) : (
        <button className="w-full py-2 border border-indigo-500/50 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors">
          Connect
        </button>
      )}
    </div>
  );
}

// AI Providers Tab
function AIProvidersTab() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <span>🤖</span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          <Plus className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <ProviderCard name="OpenAI" models={['GPT-4o', 'GPT-4-turbo']} connected={false} emoji="🧠" />
        <ProviderCard name="Anthropic" models={['Claude 3.5', 'Claude Opus']} connected={false} emoji="🔮" />
        <ProviderCard name="DeepSeek" models={['V3.2', 'Coder']} connected={false} emoji="🌊" />
      </div>

      {/* Empty State */}
      <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">🧠</div>
        <h3 className="text-lg font-medium mb-2">No AI providers connected</h3>
        <p className="text-gray-400 mb-4">Add your API key to enable AI-powered trading signals</p>
        <button className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          Add Your First AI Provider
        </button>
      </div>
    </div>
  );
}

function ProviderCard({ name, models, connected, emoji }: { name: string; models: string[]; connected: boolean; emoji: string }) {
  return (
    <div className={`bg-[#12121a]/80 border rounded-xl p-6 transition-all hover:scale-105 ${connected ? 'border-green-500/50' : 'border-indigo-900/30 hover:border-indigo-500/50'}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold">{name}</span>
        {connected && <span className="ml-auto text-green-400 text-sm">✓ Active</span>}
      </div>
      <div className="text-sm text-gray-400 mb-4">
        Models: {models.join(', ')}
      </div>
      {connected ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Tokens Used:</span>
            <span>12,345</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cost (Today):</span>
            <span>$0.23</span>
          </div>
        </div>
      ) : (
        <button className="w-full py-2 border border-indigo-500/50 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors">
          Connect
        </button>
      )}
    </div>
  );
}

// Strategies Tab
function StrategiesTab() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Trading Strategies</h1>
          <span>📈</span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          <Plus className="h-4 w-4" />
          Create Strategy
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-lg font-medium mb-2">No strategies yet</h3>
        <p className="text-gray-400 mb-4">Create your first AI-powered trading strategy</p>
        <button className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          Create Your First Strategy
        </button>
      </div>
    </div>
  );
}

// Orders Tab
function OrdersTab() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold">Order History</h1>
        <span>📜</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-indigo-900/30">
        <button className="px-4 py-2 border-b-2 border-indigo-500 text-indigo-400">All Orders</button>
        <button className="px-4 py-2 text-gray-400 hover:text-white">Open</button>
        <button className="px-4 py-2 text-gray-400 hover:text-white">Filled</button>
        <button className="px-4 py-2 text-gray-400 hover:text-white">Cancelled</button>
      </div>

      {/* Empty State */}
      <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">💤</div>
        <h3 className="text-lg font-medium mb-2">No orders yet</h3>
        <p className="text-gray-400">Your trading history will appear here while you sleep</p>
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <span>⚙️</span>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Account Settings */}
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>😴</span> Account
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Subscription Tier</p>
                <p className="text-sm text-indigo-400">Dreamer (Free)</p>
              </div>
              <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm transition-colors">
                Upgrade to Sleeper 💤
              </button>
            </div>
          </div>
        </div>

        {/* Trading Settings */}
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📊</span> Trading
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Default Mode</p>
                <p className="text-sm text-gray-400">Paper trading (simulated)</p>
              </div>
              <select className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm">
                <option>Paper Trading</option>
                <option disabled>Live Trading (Sleeper+)</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Risk Level</p>
                <p className="text-sm text-gray-400">How aggressive while you sleep</p>
              </div>
              <select className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm">
                <option>😴 Conservative</option>
                <option>💤 Medium</option>
                <option>🚀 Aggressive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔔</span> Notifications
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Wake me up for big trades</span>
              <input type="checkbox" className="w-5 h-5 rounded accent-indigo-500" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Morning profit summary</span>
              <input type="checkbox" className="w-5 h-5 rounded accent-indigo-500" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
