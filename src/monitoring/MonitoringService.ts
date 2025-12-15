/**
 * MonitoringService - Phase 15: Monitoring & Alerting
 *
 * Comprehensive monitoring with:
 * - Health checks
 * - Metrics collection (counters, gauges, histograms)
 * - Performance monitoring
 * - Alert management
 */

// ============================================
// ENUMS & TYPES
// ============================================

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED'
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, boolean>;
  uptime: number;
  timestamp: Date;
}

export interface MetricData {
  type: MetricType;
  value: number;
  count?: number;
  avg?: number;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  name: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface AlertRule {
  name: string;
  condition: (metrics: Record<string, any>) => boolean;
  severity: AlertSeverity;
  message: string;
  autoResolve?: boolean;
}

export interface AlertCreateInput {
  name: string;
  message: string;
  severity: AlertSeverity;
  source: string;
}

export interface AlertStatistics {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  bySeverity: Record<string, number>;
}

interface HistogramData {
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
}

interface RequestTracker {
  successes: number;
  errors: number;
  timestamps: number[];
}

// ============================================
// MONITORING SERVICE
// ============================================

export class MonitoringService {
  private services: Map<string, boolean> = new Map();
  private criticalServices: Set<string> = new Set();
  private startTime: number = Date.now();

  private counters: Map<string, number> = new Map();
  private counterLabels: Map<string, Array<{ labels: Record<string, string>; count: number }>> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, HistogramData> = new Map();
  private requestTrackers: Map<string, RequestTracker> = new Map();

  /**
   * Set service status
   */
  setServiceStatus(service: string, isUp: boolean): void {
    this.services.set(service, isUp);
  }

  /**
   * Set critical services list
   */
  setCriticalServices(services: string[]): void {
    this.criticalServices = new Set(services);
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): HealthStatus {
    const servicesMap: Record<string, boolean> = {};
    let allUp = true;
    let criticalDown = false;

    for (const [name, isUp] of this.services.entries()) {
      servicesMap[name] = isUp;
      if (!isUp) {
        allUp = false;
        if (this.criticalServices.has(name)) {
          criticalDown = true;
        }
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (criticalDown) {
      status = 'unhealthy';
    } else if (!allUp) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      services: servicesMap,
      uptime: (Date.now() - this.startTime) / 1000,
      timestamp: new Date()
    };
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    this.counters.set(name, (this.counters.get(name) || 0) + 1);

    if (labels) {
      const existing = this.counterLabels.get(name) || [];
      const match = existing.find(e =>
        Object.keys(labels).every(k => e.labels[k] === labels[k])
      );
      if (match) {
        match.count++;
      } else {
        existing.push({ labels, count: 1 });
      }
      this.counterLabels.set(name, existing);
    }
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number): void {
    const existing = this.histograms.get(name) || {
      values: [],
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity
    };

    existing.values.push(value);
    existing.count++;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);

    this.histograms.set(name, existing);
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string): MetricData {
    // Check counters
    if (this.counters.has(name)) {
      return {
        type: MetricType.COUNTER,
        value: this.counters.get(name)!
      };
    }

    // Check gauges
    if (this.gauges.has(name)) {
      return {
        type: MetricType.GAUGE,
        value: this.gauges.get(name)!
      };
    }

    // Check histograms
    const histogram = this.histograms.get(name);
    if (histogram) {
      return {
        type: MetricType.HISTOGRAM,
        value: histogram.sum,
        count: histogram.count,
        avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        min: histogram.min === Infinity ? 0 : histogram.min,
        max: histogram.max === -Infinity ? 0 : histogram.max
      };
    }

    return { type: MetricType.GAUGE, value: 0 };
  }

  /**
   * Get counter metrics filtered by labels
   */
  getMetricsWithLabels(name: string, matchLabels: Record<string, string>): number {
    const labeledData = this.counterLabels.get(name) || [];
    return labeledData
      .filter(entry =>
        Object.keys(matchLabels).every(k => entry.labels[k] === matchLabels[k])
      )
      .reduce((sum, entry) => sum + entry.count, 0);
  }

