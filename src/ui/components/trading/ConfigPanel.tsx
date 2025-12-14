import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Settings } from 'lucide-react';

export const ConfigPanel = ({
  config,
  onConfigChange,
  onStart,
  onStop,
  onReset,
  onShowAdvanced,
  isRunning
}: any) => {
  return (
    <Card className="bg-panel border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          Trading Configuration
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Running" : "Stopped"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={isRunning ? onStop : onStart}
            variant={isRunning ? 'danger' : 'success'}
            className="w-full"
          >
            {isRunning ? 'Stop Trading' : 'Start Trading'}
          </Button>

          <Button
            onClick={onReset}
            variant="secondary"
            className="w-full"
          >
            Reset
          </Button>

          <div className="pt-4 border-t border-border space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Initial Capital ($)</label>
              <input
                type="number"
                value={config.initialCapital}
                onChange={(e) => onConfigChange({ initialCapital: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground text-sm"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Trading Symbols (comma-separated)</label>
              <input
                type="text"
                value={config.symbols?.join(', ') || ''}
                onChange={(e) => onConfigChange({ symbols: e.target.value.split(',').map((s: string) => s.trim()) })}
                className="w-full px-3 py-2 bg-background border border-border rounded mt-1 text-foreground text-sm"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Trading Frequency (seconds)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={(config.tradingFrequency || 15000) / 1000}
                  onChange={(e) => onConfigChange({ tradingFrequency: Number(e.target.value) * 1000 })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm"
                  disabled={isRunning}
                />
                <span className="text-xs text-muted-foreground">s</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="goap"
                checked={config.goapEnabled}
                onChange={(e) => onConfigChange({ goapEnabled: e.target.checked })}
                className="w-4 h-4"
                disabled={isRunning}
              />
              <label htmlFor="goap" className="text-xs text-muted-foreground">
                <span className="text-purple-400">GOAP Planning</span>
                <div className="text-xs mt-0.5">Goal-Oriented Action Planning</div>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="safla"
                checked={config.saflaEnabled}
                onChange={(e) => onConfigChange({ saflaEnabled: e.target.checked })}
                className="w-4 h-4"
                disabled={isRunning}
              />
              <label htmlFor="safla" className="text-xs text-muted-foreground">
                <span className="text-green-400">SAFLA Learning</span>
                <div className="text-xs mt-0.5">Self-Aware Feedback Loop Algorithm</div>
              </label>
            </div>
          </div>

          <Button
            onClick={onShowAdvanced}
            variant="secondary"
            className="w-full mt-4 flex items-center justify-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Show Advanced Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
