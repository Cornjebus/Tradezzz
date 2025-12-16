/**
 * Exchanges Tab - Connected to /api/exchanges
 *
 * Manages exchange connections with real API calls
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, X, Loader2, Wallet } from 'lucide-react';
import { useExchanges, Exchange } from '../../hooks/useApi';

const EXCHANGE_INFO: Record<string, { logo: string; name: string }> = {
  binance: { logo: '🟡', name: 'Binance' },
  coinbase: { logo: '🔵', name: 'Coinbase' },
  kraken: { logo: '🟣', name: 'Kraken' },
  kucoin: { logo: '🟢', name: 'KuCoin' },
  bybit: { logo: '🟠', name: 'Bybit' },
  okx: { logo: '⚪', name: 'OKX' },
};

export function ExchangesTab() {
  const {
    exchanges,
    loading,
    error,
    fetchExchanges,
    addExchange,
    deleteExchange,
    testExchange,
  } = useExchanges();

  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; valid: boolean } | null>(null);

  useEffect(() => {
    fetchExchanges();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const result = await testExchange(id);
    setTestingId(null);
    if (result.success && result.data) {
      setTestResult({ id, valid: result.data.valid });
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this exchange connection?')) {
      await deleteExchange(id);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Exchange Connections</h1>
          <span>🔗</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchExchanges()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-indigo-500/30 rounded-lg text-gray-400 hover:text-white hover:border-indigo-500/50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Connect Exchange
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          Error: {error.message}
        </div>
      )}

      {/* Connected Exchanges */}
      {exchanges.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-300 mb-4">Your Exchanges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exchanges.map((exchange) => (
              <ConnectedExchangeCard
                key={exchange.id}
                exchange={exchange}
                onTest={() => handleTest(exchange.id)}
                onDelete={() => handleDelete(exchange.id)}
                testing={testingId === exchange.id}
                testResult={testResult?.id === exchange.id ? testResult.valid : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Exchanges */}
      <div>
        <h2 className="text-lg font-medium text-gray-300 mb-4">
          {exchanges.length > 0 ? 'Connect More Exchanges' : 'Available Exchanges'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(EXCHANGE_INFO)
            .filter(([id]) => !exchanges.some(e => e.exchange === id))
            .map(([id, info]) => (
              <AvailableExchangeCard
                key={id}
                exchangeId={id}
                name={info.name}
                logo={info.logo}
                onConnect={() => setShowAddModal(true)}
              />
            ))}
        </div>
      </div>

      {/* Empty State */}
      {exchanges.length === 0 && !loading && (
        <div className="mt-8 bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🔌</div>
          <h3 className="text-lg font-medium mb-2">No exchanges connected yet</h3>
          <p className="text-gray-400 mb-4">Connect your exchange to start trading while you sleep</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            Connect Your First Exchange
          </button>
        </div>
      )}

      {/* Add Exchange Modal */}
      {showAddModal && (
        <AddExchangeModal
          onAdd={async (data) => {
            const result = await addExchange(data);
            if (result.success) {
              setShowAddModal(false);
            }
            return result;
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function ConnectedExchangeCard({
  exchange,
  onTest,
  onDelete,
  testing,
  testResult,
}: {
  exchange: Exchange;
  onTest: () => void;
  onDelete: () => void;
  testing: boolean;
  testResult?: boolean;
}) {
  const info = EXCHANGE_INFO[exchange.exchange] || { logo: '🔗', name: exchange.exchange };
  const isActive = exchange.status === 'active';

  return (
    <div className={`bg-[#12121a]/80 border rounded-xl p-6 transition-all ${
      isActive ? 'border-green-500/30' : 'border-red-500/30'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.logo}</span>
          <div>
            <span className="font-semibold">{exchange.name}</span>
            <p className="text-xs text-gray-500">{info.name}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${
          isActive
            ? 'bg-green-500/20 text-green-400'
            : exchange.status === 'error'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-gray-500/20 text-gray-400'
        }`}>
          {exchange.status}
        </span>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400">API Key:</span>
          <span className="font-mono text-xs">{exchange.maskedApiKey}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Permissions:</span>
          <span>{exchange.permissions?.join(', ') || 'N/A'}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex-1 flex items-center justify-center gap-2 py-2 border border-indigo-500/50 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : testResult !== undefined ? (
            testResult ? (
              <><Check className="h-4 w-4 text-green-400" /> Valid</>
            ) : (
              <><X className="h-4 w-4 text-red-400" /> Failed</>
            )
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Test
            </>
          )}
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AvailableExchangeCard({
  exchangeId,
  name,
  logo,
  onConnect,
}: {
  exchangeId: string;
  name: string;
  logo: string;
  onConnect: () => void;
}) {
  return (
    <div className="bg-[#12121a]/80 border border-indigo-900/30 hover:border-indigo-500/50 rounded-xl p-6 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{logo}</span>
        <span className="font-semibold">{name}</span>
      </div>
      <button
        onClick={onConnect}
        className="w-full py-2 border border-indigo-500/50 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
      >
        Connect
      </button>
    </div>
  );
}

function AddExchangeModal({
  onAdd,
  onClose,
}: {
  onAdd: (data: { exchange: string; name: string; apiKey: string; apiSecret: string }) => Promise<any>;
  onClose: () => void;
}) {
  const [selectedExchange, setSelectedExchange] = useState('binance');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await onAdd({
      exchange: selectedExchange,
      name: name || EXCHANGE_INFO[selectedExchange]?.name || selectedExchange,
      apiKey,
      apiSecret,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Failed to add exchange');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#12121a] border border-indigo-900/30 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-6">Connect Exchange</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Exchange</label>
            <select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(EXCHANGE_INFO).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.logo} {info.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={EXCHANGE_INFO[selectedExchange]?.name || 'My Exchange'}
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              required
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your API secret"
              required
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
            <strong>Security Note:</strong> Only enable "Read" and "Trade" permissions. Never enable withdrawal permissions.
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-indigo-500/30 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !apiKey || !apiSecret}
              className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExchangesTab;
