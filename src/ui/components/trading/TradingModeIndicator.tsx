/**
 * TradingModeIndicator - Shows current trading mode (Paper/Live)
 *
 * Visual indicator that makes it crystal clear whether user is
 * trading with paper money or real funds.
 *
 * Connected to /api/trading/mode with Clerk authentication
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Zap, Loader2 } from 'lucide-react';
import { useTradingMode, TradingMode } from '../../hooks/useApi';

interface TradingModeIndicatorProps {
  onModeChange?: (mode: TradingMode) => void;
  compact?: boolean;
}

export function TradingModeIndicator({
  onModeChange,
  compact = false
}: TradingModeIndicatorProps) {
  const { mode, status, loading, fetchStatus, switchMode } = useTradingMode();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // Fetch current mode on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isLive = mode === 'live';

  const handleSwitchToLive = async () => {
    if (!acknowledgement) {
      setError('You must acknowledge the risk warning');
      return;
    }

    setSwitching(true);
    setError(null);

    const result = await switchMode('live', {
      password,
      acknowledgement: 'I understand I will be trading with real funds'
    });

    setSwitching(false);

    if (result.success) {
      setShowConfirmDialog(false);
      setPassword('');
      setAcknowledgement(false);
      onModeChange?.('live');
    } else {
      setError(result.error || 'Failed to switch mode');
    }
  };

  const handleSwitchToPaper = async () => {
    setSwitching(true);
    const result = await switchMode('paper');
    setSwitching(false);

    if (result.success) {
      onModeChange?.('paper');
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/20 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // Compact mode for header/navbar
  if (compact) {
    return (
      <button
        onClick={() => {
          if (isLive) {
            handleSwitchToPaper();
          } else {
            setShowConfirmDialog(true);
          }
        }}
        disabled={switching}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
          isLive
            ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
            : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
        }`}
      >
        {switching ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isLive ? (
          <Zap className="w-3 h-3" />
        ) : (
          <Shield className="w-3 h-3" />
        )}
        <span>{isLive ? 'LIVE' : 'PAPER'}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Mode Badge */}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
          isLive
            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
            : 'bg-green-500/20 text-green-400 border border-green-500/50'
        }`}
      >
        {isLive ? (
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
            if (isLive) {
              handleSwitchToPaper();
            } else {
              setShowConfirmDialog(true);
            }
          }}
          disabled={switching}
          className={`ml-2 px-2 py-1 text-xs rounded flex items-center gap-1 ${
            isLive
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50`}
        >
          {switching && <Loader2 className="w-3 h-3 animate-spin" />}
          {isLive ? 'Switch to Paper' : 'Go Live'}
        </button>
      </div>

      {/* Live Mode Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#12121a] border border-indigo-900/30 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <h3 className="text-xl font-bold text-white">Switch to Live Trading</h3>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm">
                <strong>WARNING:</strong> You are about to enable live trading.
                All orders will execute with REAL FUNDS on your connected exchange.
                Losses are real and cannot be reversed.
              </p>
            </div>

            {status && !status.canSwitchToLive && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm">
                  <strong>Cannot switch to live trading:</strong>
                  <br />
                  {!status.requirements.hasExchange && '- No exchange connected'}
                  {!status.requirements.hasAcceptedDisclaimer && '- Disclaimer not accepted'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Password"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgement}
                  onChange={(e) => setAcknowledgement(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm text-gray-300">
                  I understand that live trading uses real funds and I accept
                  full responsibility for any losses that may occur.
                </span>
              </label>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPassword('');
                    setAcknowledgement(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-indigo-500/30 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSwitchToLive}
                  disabled={!password || !acknowledgement || switching || (status && !status.canSwitchToLive)}
                  className={`flex-1 px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 ${
                    password && acknowledgement && status?.canSwitchToLive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  {switching && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enable Live Trading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradingModeIndicator;
