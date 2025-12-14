import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, Activity, DollarSign, Target, Brain } from 'lucide-react';

export const TradingDashboard = ({
  performance,
  positions,
  cashBalance = 0,
  isRunning,
  learningStats
}: any) => {
  const safeBalance = cashBalance || 0;
  const safePositions = positions || [];

  const portfolioValue = safeBalance + safePositions.reduce((sum: number, p: any) =>
    sum + (p.quantity * p.currentPrice), 0);

  const portfolioChange = performance?.totalReturn || 0;
  const positionCount = safePositions.length;

  return (
    <div className="space-y-6">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Portfolio Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`text-sm ${portfolioChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Cash Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${safeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-muted-foreground">{positionCount} active position{positionCount !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>

        <Card className="bg-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(performance?.winRate || 0).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">{performance?.totalTrades || 0} total trade{performance?.totalTrades !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>

        <Card className="bg-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              AI Learning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((learningStats?.successRate || 0) * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">{learningStats?.totalFeedback || 0} pattern{learningStats?.totalFeedback !== 1 ? 's' : ''} learned</div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Metrics */}
      <Card className="bg-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Sharpe Ratio</div>
              <div className="text-xl font-bold">{(performance?.sharpeRatio || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Max Drawdown</div>
              <div className="text-xl font-bold text-red-400">
                -{(performance?.maxDrawdown || 0).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Avg Return</div>
              <div className="text-xl font-bold text-green-400">
                ${(performance?.avgReturn || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Positions */}
      <Card className="bg-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm">Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {safePositions && safePositions.length > 0 ? (
            <div className="space-y-3">
              {safePositions.map((pos: any, i: number) => {
                const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                return (
                  <div key={i} className="p-3 bg-background rounded-lg border border-border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">{pos.symbol}</div>
                        <div className="text-xs text-muted-foreground">{pos.quantity} shares</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </div>
                        <div className={`text-xs ${pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Entry: ${pos.entryPrice.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No active positions
            </div>
          )}
        </CardContent>
      </Card>

      {/* SAFLA Learning Stats */}
      <Card className="bg-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            SAFLA Learning System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Success Rate</div>
              <div className="font-semibold text-green-400">{((learningStats?.successRate || 0) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Avg Reward</div>
              <div className="font-semibold">${(learningStats?.avgReward || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Learning Rate</div>
              <div className="font-semibold text-cyan">{(learningStats?.learningRate || 0).toFixed(3)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Total Feedback</div>
              <div className="font-semibold">{learningStats?.totalFeedback || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
