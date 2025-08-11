import { EventEmitter } from 'events';
import os from 'os';
import { logger } from '../utils/logger.js';

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: new Map(),
      errors: [],
      performance: [],
      systemHealth: {},
      aiMetrics: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        tokenUsage: 0
      },
      appointmentMetrics: {
        totalBooked: 0,
        totalCancelled: 0,
        totalRescheduled: 0,
        noShows: 0
      }
    };
    
    this.thresholds = {
      errorRate: 0.05, // 5% error rate threshold
      responseTime: 3000, // 3 seconds
      memoryUsage: 0.9, // 90% memory usage
      cpuUsage: 0.8, // 80% CPU usage
      aiFailureRate: 0.1 // 10% AI failure rate
    };
    
    this.startSystemMonitoring();
    this.startMetricsAggregation();
  }

  // Track HTTP request metrics
  trackRequest(req, res, responseTime) {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const statusCode = res.statusCode;
    
    if (!this.metrics.requests.has(endpoint)) {
      this.metrics.requests.set(endpoint, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        statusCodes: {},
        errors: 0
      });
    }
    
    const metric = this.metrics.requests.get(endpoint);
    metric.count++;
    metric.totalTime += responseTime;
    metric.averageTime = metric.totalTime / metric.count;
    metric.statusCodes[statusCode] = (metric.statusCodes[statusCode] || 0) + 1;
    
    if (statusCode >= 400) {
      metric.errors++;
      this.checkErrorThreshold(endpoint, metric);
    }
    
    if (responseTime > this.thresholds.responseTime) {
      this.emit('alert', {
        type: 'SLOW_RESPONSE',
        endpoint,
        responseTime,
        threshold: this.thresholds.responseTime
      });
    }
  }

  // Track errors
  trackError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      type: error.name,
      context,
      resolved: false
    };
    
    this.metrics.errors.push(errorEntry);
    
    // Keep only last 1000 errors
    if (this.metrics.errors.length > 1000) {
      this.metrics.errors.shift();
    }
    
    // Check for critical errors
    if (this.isCriticalError(error)) {
      this.emit('alert', {
        type: 'CRITICAL_ERROR',
        error: errorEntry
      });
    }
    
    return errorEntry;
  }

  // Track AI service metrics
  trackAICall(success, responseTime, tokens = 0) {
    this.metrics.aiMetrics.totalCalls++;
    
    if (success) {
      this.metrics.aiMetrics.successfulCalls++;
    } else {
      this.metrics.aiMetrics.failedCalls++;
    }
    
    // Update average response time
    const totalTime = this.metrics.aiMetrics.averageResponseTime * 
                     (this.metrics.aiMetrics.totalCalls - 1) + responseTime;
    this.metrics.aiMetrics.averageResponseTime = totalTime / this.metrics.aiMetrics.totalCalls;
    
    this.metrics.aiMetrics.tokenUsage += tokens;
    
    // Check AI failure rate
    const failureRate = this.metrics.aiMetrics.failedCalls / this.metrics.aiMetrics.totalCalls;
    if (failureRate > this.thresholds.aiFailureRate) {
      this.emit('alert', {
        type: 'HIGH_AI_FAILURE_RATE',
        failureRate,
        threshold: this.thresholds.aiFailureRate
      });
    }
  }

  // Track appointment metrics
  trackAppointment(action, details = {}) {
    switch (action) {
      case 'booked':
        this.metrics.appointmentMetrics.totalBooked++;
        break;
      case 'cancelled':
        this.metrics.appointmentMetrics.totalCancelled++;
        break;
      case 'rescheduled':
        this.metrics.appointmentMetrics.totalRescheduled++;
        break;
      case 'no-show':
        this.metrics.appointmentMetrics.noShows++;
        break;
    }
    
    this.emit('appointment', {
      action,
      details,
      metrics: this.metrics.appointmentMetrics
    });
  }

  // System health monitoring
  startSystemMonitoring() {
    setInterval(() => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = usedMem / totalMem;
      
      const cpus = os.cpus();
      const cpuUsage = this.calculateCPUUsage(cpus);
      
      this.metrics.systemHealth = {
        timestamp: new Date(),
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          percentage: memUsagePercent
        },
        cpu: {
          cores: cpus.length,
          usage: cpuUsage,
          loadAverage: os.loadavg()
        },
        uptime: process.uptime(),
        platform: os.platform(),
        nodeVersion: process.version
      };
      
      // Check thresholds
      if (memUsagePercent > this.thresholds.memoryUsage) {
        this.emit('alert', {
          type: 'HIGH_MEMORY_USAGE',
          usage: memUsagePercent,
          threshold: this.thresholds.memoryUsage
        });
      }
      
      if (cpuUsage > this.thresholds.cpuUsage) {
        this.emit('alert', {
          type: 'HIGH_CPU_USAGE',
          usage: cpuUsage,
          threshold: this.thresholds.cpuUsage
        });
      }
    }, 30000); // Check every 30 seconds
  }

  // Calculate CPU usage
  calculateCPUUsage(cpus) {
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 1 - (idle / total);
    
    return usage;
  }

  // Metrics aggregation
  startMetricsAggregation() {
    setInterval(() => {
      this.aggregateMetrics();
    }, 60000); // Aggregate every minute
  }

  aggregateMetrics() {
    const aggregated = {
      timestamp: new Date(),
      requests: {},
      errors: {
        total: this.metrics.errors.length,
        unresolved: this.metrics.errors.filter(e => !e.resolved).length,
        byType: {}
      },
      ai: this.metrics.aiMetrics,
      appointments: this.metrics.appointmentMetrics,
      system: this.metrics.systemHealth
    };
    
    // Aggregate request metrics
    this.metrics.requests.forEach((value, key) => {
      aggregated.requests[key] = {
        ...value,
        errorRate: value.errors / value.count
      };
    });
    
    // Group errors by type
    this.metrics.errors.forEach(error => {
      aggregated.errors.byType[error.type] = 
        (aggregated.errors.byType[error.type] || 0) + 1;
    });
    
    // Store aggregated metrics (could be sent to external service)
    this.emit('metrics', aggregated);
    
    return aggregated;
  }

  // Check error threshold
  checkErrorThreshold(endpoint, metric) {
    const errorRate = metric.errors / metric.count;
    if (errorRate > this.thresholds.errorRate) {
      this.emit('alert', {
        type: 'HIGH_ERROR_RATE',
        endpoint,
        errorRate,
        threshold: this.thresholds.errorRate
      });
    }
  }

  // Determine if error is critical
  isCriticalError(error) {
    const criticalPatterns = [
      /database.*connection/i,
      /authentication.*failed/i,
      /payment.*processing/i,
      /security.*breach/i,
      /data.*corruption/i
    ];
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack)
    );
  }

  // Get current metrics
  getMetrics() {
    return this.aggregateMetrics();
  }

  // Get health status
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];
    
    // Check various health indicators
    if (metrics.system.memory.percentage > this.thresholds.memoryUsage) {
      issues.push('High memory usage');
    }
    
    if (metrics.system.cpu.usage > this.thresholds.cpuUsage) {
      issues.push('High CPU usage');
    }
    
    const overallErrorRate = this.calculateOverallErrorRate();
    if (overallErrorRate > this.thresholds.errorRate) {
      issues.push('High error rate');
    }
    
    const aiFailureRate = metrics.ai.failedCalls / metrics.ai.totalCalls;
    if (aiFailureRate > this.thresholds.aiFailureRate) {
      issues.push('High AI failure rate');
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      metrics: {
        uptime: metrics.system.uptime,
        errorRate: overallErrorRate,
        aiSuccessRate: metrics.ai.successfulCalls / metrics.ai.totalCalls,
        memoryUsage: metrics.system.memory.percentage,
        cpuUsage: metrics.system.cpu.usage
      }
    };
  }

  // Calculate overall error rate
  calculateOverallErrorRate() {
    let totalRequests = 0;
    let totalErrors = 0;
    
    this.metrics.requests.forEach(metric => {
      totalRequests += metric.count;
      totalErrors += metric.errors;
    });
    
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  // Reset metrics (useful for testing)
  resetMetrics() {
    this.metrics.requests.clear();
    this.metrics.errors = [];
    this.metrics.performance = [];
    this.metrics.aiMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
      tokenUsage: 0
    };
    this.metrics.appointmentMetrics = {
      totalBooked: 0,
      totalCancelled: 0,
      totalRescheduled: 0,
      noShows: 0
    };
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

// Set up alert handlers
monitoringService.on('alert', (alert) => {
  logger.warn('Monitoring Alert:', alert);
  
  // Send critical alerts via email/SMS
  if (alert.type === 'CRITICAL_ERROR' || alert.type === 'HIGH_ERROR_RATE') {
    // Implement notification logic here
    notifyAdmins(alert);
  }
});

monitoringService.on('metrics', (metrics) => {
  logger.info('Metrics aggregated:', {
    timestamp: metrics.timestamp,
    requestCount: Object.keys(metrics.requests).length,
    errorCount: metrics.errors.total,
    aiCalls: metrics.ai.totalCalls,
    appointments: metrics.appointments.totalBooked
  });
});

// Helper function to notify admins
async function notifyAdmins(alert) {
  // This would integrate with email/SMS services
  logger.error('Critical alert - Admin notification required:', alert);
}

export default monitoringService;