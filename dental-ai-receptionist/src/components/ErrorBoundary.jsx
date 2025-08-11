import React from 'react';
import { AlertTriangle, RefreshCw, Home, Mail, Phone, WifiOff, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
      isOnline: navigator.onLine,
      errorType: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = this.state.errorCount + 1;
    const errorType = this.classifyError(error);
    
    this.setState({
      error,
      errorInfo,
      errorCount,
      errorType
    });

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo, errorType);
    
    // Store error in localStorage for debugging
    const errorLog = {
      message: error.toString(),
      stack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      type: errorType,
      sessionId: sessionStorage.getItem('sessionId') || 'no-session'
    };
    
    const existingErrors = JSON.parse(localStorage.getItem('errorLog') || '[]');
    existingErrors.push(errorLog);
    
    // Keep only last 10 errors
    if (existingErrors.length > 10) {
      existingErrors.shift();
    }
    
    localStorage.setItem('errorLog', JSON.stringify(existingErrors));
  }

  componentDidMount() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOnline: true });
  };

  handleOffline = () => {
    this.setState({ isOnline: false });
  }

  classifyError = (error) => {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorString = error?.toString()?.toLowerCase() || '';
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'network';
    }
    if (errorMessage.includes('chunk') || errorMessage.includes('loading')) {
      return 'chunk';
    }
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return 'permission';
    }
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('memory') || errorMessage.includes('maximum call stack')) {
      return 'memory';
    }
    return 'unknown';
  }

  logErrorToService = (error, errorInfo, errorType) => {
    const errorData = {
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: sessionStorage.getItem('sessionId'),
      errorType,
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${window.screen.width}x${window.screen.height}`
      }
    };

    // Send to backend error logging endpoint with retry
    const sendError = (retries = 3) => {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/errors/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(errorData)
      }).catch(err => {
        console.error('Failed to log error to service:', err);
        if (retries > 0) {
          setTimeout(() => sendError(retries - 1), 1000);
        }
      });
    };
    
    sendError();
  };

  handleReset = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    
    // If too many errors, force reload
    if (this.state.errorCount > 3) {
      window.location.reload();
    }
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;
      const { errorType, isOnline, showDetails } = this.state;
      
      // Custom error messages based on type
      const errorMessages = {
        network: {
          title: 'Connection Problem',
          message: 'Unable to connect to our servers. Please check your internet connection.',
          icon: WifiOff
        },
        chunk: {
          title: 'Update Required',
          message: 'The application has been updated. Please refresh to get the latest version.',
          icon: RefreshCw
        },
        permission: {
          title: 'Access Denied',
          message: 'You don\'t have permission to access this resource. Please login again.',
          icon: AlertCircle
        },
        timeout: {
          title: 'Request Timeout',
          message: 'The request took too long to complete. Please try again.',
          icon: AlertTriangle
        },
        memory: {
          title: 'Performance Issue',
          message: 'The application is experiencing performance issues. Please refresh the page.',
          icon: AlertTriangle
        },
        unknown: {
          title: 'Unexpected Error',
          message: 'Something went wrong. Our team has been notified.',
          icon: AlertTriangle
        }
      };
      
      const errorConfig = errorMessages[errorType] || errorMessages.unknown;
      const ErrorIcon = errorConfig.icon;
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 overflow-hidden">
              {/* Error Header */}
              <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <ErrorIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {errorConfig.title}
                    </h1>
                    {!isOnline && (
                      <p className="text-sm text-yellow-400 mt-1">You are currently offline</p>
                    )}
                  </div>
                </div>
              </div>
            
            <div className="p-6 space-y-6">
              {/* Error Message */}
              <div>
                <p className="text-gray-300 text-lg">
                  {errorConfig.message}
                </p>
                {this.state.errorCount > 2 && (
                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      Multiple errors detected. The application may be experiencing issues.
                      Consider clearing your browser cache and cookies.
                    </p>
                  </div>
                )}
              </div>

              {/* Error Details Toggle */}
              {(isDevelopment || showDetails) && (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={this.toggleDetails}
                    className="w-full px-4 py-3 bg-gray-800/50 hover:bg-gray-800/70 transition-colors flex items-center justify-between text-left"
                  >
                    <span className="text-sm font-medium text-gray-300">
                      {showDetails ? 'Hide' : 'Show'} Error Details
                    </span>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  {showDetails && (
                    <div className="p-4 bg-gray-900/50 space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-400">Error Type:</span>
                        <p className="text-sm text-gray-300 mt-1">{errorType}</p>
                      </div>
                      
                      <div>
                        <span className="text-xs font-medium text-gray-400">Error Message:</span>
                        <pre className="mt-1 text-sm text-red-400 whitespace-pre-wrap font-mono">
                          {this.state.error && this.state.error.toString()}
                        </pre>
                      </div>
                      
                      {this.state.errorInfo && (
                        <div>
                          <span className="text-xs font-medium text-gray-400">Component Stack:</span>
                          <pre className="mt-1 text-xs text-gray-500 whitespace-pre-wrap overflow-x-auto font-mono">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                      
                      {isDevelopment && this.state.error?.stack && (
                        <div>
                          <span className="text-xs font-medium text-gray-400">Stack Trace:</span>
                          <pre className="mt-1 text-xs text-gray-500 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto font-mono">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-xs font-medium text-gray-400">Error ID:</span>
                        <p className="text-sm text-gray-300 mt-1 font-mono">
                          {Date.now().toString(36).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all transform hover:scale-105"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span>{errorType === 'chunk' ? 'Refresh Page' : 'Try Again'}</span>
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-all border border-gray-600"
                >
                  <Home className="h-5 w-5" />
                  <span>Go Home</span>
                </button>
              </div>

              {/* Contact Support */}
              <div className="pt-6 border-t border-gray-700">
                <p className="text-sm text-gray-400 text-center mb-4">
                  Need immediate assistance? Contact our support team:
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a 
                    href="tel:+1234567890" 
                    className="flex items-center justify-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>(123) 456-7890</span>
                  </a>
                  <a 
                    href="mailto:support@dentalcare.com" 
                    className="flex items-center justify-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>support@dentalcare.com</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = (Component, fallback) => {
  return (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;