/**
 * AI Providers Tab - Connected to /api/ai
 *
 * Manages AI provider connections with real API calls
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { useAIProviders, AIProvider, SupportedProvider } from '../../hooks/useApi';

const PROVIDER_EMOJIS: Record<string, string> = {
  openai: '🧠',
  anthropic: '🔮',
  deepseek: '🌊',
  google: '🔷',
  cohere: '🌀',
  mistral: '💨',
};

export function AIProvidersTab() {
  const {
    providers,
    supportedProviders,
    loading,
    error,
    fetchProviders,
    fetchSupportedProviders,
    addProvider,
    deleteProvider,
    testProvider,
    activateProvider,
    deactivateProvider,
  } = useAIProviders();

  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; valid: boolean } | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchSupportedProviders();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const result = await testProvider(id);
    setTestingId(null);
    if (result.success && result.data) {
      setTestResult({ id, valid: result.data.valid });
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this AI provider?')) {
      await deleteProvider(id);
    }
  };

  const handleToggleStatus = async (provider: AIProvider) => {
    if (provider.status === 'active') {
      await deactivateProvider(provider.id);
    } else {
      await activateProvider(provider.id);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <span>🤖</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchProviders()}
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
            Add Provider
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          Error: {error.message}
        </div>
      )}

      {/* Connected Providers */}
      {providers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-300 mb-4">Your Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <ConnectedProviderCard
                key={provider.id}
                provider={provider}
                onTest={() => handleTest(provider.id)}
                onDelete={() => handleDelete(provider.id)}
                onToggle={() => handleToggleStatus(provider)}
                testing={testingId === provider.id}
                testResult={testResult?.id === provider.id ? testResult.valid : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Providers */}
      <div>
        <h2 className="text-lg font-medium text-gray-300 mb-4">
          {providers.length > 0 ? 'Add More Providers' : 'Available Providers'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {supportedProviders
            .filter(sp => !providers.some(p => p.provider === sp.id))
            .map((provider) => (
              <AvailableProviderCard
                key={provider.id}
                provider={provider}
                onConnect={() => setShowAddModal(true)}
              />
            ))}
        </div>
      </div>

      {/* Empty State */}
      {providers.length === 0 && supportedProviders.length === 0 && !loading && (
        <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🧠</div>
          <h3 className="text-lg font-medium mb-2">No AI providers connected</h3>
          <p className="text-gray-400 mb-4">Add your API key to enable AI-powered trading signals</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
          >
            Add Your First AI Provider
          </button>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <AddProviderModal
          supportedProviders={supportedProviders}
          onAdd={async (data) => {
            const result = await addProvider(data);
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

function ConnectedProviderCard({
  provider,
  onTest,
  onDelete,
  onToggle,
  testing,
  testResult,
}: {
  provider: AIProvider;
  onTest: () => void;
  onDelete: () => void;
  onToggle: () => void;
  testing: boolean;
  testResult?: boolean;
}) {
  const emoji = PROVIDER_EMOJIS[provider.provider] || '🤖';
  const isActive = provider.status === 'active';

  return (
    <div className={`bg-[#12121a]/80 border rounded-xl p-6 transition-all ${
      isActive ? 'border-green-500/30' : 'border-indigo-900/30'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <span className="font-semibold">{provider.name}</span>
            <p className="text-xs text-gray-500">{provider.provider}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-1 rounded text-xs ${
            isActive
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="text-sm text-gray-400 mb-4">
        Model: {provider.defaultModel || 'Default'}
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400">API Key:</span>
          <span className="font-mono text-xs">{provider.maskedApiKey}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Tokens Used:</span>
          <span>{provider.totalTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Requests:</span>
          <span>{provider.totalRequests}</span>
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
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <X className="h-4 w-4 text-red-400" />
            )
          ) : (
            'Test'
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

function AvailableProviderCard({
  provider,
  onConnect,
}: {
  provider: SupportedProvider;
  onConnect: () => void;
}) {
  const emoji = PROVIDER_EMOJIS[provider.id] || '🤖';

  return (
    <div className="bg-[#12121a]/80 border border-indigo-900/30 hover:border-indigo-500/50 rounded-xl p-6 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold">{provider.name}</span>
      </div>
      <div className="text-sm text-gray-400 mb-4">
        Models: {provider.models.slice(0, 2).join(', ')}
        {provider.models.length > 2 && ` +${provider.models.length - 2} more`}
      </div>
      <div className="flex flex-wrap gap-1 mb-4">
        {provider.features.slice(0, 3).map((feature) => (
          <span
            key={feature}
            className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs rounded"
          >
            {feature}
          </span>
        ))}
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

function AddProviderModal({
  supportedProviders,
  onAdd,
  onClose,
}: {
  supportedProviders: SupportedProvider[];
  onAdd: (data: { provider: string; name: string; apiKey: string; defaultModel?: string }) => Promise<any>;
  onClose: () => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState(supportedProviders[0]?.id || '');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selected = supportedProviders.find(p => p.id === selectedProvider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await onAdd({
      provider: selectedProvider,
      name: name || selected?.name || selectedProvider,
      apiKey,
      defaultModel: defaultModel || undefined,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Failed to add provider');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#12121a] border border-indigo-900/30 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-6">Add AI Provider</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setDefaultModel('');
              }}
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              {supportedProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {PROVIDER_EMOJIS[p.id] || '🤖'} {p.name}
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
              placeholder={selected?.name || 'My AI Provider'}
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
              className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {selected && selected.models.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-indigo-900/30 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Use default</option>
                {selected.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

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
              disabled={submitting || !apiKey}
              className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add Provider'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AIProvidersTab;
