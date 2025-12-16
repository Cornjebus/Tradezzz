/**
 * Settings Tab - Connected to /api/settings
 *
 * Manages user preferences with real API calls
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useUserSettings } from '../../hooks/useApi';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function SettingsTab() {
  const { getToken } = useAuth();
  const {
    settings,
    subscription,
    loading,
    fetchSettings,
    fetchSubscription,
    updateTradingSettings,
    updateNotificationSettings,
  } = useUserSettings();

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchSubscription();
  }, [fetchSettings, fetchSubscription]);

  const handleRiskLevelChange = async (riskLevel: string) => {
    setSaving(true);
    const result = await updateTradingSettings({ riskLevel: riskLevel as any });
    setSaving(false);

    if (result.success) {
      setSaveMessage({ type: 'success', text: 'Risk level updated' });
    } else {
      setSaveMessage({ type: 'error', text: result.error || 'Failed to update' });
    }
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    setSaving(true);
    const result = await updateNotificationSettings({ [key]: value });
    setSaving(false);

    if (result.success) {
      setSaveMessage({ type: 'success', text: 'Notifications updated' });
    } else {
      setSaveMessage({ type: 'error', text: result.error || 'Failed to update' });
    }
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleExportData = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/privacy/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tradezzz-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/privacy/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          password: deletePassword
        })
      });

      const data = await response.json();
      if (data.success) {
        // In production, sign out and redirect
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading && !settings) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Settings</h1>
          <span>⚙️</span>
        </div>
        {saveMessage && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            saveMessage.type === 'success'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {saveMessage.text}
          </div>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Subscription */}
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>{subscription?.tierInfo.emoji || '😴'}</span> Account
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Subscription Tier</p>
                <p className="text-sm text-indigo-400">
                  {subscription?.tierInfo.name || 'Dreamer'}
                  {subscription?.tierInfo.price ? ` ($${subscription.tierInfo.price}/mo)` : ' (Free)'}
                </p>
              </div>
              {subscription?.current.tier === 'dreamer' && (
                <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm transition-colors">
                  Upgrade to Sleeper 💤
                </button>
              )}
            </div>
            <div className="text-sm text-gray-400">
              <p className="mb-2">Your plan includes:</p>
              <ul className="list-disc list-inside space-y-1">
                {subscription?.tierInfo.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
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
                <p className="text-sm text-gray-400">
                  {settings?.trading.defaultMode === 'paper' ? 'Paper trading (simulated)' : 'Live trading'}
                </p>
              </div>
              <select
                value={settings?.trading.defaultMode || 'paper'}
                disabled={subscription?.current.tier === 'dreamer'}
                className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="paper">Paper Trading</option>
                <option value="live" disabled={subscription?.current.tier === 'dreamer'}>
                  Live Trading {subscription?.current.tier === 'dreamer' ? '(Sleeper+)' : ''}
                </option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Risk Level</p>
                <p className="text-sm text-gray-400">How aggressive while you sleep</p>
              </div>
              <select
                value={settings?.trading.riskLevel || 'conservative'}
                onChange={(e) => handleRiskLevelChange(e.target.value)}
                disabled={saving}
                className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm"
              >
                <option value="conservative">😴 Conservative</option>
                <option value="medium">💤 Medium</option>
                <option value="aggressive">🚀 Aggressive</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Max Open Positions</p>
                <p className="text-sm text-gray-400">Limit concurrent trades</p>
              </div>
              <span className="text-indigo-400 font-medium">
                {settings?.trading.maxPositions || 5}
              </span>
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
              <input
                type="checkbox"
                checked={settings?.notifications.bigTrades || false}
                onChange={(e) => handleNotificationChange('bigTrades', e.target.checked)}
                className="w-5 h-5 rounded accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Morning profit summary</span>
              <input
                type="checkbox"
                checked={settings?.notifications.morningSummary || false}
                onChange={(e) => handleNotificationChange('morningSummary', e.target.checked)}
                className="w-5 h-5 rounded accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Price alerts</span>
              <input
                type="checkbox"
                checked={settings?.notifications.priceAlerts || false}
                onChange={(e) => handleNotificationChange('priceAlerts', e.target.checked)}
                className="w-5 h-5 rounded accent-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>System updates</span>
              <input
                type="checkbox"
                checked={settings?.notifications.systemUpdates || false}
                onChange={(e) => handleNotificationChange('systemUpdates', e.target.checked)}
                className="w-5 h-5 rounded accent-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔐</span> Data & Privacy
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Export Your Data</p>
                <p className="text-sm text-gray-400">Download all your data (GDPR)</p>
              </div>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 border border-indigo-500/30 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-red-400">Delete Account</p>
                <p className="text-sm text-gray-400">Permanently delete all your data</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#12121a] border border-red-900/30 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h3 className="text-xl font-bold text-white">Delete Account</h3>
            </div>

            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
              <p className="text-red-200 text-sm">
                <strong>This action cannot be undone.</strong> All your data including
                trading history, strategies, and settings will be permanently deleted.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Type "DELETE MY ACCOUNT" to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-red-900/30 rounded-lg px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="DELETE MY ACCOUNT"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Enter your password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-red-900/30 rounded-lg px-3 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="Password"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                    setDeletePassword('');
                  }}
                  className="flex-1 px-4 py-2 border border-indigo-500/30 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE MY ACCOUNT' || !deletePassword}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    deleteConfirmation === 'DELETE MY ACCOUNT' && deletePassword
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsTab;
