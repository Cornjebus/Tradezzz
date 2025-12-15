import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MonitoringService,
  AlertManager,
  AlertSeverity,
  AlertStatus,
  MetricType
} from './MonitoringService';

describe('MonitoringService', () => {
  let monitor: MonitoringService;

  beforeEach(() => {
    monitor = new MonitoringService();
  });

  describe('Health Checks', () => {
    it('should_return_healthy_status_when_all_services_up', () => {
      monitor.setServiceStatus('database', true);
      monitor.setServiceStatus('redis', true);
      monitor.setServiceStatus('exchange_api', true);

      const health = monitor.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.services.database).toBe(true);
      expect(health.services.redis).toBe(true);
      expect(health.services.exchange_api).toBe(true);
    });

    it('should_return_degraded_status_when_non_critical_service_down', () => {
      monitor.setServiceStatus('database', true);
      monitor.setServiceStatus('redis', false);
      monitor.setServiceStatus('exchange_api', true);
      monitor.setCriticalServices(['database', 'exchange_api']);

      const health = monitor.getHealthStatus();

      expect(health.status).toBe('degraded');
    });

    it('should_return_unhealthy_status_when_critical_service_down', () => {
      monitor.setServiceStatus('database', false);
      monitor.setServiceStatus('redis', true);
      monitor.setCriticalServices(['database']);

      const health = monitor.getHealthStatus();

      expect(health.status).toBe('unhealthy');
    });

    it('should_include_uptime_in_health_status', () => {
      const health = monitor.getHealthStatus();

      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof health.uptime).toBe('number');
    });
  });

  describe('Metrics Collection', () => {
    it('should_record_counter_metrics', () => {
      monitor.incrementCounter('api_requests', { endpoint: '/api/trades' });
      monitor.incrementCounter('api_requests', { endpoint: '/api/trades' });
      monitor.incrementCounter('api_requests', { endpoint: '/api/users' });

      const metrics = monitor.getMetrics('api_requests');

      expect(metrics.type).toBe(MetricType.COUNTER);
      expect(metrics.value).toBe(3);
    });

    it('should_record_gauge_metrics', () => {
      monitor.setGauge('active_connections', 150);
      monitor.setGauge('active_connections', 175);

      const metrics = monitor.getMetrics('active_connections');

      expect(metrics.type).toBe(MetricType.GAUGE);
      expect(metrics.value).toBe(175);
    });

    it('should_record_histogram_metrics', () => {
      monitor.recordHistogram('response_time_ms', 100);
      monitor.recordHistogram('response_time_ms', 150);
      monitor.recordHistogram('response_time_ms', 200);
      monitor.recordHistogram('response_time_ms', 50);

      const metrics = monitor.getMetrics('response_time_ms');

      expect(metrics.type).toBe(MetricType.HISTOGRAM);
      expect(metrics.count).toBe(4);
      expect(metrics.avg).toBe(125);
      expect(metrics.min).toBe(50);
      expect(metrics.max).toBe(200);
    });

    it('should_record_metrics_with_labels', () => {
      monitor.incrementCounter('trades', { exchange: 'binance', side: 'buy' });
      monitor.incrementCounter('trades', { exchange: 'binance', side: 'sell' });
      monitor.incrementCounter('trades', { exchange: 'coinbase', side: 'buy' });

      const binanceTrades = monitor.getMetricsWithLabels('trades', { exchange: 'binance' });

      expect(binanceTrades).toBe(2);
    });

    it('should_get_all_metrics_summary', () => {
      monitor.incrementCounter('requests');
      monitor.setGauge('memory_mb', 512);
      monitor.recordHistogram('latency', 100);

      const summary = monitor.getAllMetrics();

      expect(summary.requests).toBeDefined();
      expect(summary.memory_mb).toBeDefined();
      expect(summary.latency).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    it('should_track_request_latency', async () => {
      const timer = monitor.startTimer('api_request');
      await new Promise(r => setTimeout(r, 50));
      const duration = timer.end();

      expect(duration).toBeGreaterThanOrEqual(45);
      expect(duration).toBeLessThan(200);
    });

    it('should_calculate_percentiles', () => {
      // Add 100 response times for more accurate percentile testing
      for (let i = 1; i <= 100; i++) {
        monitor.recordHistogram('response_time', i);
      }

      const p50 = monitor.getPercentile('response_time', 50);
      const p95 = monitor.getPercentile('response_time', 95);
      const p99 = monitor.getPercentile('response_time', 99);

      expect(p50).toBe(50);
      expect(p95).toBe(95);
      expect(p99).toBe(99);
    });

    it('should_track_error_rates', () => {
      monitor.recordSuccess('api_requests');
      monitor.recordSuccess('api_requests');
      monitor.recordSuccess('api_requests');
      monitor.recordError('api_requests');
      monitor.recordError('api_requests');

      const errorRate = monitor.getErrorRate('api_requests');

      expect(errorRate).toBe(0.4); // 2 errors out of 5 total
    });

    it('should_track_throughput', () => {
      // Simulate 10 requests over time
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('api');
      }

      const throughput = monitor.getThroughput('api');

      expect(throughput).toBeGreaterThan(0);
    });
  });

  describe('System Metrics', () => {
    it('should_get_memory_usage', () => {
      const memory = monitor.getMemoryUsage();

      expect(memory.heapUsed).toBeGreaterThan(0);
      expect(memory.heapTotal).toBeGreaterThan(0);
      expect(memory.external).toBeGreaterThanOrEqual(0);
      expect(memory.rss).toBeGreaterThan(0);
    });

    it('should_get_cpu_usage', () => {
      const cpu = monitor.getCpuUsage();

      expect(cpu.user).toBeGreaterThanOrEqual(0);
      expect(cpu.system).toBeGreaterThanOrEqual(0);
    });

    it('should_track_event_loop_lag', async () => {
      const lag = await monitor.measureEventLoopLag();

      expect(lag).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('AlertManager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = new AlertManager();
  });

  describe('Alert Creation', () => {
    it('should_create_alert', () => {
      const alert = alertManager.createAlert({
        name: 'High CPU Usage',
        message: 'CPU usage exceeded 90%',
        severity: AlertSeverity.WARNING,
        source: 'system_monitor'
      });

      expect(alert.id).toBeDefined();
      expect(alert.name).toBe('High CPU Usage');
      expect(alert.status).toBe(AlertStatus.ACTIVE);
      expect(alert.createdAt).toBeInstanceOf(Date);
    });

    it('should_create_alerts_with_different_severities', () => {
      const info = alertManager.createAlert({
        name: 'Info',
        message: 'Test',
        severity: AlertSeverity.INFO,
        source: 'test'
      });

      const warning = alertManager.createAlert({
        name: 'Warning',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      const critical = alertManager.createAlert({
        name: 'Critical',
        message: 'Test',
        severity: AlertSeverity.CRITICAL,
        source: 'test'
      });

      expect(info.severity).toBe(AlertSeverity.INFO);
      expect(warning.severity).toBe(AlertSeverity.WARNING);
      expect(critical.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('Alert Management', () => {
    it('should_acknowledge_alert', () => {
      const alert = alertManager.createAlert({
        name: 'Test Alert',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      alertManager.acknowledgeAlert(alert.id, 'user_123');

      const updated = alertManager.getAlert(alert.id);
      expect(updated?.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(updated?.acknowledgedBy).toBe('user_123');
      expect(updated?.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should_resolve_alert', () => {
      const alert = alertManager.createAlert({
        name: 'Test Alert',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      alertManager.resolveAlert(alert.id, 'Fixed the issue');

      const updated = alertManager.getAlert(alert.id);
      expect(updated?.status).toBe(AlertStatus.RESOLVED);
      expect(updated?.resolution).toBe('Fixed the issue');
      expect(updated?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should_get_active_alerts', () => {
      alertManager.createAlert({
        name: 'Active 1',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      const alert2 = alertManager.createAlert({
        name: 'Active 2',
        message: 'Test',
        severity: AlertSeverity.CRITICAL,
        source: 'test'
      });
      alertManager.resolveAlert(alert2.id, 'Fixed');

      const active = alertManager.getActiveAlerts();

      expect(active.length).toBe(1);
      expect(active[0].name).toBe('Active 1');
    });

    it('should_get_alerts_by_severity', () => {
      alertManager.createAlert({
        name: 'Warning 1',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      alertManager.createAlert({
        name: 'Critical 1',
        message: 'Test',
        severity: AlertSeverity.CRITICAL,
        source: 'test'
      });

      alertManager.createAlert({
        name: 'Warning 2',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      const warnings = alertManager.getAlertsBySeverity(AlertSeverity.WARNING);

      expect(warnings.length).toBe(2);
    });
  });

  describe('Alert Rules', () => {
    it('should_add_alert_rule', () => {
      alertManager.addRule({
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.1,
        severity: AlertSeverity.WARNING,
        message: 'Error rate exceeded 10%'
      });

      const rules = alertManager.getRules();

      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('High Error Rate');
    });

    it('should_evaluate_rules_and_create_alerts', () => {
      alertManager.addRule({
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.1,
        severity: AlertSeverity.WARNING,
        message: 'Error rate exceeded 10%'
      });

      alertManager.evaluateRules({ errorRate: 0.15 });

      const alerts = alertManager.getActiveAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].name).toBe('High Error Rate');
    });

    it('should_not_create_duplicate_alerts_for_same_rule', () => {
      alertManager.addRule({
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.1,
        severity: AlertSeverity.WARNING,
        message: 'Error rate exceeded 10%'
      });

      alertManager.evaluateRules({ errorRate: 0.15 });
      alertManager.evaluateRules({ errorRate: 0.20 });

      const alerts = alertManager.getActiveAlerts();

      expect(alerts.length).toBe(1); // Only one alert, not duplicated
    });

    it('should_auto_resolve_when_condition_clears', () => {
      alertManager.addRule({
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.1,
        severity: AlertSeverity.WARNING,
        message: 'Error rate exceeded 10%',
        autoResolve: true
      });

      // Trigger alert
      alertManager.evaluateRules({ errorRate: 0.15 });
      expect(alertManager.getActiveAlerts().length).toBe(1);

      // Condition clears
      alertManager.evaluateRules({ errorRate: 0.05 });
      expect(alertManager.getActiveAlerts().length).toBe(0);
    });
  });

  describe('Alert Statistics', () => {
    it('should_get_alert_statistics', () => {
      alertManager.createAlert({
        name: 'Alert 1',
        message: 'Test',
        severity: AlertSeverity.WARNING,
        source: 'test'
      });

      alertManager.createAlert({
        name: 'Alert 2',
        message: 'Test',
        severity: AlertSeverity.CRITICAL,
        source: 'test'
      });

      const alert3 = alertManager.createAlert({
        name: 'Alert 3',
        message: 'Test',
        severity: AlertSeverity.INFO,
        source: 'test'
      });
      alertManager.resolveAlert(alert3.id, 'Fixed');

      const stats = alertManager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.bySeverity.WARNING).toBe(1);
      expect(stats.bySeverity.CRITICAL).toBe(1);
      expect(stats.bySeverity.INFO).toBe(1);
    });
  });
});
