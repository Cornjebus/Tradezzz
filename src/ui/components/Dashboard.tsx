/**
 * TradeZZZ Dashboard
 * Main authenticated user interface
 */

import { useState } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { AIProvidersTab } from './providers/AIProvidersTab';
import { ExchangesTab } from './exchanges/ExchangesTab';
import { SettingsTab } from './settings/SettingsTab';
import { TradingModeIndicator } from './trading/TradingModeIndicator';
import { OverviewTab } from './overview/OverviewTab';

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
        {/* Header with Trading Mode Indicator */}
        <div className="sticky top-0 z-10 bg-[#0a0a12]/95 backdrop-blur border-b border-indigo-900/30 px-8 py-4 flex items-center justify-between">
          <div />
          <TradingModeIndicator compact />
        </div>

        {activeTab === 'overview' && <OverviewTab onNavigate={(tab) => setActiveTab(tab as Tab)} />}
        {activeTab === 'exchanges' && <ExchangesTab />}
        {activeTab === 'ai-providers' && <AIProvidersTab />}
        {activeTab === 'strategies' && <StrategiesTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

// Overview Tab - Now imported from ./overview/OverviewTab

// Exchanges Tab - Now imported from ./exchanges/ExchangesTab

// AI Providers Tab - Now imported from ./providers/AIProvidersTab

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

// Settings Tab - Now imported from ./settings/SettingsTab
