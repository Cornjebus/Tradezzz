/**
 * TradingModeIndicator - Shows current trading mode (Paper/Live)
 *
 * Visual indicator that makes it crystal clear whether user is
 * trading with paper money or real funds.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Zap } from 'lucide-react';

interface TradingModeStatus {
  mode: 'paper' | 'live';
  isLive: boolean;
  canSwitchToLive: boolean;
  modeStartedAt: string;
}

interface TradingModeIndicatorProps {
  onModeChange?: (mode: 'paper' | 'live') => void;
}

export const TradingModeIndicator: React.FC<TradingModeIndicatorProps> = ({
  onModeChange
}) => {
  const [status, setStatus] = useState<TradingModeStatus>({
    mode: 'paper',
    isLive: false,
    canSwitchToLive: false,
    modeStartedAt: new Date().toISOString()
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current mode on mount
  useEffect(() => {
    fetchModeStatus();
  }, []);

  const fetchModeStatus = async () => {
    try {
      const response = await fetch('/api/trading/mode', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch trading mode:', err);
    }
  };

  const handleSwitchToLive = async () => {
    if (!acknowledgement) {
      setError('You must acknowledge the risk warning');
      return;
    }

    try {
      const response = await fetch('/api/trading/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'live',
          confirmation: {
            confirmed: true,
            password,
            acknowledgement: 'I understand I will be trading with real funds'
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus(prev => ({ ...prev, mode: 'live', isLive: true }));
        setShowConfirmDialog(false);
        setPassword('');
        setAcknowledgement(false);
        onModeChange?.('live');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to switch mode');
    }
  };

  const handleSwitchToPaper = async () => {
    try {
      const response = await fetch('/api/trading/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'paper' })
      });

      const data = await response.json();

      if (data.success) {
        setStatus(prev => ({ ...prev, mode: 'paper', isLive: false }));
        onModeChange?.('paper');
      }
    } catch (err) {
      console.error('Failed to switch to paper mode:', err);
    }
  };

  return (
    <div className="relative">
      {/* Mode Badge */}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
          status.isLive
            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
            : 'bg-green-500/20 text-green-400 border border-green-500/50'
        }`}
      >
        {status.isLive ? (
          <>
            <Zap className="w-4 h-4" />
            <span>LIVE TRADING</span>
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            <span>PAPER MODE</span>
          </>
        )}

        {/* Switch Button */}
        <button
          onClick={() => {
            if (status.isLive) {
              handleSwitchToPaper();
            } else {
              setShowConfirmDialog(true);
            }
          }}
          className={`ml-2 px-2 py-1 text-xs rounded ${
            status.isLive
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {status.isLive ? 'Switch to Paper' : 'Go Live'}
        </button>
      </div>

      {/* Live Mode Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <h3 className="text-xl font-bold text-white">Switch to Live Trading</h3>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm">
                <strong>⚠️ WARNING:</strong> You are about to enable live trading.
                All orders will execute with REAL FUNDS on your connected exchange.
                Losses are real and cannot be reversed.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  placeholder="Password"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgement}
                  onChange={(e) => setAcknowledgement(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-300">
                  I understand that live trading uses real funds and I accept
                  full responsibility for any losses that may occur.
                </span>
              </label>

              {error && (
                <div className="text-red-400 text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPassword('');
                    setAcknowledgement(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSwitchToLive}
                  disabled={!password || !acknowledgement}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    password && acknowledgement
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  Enable Live Trading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingModeIndicator;
