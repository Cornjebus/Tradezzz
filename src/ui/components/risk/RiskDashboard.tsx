/**
 * Risk Dashboard - Portfolio risk overview and controls
 */

import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';

interface RiskMetrics {
  totalEquity: number;
  availableCapital: number;
  usedMargin: number;
  marginUsagePercent: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  openPositions: number;
  drawdown: {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    currentDrawdown: number;
    currentDrawdownPercent: number;
  };
  var95: number;
  cvar95: number;
  sharpeRatio: number;
  sortinoRatio: number;
  tradeStats: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
  };
}

interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxOpenPositions: number;
  minRiskRewardRatio: number;
}

export function RiskDashboard() {
  const api = useApi();
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLimits, setEditingLimits] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, limitsRes] = await Promise.all([
        api.get<RiskMetrics>('/api/risk/metrics'),
        api.get<RiskLimits>('/api/risk/limits'),
      ]);
      if (metricsRes.data) setMetrics(metricsRes.data);
      if (limitsRes.data) setLimits(limitsRes.data);
    } catch (err) {
      console.error('Failed to load risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveLimits = async () => {
    if (!limits) return;
    await api.put('/api/risk/limits', limits);
    setEditingLimits(false);
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;
  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatNumber = (val: number) => val.toFixed(2);

  if (loading) {
    return <div style={styles.loading}>Loading risk data...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Risk Dashboard</h2>

      {/* Equity Overview */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Portfolio Overview</h3>
        <div style={styles.metricsGrid}>
          <MetricCard
            label="Total Equity"
            value={formatCurrency(metrics?.totalEquity || 0)}
            color="#22c55e"
          />
          <MetricCard
            label="Available Capital"
            value={formatCurrency(metrics?.availableCapital || 0)}
          />
          <MetricCard
            label="Margin Used"
            value={formatPercent(metrics?.marginUsagePercent || 0)}
            color={metrics?.marginUsagePercent! > 0.5 ? '#f59e0b' : undefined}
          />
          <MetricCard
            label="Open Positions"
            value={String(metrics?.openPositions || 0)}
          />
        </div>
      </div>

      {/* P&L Overview */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Profit & Loss</h3>
        <div style={styles.metricsGrid}>
          <MetricCard
            label="Unrealized P&L"
            value={formatCurrency(metrics?.unrealizedPnl || 0)}
            color={metrics?.unrealizedPnl! >= 0 ? '#22c55e' : '#ef4444'}
          />
          <MetricCard
            label="Realized P&L"
            value={formatCurrency(metrics?.realizedPnl || 0)}
            color={metrics?.realizedPnl! >= 0 ? '#22c55e' : '#ef4444'}
          />
          <MetricCard
            label="Daily P&L"
            value={formatCurrency(metrics?.dailyPnl || 0)}
            color={metrics?.dailyPnl! >= 0 ? '#22c55e' : '#ef4444'}
          />
          <MetricCard
            label="Daily Return"
            value={formatPercent(metrics?.dailyPnlPercent || 0)}
            color={metrics?.dailyPnlPercent! >= 0 ? '#22c55e' : '#ef4444'}
          />
        </div>
      </div>

      {/* Risk Metrics */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Risk Metrics</h3>
        <div style={styles.metricsGrid}>
          <MetricCard
            label="Max Drawdown"
            value={formatPercent(metrics?.drawdown.maxDrawdownPercent || 0)}
            color="#ef4444"
          />
          <MetricCard
            label="Current Drawdown"
            value={formatPercent(metrics?.drawdown.currentDrawdownPercent || 0)}
            color={metrics?.drawdown.currentDrawdownPercent! > 0.1 ? '#ef4444' : '#888'}
          />
          <MetricCard
            label="VaR (95%)"
            value={formatPercent(metrics?.var95 || 0)}
          />
          <MetricCard
            label="CVaR (95%)"
            value={formatPercent(metrics?.cvar95 || 0)}
          />
        </div>
      </div>

      {/* Performance Ratios */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Performance</h3>
        <div style={styles.metricsGrid}>
          <MetricCard
            label="Sharpe Ratio"
            value={formatNumber(metrics?.sharpeRatio || 0)}
            color={metrics?.sharpeRatio! > 1 ? '#22c55e' : '#888'}
          />
          <MetricCard
            label="Sortino Ratio"
            value={formatNumber(metrics?.sortinoRatio || 0)}
            color={metrics?.sortinoRatio! > 1 ? '#22c55e' : '#888'}
          />
          <MetricCard
            label="Win Rate"
            value={formatPercent(metrics?.tradeStats.winRate || 0)}
            color={metrics?.tradeStats.winRate! > 0.5 ? '#22c55e' : '#888'}
          />
          <MetricCard
            label="Profit Factor"
            value={formatNumber(metrics?.tradeStats.profitFactor || 0)}
            color={metrics?.tradeStats.profitFactor! > 1.5 ? '#22c55e' : '#888'}
          />
        </div>
      </div>

      {/* Risk Limits */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Risk Limits</h3>
          <button
            onClick={() => editingLimits ? saveLimits() : setEditingLimits(true)}
            style={styles.editButton}
          >
            {editingLimits ? 'Save' : 'Edit'}
          </button>
        </div>
        {limits && (
          <div style={styles.limitsGrid}>
            <LimitRow
              label="Max Position Size"
              value={limits.maxPositionSize}
              editing={editingLimits}
              onChange={(v) => setLimits({ ...limits, maxPositionSize: v })}
            />
            <LimitRow
              label="Max Daily Loss"
              value={limits.maxDailyLoss}
              editing={editingLimits}
              onChange={(v) => setLimits({ ...limits, maxDailyLoss: v })}
            />
            <LimitRow
              label="Max Drawdown"
              value={limits.maxDrawdown}
              editing={editingLimits}
              onChange={(v) => setLimits({ ...limits, maxDrawdown: v })}
            />
            <LimitRow
              label="Max Open Positions"
              value={limits.maxOpenPositions}
              editing={editingLimits}
              onChange={(v) => setLimits({ ...limits, maxOpenPositions: v })}
              isNumber
            />
            <LimitRow
              label="Min Risk/Reward Ratio"
              value={limits.minRiskRewardRatio}
              editing={editingLimits}
              onChange={(v) => setLimits({ ...limits, minRiskRewardRatio: v })}
              isNumber
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color = '#e0e0e0',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  );
}

function LimitRow({
  label,
  value,
  editing,
  onChange,
  isNumber = false,
}: {
  label: string;
  value: number;
  editing: boolean;
  onChange: (v: number) => void;
  isNumber?: boolean;
}) {
  const displayValue = isNumber ? value : `${(value * 100).toFixed(0)}%`;

  return (
    <div style={styles.limitRow}>
      <span style={styles.limitLabel}>{label}</span>
      {editing ? (
        <input
          type="number"
          value={isNumber ? value : value * 100}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNumber ? v : v / 100);
          }}
          style={styles.limitInput}
          step={isNumber ? 1 : 1}
        />
      ) : (
        <span style={styles.limitValue}>{displayValue}</span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    backgroundColor: '#0d0d1a',
    minHeight: '100vh',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '24px',
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#888',
  },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#888',
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#0d0d1a',
    borderRadius: '6px',
    padding: '16px',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '8px',
  },
  cardValue: {
    fontSize: '20px',
    fontWeight: 600,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  limitsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  limitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#0d0d1a',
    borderRadius: '6px',
  },
  limitLabel: {
    color: '#888',
    fontSize: '14px',
  },
  limitValue: {
    color: '#e0e0e0',
    fontSize: '14px',
    fontWeight: 500,
  },
  limitInput: {
    width: '80px',
    padding: '8px',
    backgroundColor: '#2d2d44',
    border: '1px solid #3b82f6',
    borderRadius: '4px',
    color: '#e0e0e0',
    textAlign: 'right',
  },
};

export default RiskDashboard;
