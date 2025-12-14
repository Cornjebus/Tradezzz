import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { TradingConfig, DEFAULT_TRADING_CONFIG } from '../../../types';

type ConfigTab = 'trading' | 'risk' | 'agentdb' | 'lean' | 'midstreamer' | 'goap' | 'safla' | 'api';

export const ConfigModal = ({
  open,
  onOpenChange,
  config,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: TradingConfig;
  onSave: (config: Partial<TradingConfig>) => void;
}) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [activeTab, setActiveTab] = useState<ConfigTab>('trading');

  const handleSave = () => {
    onSave(localConfig);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_TRADING_CONFIG);
  };

  const tabs: { id: ConfigTab; label: string; color: string }[] = [
    { id: 'trading', label: 'Trading', color: 'text-cyan' },
    { id: 'risk', label: 'Risk', color: 'text-red-400' },
    { id: 'agentdb', label: 'AgentDB', color: 'text-blue-400' },
    { id: 'lean', label: 'Lean-Agentic', color: 'text-purple-400' },
    { id: 'midstreamer', label: 'Midstreamer', color: 'text-orange-400' },
    { id: 'goap', label: 'GOAP', color: 'text-green-400' },
    { id: 'safla', label: 'SAFLA', color: 'text-yellow-400' },
    { id: 'api', label: 'API Keys', color: 'text-pink-400' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Neural Trading System Configuration</DialogTitle>
          <DialogDescription>
            Configure all aspects of the trading system including AgentDB, Lean-Agentic, and Midstreamer
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-border pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? `${tab.color} bg-panel`
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4 py-4">
            {/* Trading Parameters Tab */}
            {activeTab === 'trading' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-cyan">Basic Trading Parameters</h3>

                <div>
                  <label className="text-xs text-muted-foreground">Initial Capital ($)</label>
                  <input
                    type="number"
                    value={localConfig.capital}
                    onChange={(e) => setLocalConfig({ ...localConfig, capital: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Trading Symbols (comma-separated)</label>
                  <input
                    type="text"
                    value={localConfig.symbols.join(', ')}
                    onChange={(e) => setLocalConfig({ ...localConfig, symbols: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Example: AAPL, GOOGL, MSFT, TSLA</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Trading Frequency (seconds)</label>
                  <input
                    type="number"
                    value={localConfig.tradingFrequency / 1000}
                    onChange={(e) => setLocalConfig({ ...localConfig, tradingFrequency: Number(e.target.value) * 1000 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">How often to check for trading opportunities</p>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-cyan mb-2">Data Sources</h4>
                  <div className="space-y-2">
                    {Object.entries(localConfig.dataSources).map(([key, enabled]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            dataSources: { ...localConfig.dataSources, [key]: e.target.checked }
                          })}
                          className="w-4 h-4"
                        />
                        <label className="text-xs text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Management Tab */}
            {activeTab === 'risk' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-red-400">Risk Management</h3>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Max Position Size: {(localConfig.riskManagement.maxPositionSize * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={localConfig.riskManagement.maxPositionSize}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      riskManagement: { ...localConfig.riskManagement, maxPositionSize: Number(e.target.value) }
                    })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum position size as % of total capital</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Stop Loss: {(localConfig.riskManagement.stopLoss * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.2"
                    step="0.01"
                    value={localConfig.riskManagement.stopLoss}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      riskManagement: { ...localConfig.riskManagement, stopLoss: Number(e.target.value) }
                    })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Automatically exit if loss exceeds this %</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Take Profit: {(localConfig.riskManagement.takeProfit * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={localConfig.riskManagement.takeProfit}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      riskManagement: { ...localConfig.riskManagement, takeProfit: Number(e.target.value) }
                    })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Automatically exit if profit exceeds this %</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Max Drawdown: {(localConfig.riskManagement.maxDrawdown * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={localConfig.riskManagement.maxDrawdown}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      riskManagement: { ...localConfig.riskManagement, maxDrawdown: Number(e.target.value) }
                    })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Stop all trading if drawdown exceeds this %</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Risk Per Trade: {(localConfig.riskManagement.riskPerTrade * 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.1"
                    step="0.01"
                    value={localConfig.riskManagement.riskPerTrade}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      riskManagement: { ...localConfig.riskManagement, riskPerTrade: Number(e.target.value) }
                    })}
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum risk per individual trade as % of capital</p>
                </div>
              </div>
            )}

            {/* AgentDB Tab */}
            {activeTab === 'agentdb' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-400">AgentDB v1.6.1 - Vector Memory & Learning</h3>

                {/* Vector Search */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2">Vector Search (150x faster)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.vectorSearch.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            vectorSearch: { ...localConfig.agentdb.vectorSearch, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Vector Search</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.vectorSearch.useWASM}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            vectorSearch: { ...localConfig.agentdb.vectorSearch, useWASM: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.agentdb.vectorSearch.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Use WASM Acceleration (150x faster)</label>
                    </div>
                  </div>
                </div>

                {/* HNSW Index */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2">HNSW Index</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.hnsw.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            hnsw: { ...localConfig.agentdb.hnsw, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable HNSW Index</label>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max Elements</label>
                      <input
                        type="number"
                        value={localConfig.agentdb.hnsw.maxElements}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            hnsw: { ...localConfig.agentdb.hnsw, maxElements: Number(e.target.value) }
                          }
                        })}
                        disabled={!localConfig.agentdb.hnsw.enabled}
                        className="w-full px-2 py-1 bg-background border border-border rounded mt-1 text-foreground text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">M</label>
                        <input
                          type="number"
                          value={localConfig.agentdb.hnsw.M}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            agentdb: {
                              ...localConfig.agentdb,
                              hnsw: { ...localConfig.agentdb.hnsw, M: Number(e.target.value) }
                            }
                          })}
                          disabled={!localConfig.agentdb.hnsw.enabled}
                          className="w-full px-2 py-1 bg-background border border-border rounded mt-1 text-foreground text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">efConstruction</label>
                        <input
                          type="number"
                          value={localConfig.agentdb.hnsw.efConstruction}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            agentdb: {
                              ...localConfig.agentdb,
                              hnsw: { ...localConfig.agentdb.hnsw, efConstruction: Number(e.target.value) }
                            }
                          })}
                          disabled={!localConfig.agentdb.hnsw.enabled}
                          className="w-full px-2 py-1 bg-background border border-border rounded mt-1 text-foreground text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">efSearch</label>
                        <input
                          type="number"
                          value={localConfig.agentdb.hnsw.efSearch}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            agentdb: {
                              ...localConfig.agentdb,
                              hnsw: { ...localConfig.agentdb.hnsw, efSearch: Number(e.target.value) }
                            }
                          })}
                          disabled={!localConfig.agentdb.hnsw.enabled}
                          className="w-full px-2 py-1 bg-background border border-border rounded mt-1 text-foreground text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reflexion Memory */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2">Reflexion Memory</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.reflexion.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            reflexion: { ...localConfig.agentdb.reflexion, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Reflexion (Learn from mistakes)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.reflexion.storeFailures}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            reflexion: { ...localConfig.agentdb.reflexion, storeFailures: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.agentdb.reflexion.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Store Failed Trades</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.reflexion.storeCritiques}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            reflexion: { ...localConfig.agentdb.reflexion, storeCritiques: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.agentdb.reflexion.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Store Self-Critiques</label>
                    </div>
                  </div>
                </div>

                {/* Skill Library */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2">Skill Library</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.skillLibrary.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            skillLibrary: { ...localConfig.agentdb.skillLibrary, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Skill Library (Reusable strategies)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.skillLibrary.autoLearn}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            skillLibrary: { ...localConfig.agentdb.skillLibrary, autoLearn: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.agentdb.skillLibrary.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Auto-Learn New Skills</label>
                    </div>
                  </div>
                </div>

                {/* Causal Memory */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2">Causal Memory Graph</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.agentdb.causalMemory.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          agentdb: {
                            ...localConfig.agentdb,
                            causalMemory: { ...localConfig.agentdb.causalMemory, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Causal Reasoning</label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Understand cause-effect relationships (e.g., "buying AAPL causes profit")
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Lean-Agentic Tab */}
            {activeTab === 'lean' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-purple-400">Lean-Agentic v0.3.2 - Formal Verification</h3>

                {/* Theorem Prover */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-purple-400 mb-2">Theorem Prover</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.prover.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            prover: { ...localConfig.leanAgentic.prover, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Formal Verification</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.prover.useHashConsing}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            prover: { ...localConfig.leanAgentic.prover, useHashConsing: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.leanAgentic.prover.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Hash-Consing (150x faster)</label>
                    </div>
                  </div>
                </div>

                {/* Verification Settings */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-purple-400 mb-2">Verification Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.verification.verifyStrategies}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            verification: { ...localConfig.leanAgentic.verification, verifyStrategies: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Verify Trading Strategies</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.verification.verifyRiskManagement}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            verification: { ...localConfig.leanAgentic.verification, verifyRiskManagement: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Verify Risk Rules</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.verification.verifyConstraints}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            verification: { ...localConfig.leanAgentic.verification, verifyConstraints: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Verify All Constraints</label>
                    </div>
                  </div>
                </div>

                {/* Ed25519 Signatures */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-purple-400 mb-2">Cryptographic Signatures</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.leanAgentic.signatures.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          leanAgentic: {
                            ...localConfig.leanAgentic,
                            signatures: { ...localConfig.leanAgentic.signatures, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable Ed25519 Signatures</label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Cryptographically sign all proofs and decisions for tamper detection
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Midstreamer Tab */}
            {activeTab === 'midstreamer' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-orange-400">Midstreamer v0.2.3 - Temporal Analysis</h3>

                {/* Dynamic Time Warping */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-orange-400 mb-2">Dynamic Time Warping (DTW)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.midstreamer.dtw.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          midstreamer: {
                            ...localConfig.midstreamer,
                            dtw: { ...localConfig.midstreamer.dtw, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable DTW (Pattern matching in time series)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.midstreamer.dtw.normalize}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          midstreamer: {
                            ...localConfig.midstreamer,
                            dtw: { ...localConfig.midstreamer.dtw, normalize: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.midstreamer.dtw.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Normalize Time Series</label>
                    </div>
                  </div>
                </div>

                {/* Longest Common Subsequence */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-orange-400 mb-2">Longest Common Subsequence (LCS)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.midstreamer.lcs.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          midstreamer: {
                            ...localConfig.midstreamer,
                            lcs: { ...localConfig.midstreamer.lcs, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable LCS (Find common patterns)</label>
                    </div>
                  </div>
                </div>

                {/* StrangeLoop Meta-Learning */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-orange-400 mb-2">StrangeLoop Meta-Learning</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.midstreamer.strangeLoop.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          midstreamer: {
                            ...localConfig.midstreamer,
                            strangeLoop: { ...localConfig.midstreamer.strangeLoop, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable StrangeLoop (Self-reflection)</label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Meta-learning system that learns how to learn better over time
                    </p>
                  </div>
                </div>

                {/* NanoScheduler */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-orange-400 mb-2">NanoScheduler</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.midstreamer.scheduler.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          midstreamer: {
                            ...localConfig.midstreamer,
                            scheduler: { ...localConfig.midstreamer.scheduler, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable NanoScheduler (Efficient task scheduling)</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GOAP Tab */}
            {activeTab === 'goap' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-green-400">GOAP - Goal-Oriented Action Planning</h3>

                {/* Basic Settings */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-green-400 mb-2">Planning Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.goap.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          goap: { ...localConfig.goap, enabled: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable GOAP Planning</label>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Planning Horizon (steps ahead)</label>
                      <input
                        type="number"
                        value={localConfig.goap.planningHorizon}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          goap: { ...localConfig.goap, planningHorizon: Number(e.target.value) }
                        })}
                        disabled={!localConfig.goap.enabled}
                        className="w-full px-2 py-1 bg-background border border-border rounded mt-1 text-foreground text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Goals */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-green-400 mb-2">Active Goals</h4>
                  <div className="space-y-2">
                    {Object.entries(localConfig.goap.goals).map(([key, enabled]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            goap: {
                              ...localConfig.goap,
                              goals: { ...localConfig.goap.goals, [key]: e.target.checked }
                            }
                          })}
                          className="w-4 h-4"
                          disabled={!localConfig.goap.enabled}
                        />
                        <label className="text-xs text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-green-400 mb-2">Available Actions</h4>
                  <div className="space-y-2">
                    {Object.entries(localConfig.goap.actions).map(([key, enabled]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setLocalConfig({
                            ...localConfig,
                            goap: {
                              ...localConfig.goap,
                              actions: { ...localConfig.goap.actions, [key]: e.target.checked }
                            }
                          })}
                          className="w-4 h-4"
                          disabled={!localConfig.goap.enabled}
                        />
                        <label className="text-xs text-muted-foreground capitalize">{key}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SAFLA Tab */}
            {activeTab === 'safla' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-yellow-400">SAFLA - Self-Aware Feedback Loop Algorithm</h3>

                {/* Basic Learning */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-yellow-400 mb-2">Learning Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: { ...localConfig.safla, enabled: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-muted-foreground">Enable SAFLA Learning</label>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Learning Rate: {localConfig.safla.learningRate.toFixed(3)}
                      </label>
                      <input
                        type="range"
                        min="0.001"
                        max="0.1"
                        step="0.001"
                        value={localConfig.safla.learningRate}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: { ...localConfig.safla, learningRate: Number(e.target.value) }
                        })}
                        disabled={!localConfig.safla.enabled}
                        className="w-full mt-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Exploration Rate: {localConfig.safla.explorationRate.toFixed(3)}
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.5"
                        step="0.01"
                        value={localConfig.safla.explorationRate}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: { ...localConfig.safla, explorationRate: Number(e.target.value) }
                        })}
                        disabled={!localConfig.safla.enabled}
                        className="w-full mt-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Self-Awareness */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-yellow-400 mb-2">Self-Awareness Features</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.awareness.trackConfidence}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: {
                            ...localConfig.safla,
                            awareness: { ...localConfig.safla.awareness, trackConfidence: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.safla.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Track Prediction Confidence</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.awareness.trackUncertainty}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: {
                            ...localConfig.safla,
                            awareness: { ...localConfig.safla.awareness, trackUncertainty: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.safla.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Track Uncertainty</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.awareness.adaptToMarket}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: {
                            ...localConfig.safla,
                            awareness: { ...localConfig.safla.awareness, adaptToMarket: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.safla.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Adapt to Market Regime Changes</label>
                    </div>
                  </div>
                </div>

                {/* Meta-Learning */}
                <div className="border border-border rounded p-3">
                  <h4 className="text-xs font-semibold text-yellow-400 mb-2">Meta-Learning</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.meta.enabled}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: {
                            ...localConfig.safla,
                            meta: { ...localConfig.safla.meta, enabled: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.safla.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Enable Meta-Learning (Learning to learn)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localConfig.safla.meta.learningRateAdaptation}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          safla: {
                            ...localConfig.safla,
                            meta: { ...localConfig.safla.meta, learningRateAdaptation: e.target.checked }
                          }
                        })}
                        className="w-4 h-4"
                        disabled={!localConfig.safla.enabled || !localConfig.safla.meta.enabled}
                      />
                      <label className="text-xs text-muted-foreground">Adaptive Learning Rate</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys Tab */}
            {activeTab === 'api' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-pink-400">API Keys & Data Feeds</h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Gemini API Key</label>
                    <input
                      type="password"
                      value={localConfig.apiKeys.geminiApiKey}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, geminiApiKey: e.target.value }
                      })}
                      placeholder="AIza..."
                      className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For AI-powered market analysis</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Alpaca API Key</label>
                    <input
                      type="password"
                      value={localConfig.apiKeys.alpacaApiKey}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, alpacaApiKey: e.target.value }
                      })}
                      placeholder="PK..."
                      className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For live market data and paper trading</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Alpaca Secret Key</label>
                    <input
                      type="password"
                      value={localConfig.apiKeys.alpacaSecretKey}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, alpacaSecretKey: e.target.value }
                      })}
                      placeholder="..."
                      className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Twitter Bearer Token (Optional)</label>
                    <input
                      type="password"
                      value={localConfig.apiKeys.twitterBearerToken}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        apiKeys: { ...localConfig.apiKeys, twitterBearerToken: e.target.value }
                      })}
                      placeholder="AAA..."
                      className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For social sentiment analysis</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-yellow-400 mb-2">⚠️ Security Notice</p>
                  <p className="text-xs text-muted-foreground">
                    API keys are stored in browser localStorage. For production use, implement server-side
                    key storage and encryption.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button variant="default" onClick={handleSave} className="flex-1 bg-cyan hover:bg-cyan/80">
            Save Configuration
          </Button>
          <Button variant="secondary" onClick={handleReset} className="flex-1">
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
