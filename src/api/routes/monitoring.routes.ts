/**
 * Monitoring API Routes - Phase 15: Monitoring & Alerting
 *
 * Endpoints for:
 * - Health checks
 * - Metrics collection
 * - Alert management
 */

import { Router, Request, Response } from 'express';
import { MonitoringService, AlertManager, AlertSeverity } from '../../monitoring/MonitoringService';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const monitoringService = new MonitoringService();
const alertManager = new AlertManager();

// Initialize default services for health check
monitoringService.setServiceStatus('api', true);
monitoringService.setCriticalServices(['api', 'database']);

// Set up default alert rules
alertManager.addRule({
  name: 'High Error Rate',
  condition: (metrics) => metrics.errorRate > 0.1,
  severity: AlertSeverity.WARNING,
  message: 'Error rate exceeded 10%',
  autoResolve: true
});

alertManager.addRule({
  name: 'Critical Error Rate',
  condition: (metrics) => metrics.errorRate > 0.25,
  severity: AlertSeverity.CRITICAL,
  message: 'Error rate exceeded 25%',
  autoResolve: true
});

/**
 * GET /api/monitoring/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const health = monitoringService.getHealthStatus();

    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get all metrics
 */
router.get('/metrics', authMiddleware, (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getAllMetrics();
    const memory = monitoringService.getMemoryUsage();
    const cpu = monitoringService.getCpuUsage();

    res.json({
      success: true,
      data: {
        custom: metrics,
        system: {
          memory,
          cpu
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics/:name
 * Get specific metric
 */
router.get('/metrics/:name', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const metric = monitoringService.getMetrics(name);

    res.json({
      success: true,
      data: metric
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/metrics/:name
 * Record a metric value
 */
router.post('/metrics/:name', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { type, value, labels } = req.body;

    switch (type) {
      case 'counter':
        monitoringService.incrementCounter(name, labels);
        break;
      case 'gauge':
        monitoringService.setGauge(name, value);
        break;
      case 'histogram':
        monitoringService.recordHistogram(name, value);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid metric type. Use: counter, gauge, or histogram'
        });
    }

    res.json({
      success: true,
      message: `Metric ${name} recorded`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get all alerts
 */
router.get('/alerts', authMiddleware, (req: Request, res: Response) => {
  try {
    const { status, severity } = req.query;

    let alerts;
    if (status === 'active') {
      alerts = alertManager.getActiveAlerts();
    } else if (severity) {
      alerts = alertManager.getAlertsBySeverity(severity as AlertSeverity);
    } else {
      alerts = alertManager.getActiveAlerts();
    }

    const stats = alertManager.getStatistics();

    res.json({
      success: true,
      data: {
        alerts,
        statistics: stats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/alerts
 * Create a new alert
 */
router.post('/alerts', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, message, severity, source } = req.body;

    if (!name || !message || !severity) {
      return res.status(400).json({
        success: false,
        error: 'name, message, and severity are required'
      });
    }

    const alert = alertManager.createAlert({
      name,
      message,
      severity: severity as AlertSeverity,
      source: source || 'api'
    });

    res.status(201).json({
      success: true,
      data: alert
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.put('/alerts/:id/acknowledge', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const alert = alertManager.getAlert(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alertManager.acknowledgeAlert(id, userId);

    res.json({
      success: true,
      message: 'Alert acknowledged',
      data: alertManager.getAlert(id)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/monitoring/alerts/:id/resolve
 * Resolve an alert
 */
router.put('/alerts/:id/resolve', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const alert = alertManager.getAlert(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alertManager.resolveAlert(id, resolution || 'Resolved via API');

    res.json({
      success: true,
      message: 'Alert resolved',
      data: alertManager.getAlert(id)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/stats
 * Get alert statistics
 */
router.get('/stats', authMiddleware, (req: Request, res: Response) => {
  try {
    const alertStats = alertManager.getStatistics();
    const health = monitoringService.getHealthStatus();
    const memory = monitoringService.getMemoryUsage();

    res.json({
      success: true,
      data: {
        alerts: alertStats,
        health,
        memory: {
          heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
          rssMB: Math.round(memory.rss / 1024 / 1024)
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export services for middleware use
export { monitoringService, alertManager };
export default router;