  /**
   * Get all metrics summary
   */
  getAllMetrics(): Record<string, MetricData> {
    const result: Record<string, MetricData> = {};

    for (const name of this.counters.keys()) {
      result[name] = this.getMetrics(name);
    }
    for (const name of this.gauges.keys()) {
      result[name] = this.getMetrics(name);
    }
    for (const name of this.histograms.keys()) {
      result[name] = this.getMetrics(name);
    }

    return result;
  }

  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string): { end: () => number } {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.recordHistogram(name, duration);
        return duration;
      }
    };
  }

  /**
   * Get percentile from histogram
   */
  getPercentile(name: string, percentile: number): number {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.values.length === 0) {
      return 0;
    }

    const sorted = [...histogram.values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Record successful request
   */
  recordSuccess(name: string): void {
    const tracker = this.getOrCreateTracker(name);
    tracker.successes++;
    tracker.timestamps.push(Date.now());
  }

  /**
   * Record error
   */
  recordError(name: string): void {
    const tracker = this.getOrCreateTracker(name);
    tracker.errors++;
    tracker.timestamps.push(Date.now());
  }

  /**
   * Get error rate
   */
  getErrorRate(name: string): number {
    const tracker = this.requestTrackers.get(name);
    if (!tracker) return 0;

    const total = tracker.successes + tracker.errors;
    return total > 0 ? tracker.errors / total : 0;
  }

  /**
   * Record a request for throughput tracking
   */
  recordRequest(name: string): void {
    const tracker = this.getOrCreateTracker(name);
    tracker.timestamps.push(Date.now());
  }

  /**
   * Get throughput (requests per second)
   */
  getThroughput(name: string): number {
    const tracker = this.requestTrackers.get(name);
    if (!tracker || tracker.timestamps.length === 0) return 0;

    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = tracker.timestamps.filter(t => t >= oneSecondAgo);
    return recentRequests.length;
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    };
  }

  /**
   * Get CPU usage
   */
  getCpuUsage(): { user: number; system: number } {
    const cpu = process.cpuUsage();
    return {
      user: cpu.user / 1000, // Convert to milliseconds
      system: cpu.system / 1000
    };
  }

  /**
   * Measure event loop lag
   */
  async measureEventLoopLag(): Promise<number> {
    const start = Date.now();
    return new Promise(resolve => {
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    });
  }

  private getOrCreateTracker(name: string): RequestTracker {
    let tracker = this.requestTrackers.get(name);
    if (!tracker) {
      tracker = { successes: 0, errors: 0, timestamps: [] };
      this.requestTrackers.set(name, tracker);
    }
    return tracker;
  }
}

// ============================================
// ALERT MANAGER
// ============================================

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private rules: AlertRule[] = [];
  private activeRuleAlerts: Map<string, string> = new Map(); // ruleName -> alertId

  /**
   * Create a new alert
   */
  createAlert(input: AlertCreateInput): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      message: input.message,
      severity: input.severity,
      status: AlertStatus.ACTIVE,
      source: input.source,
      createdAt: new Date()
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  /**
   * Get alert by ID
   */
  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(id: string, userId: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(id: string, resolution: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolution = resolution;
      alert.resolvedAt = new Date();

      // Remove from active rule alerts if it exists
      for (const [ruleName, alertId] of this.activeRuleAlerts.entries()) {
        if (alertId === id) {
          this.activeRuleAlerts.delete(ruleName);
          break;
        }
      }
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.status === AlertStatus.ACTIVE);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.severity === severity);
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return [...this.rules];
  }

  /**
   * Evaluate all rules against current metrics
   */
  evaluateRules(metrics: Record<string, any>): void {
    for (const rule of this.rules) {
      const conditionMet = rule.condition(metrics);
      const existingAlertId = this.activeRuleAlerts.get(rule.name);

      if (conditionMet && !existingAlertId) {
        // Condition triggered, create alert
        const alert = this.createAlert({
          name: rule.name,
          message: rule.message,
          severity: rule.severity,
          source: 'rule_engine'
        });
        this.activeRuleAlerts.set(rule.name, alert.id);
      } else if (!conditionMet && existingAlertId && rule.autoResolve) {
        // Condition cleared, auto-resolve
        this.resolveAlert(existingAlertId, 'Auto-resolved: condition cleared');
      }
    }
  }

  /**
   * Get alert statistics
   */
  getStatistics(): AlertStatistics {
    const alerts = Array.from(this.alerts.values());
    const bySeverity: Record<string, number> = {};

    for (const severity of Object.values(AlertSeverity)) {
      bySeverity[severity] = alerts.filter(a => a.severity === severity).length;
    }

    return {
      total: alerts.length,
      active: alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
      acknowledged: alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length,
      resolved: alerts.filter(a => a.status === AlertStatus.RESOLVED).length,
      bySeverity
    };
  }
}
