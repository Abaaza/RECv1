import monitoringService from '../services/monitoringService.js';

export const requestMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(...args) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Track request metrics
    monitoringService.trackRequest(req, res, responseTime);
    
    // Log slow requests
    if (responseTime > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`);
    }
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
};

export const aiMonitoring = (serviceName) => {
  return (target, propertyName, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const startTime = Date.now();
      let success = false;
      let tokens = 0;
      
      try {
        const result = await originalMethod.apply(this, args);
        success = true;
        
        // Extract token usage if available
        if (result?.usage?.total_tokens) {
          tokens = result.usage.total_tokens;
        }
        
        return result;
      } catch (error) {
        monitoringService.trackError(error, {
          service: serviceName,
          method: propertyName,
          args: args.map(arg => typeof arg)
        });
        throw error;
      } finally {
        const responseTime = Date.now() - startTime;
        monitoringService.trackAICall(success, responseTime, tokens);
      }
    };
    
    return descriptor;
  };
};

export const appointmentMonitoring = (action) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      if (res.statusCode < 400) {
        monitoringService.trackAppointment(action, {
          userId: req.user?.id,
          appointmentId: data?.appointment?.id || data?.id,
          timestamp: new Date()
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

export const errorMonitoring = (error, req, res, next) => {
  monitoringService.trackError(error, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    user: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  next(error);
};

export const performanceMonitoring = (label) => {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      if (duration > 100) {
        console.log(`Performance: ${label} took ${duration.toFixed(2)}ms`);
      }
    });
    
    next();
  };
};