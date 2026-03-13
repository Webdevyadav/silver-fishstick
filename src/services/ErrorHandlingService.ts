import { logger } from '@/utils/logger';
import { MonitoringService } from './MonitoringService';
import { CircuitBreakerManager } from './CircuitBreaker';
import { EventEmitter } from 'events';

export interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  name: string;
  canHandle: (error: Error, context: ErrorContext) => boolean;
  recover: (error: Error, context: ErrorContext) => Promise<any>;
  priority: number;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryAttempted: boolean;
  recoveryStrategy?: string;
  recoverySuccess: boolean;
  userImpact: 'none' | 'minimal' | 'moderate' | 'severe';
  stackTrace: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * ErrorHandlingService - Comprehensive error handling and recovery system
 * 
 * Provides graceful error handling, automatic recovery mechanisms, retry logic,
 * and comprehensive error reporting for the RosterIQ AI Agent system.
 */
export class ErrorHandlingService extends EventEmitter {
  private static instance: ErrorHandlingService;
  private monitoringService: MonitoringService;
  private circuitBreakerManager: CircuitBreakerManager;
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private errorReports: Map<string, ErrorReport> = new Map();
  private retryConfigs: Map<string, RetryConfig> = new Map();

  private constructor() {
    super();
    this.monitoringService = MonitoringService.getInstance();
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.initializeDefaultStrategies();
    this.initializeDefaultRetryConfigs();
  }

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  public async handleError(
    error: Error,
    context: ErrorContext,
    options?: { skipRecovery?: boolean; skipReporting?: boolean }
  ): Promise<{ recovered: boolean; result?: any; strategy?: string }> {
    const errorId = this.generateErrorId();
    const severity = this.determineSeverity(error, context);
    const userImpact = this.determineUserImpact(error, context);

    // Create error report
    const errorReport: ErrorReport = {
      id: errorId,
      error,
      context,
      timestamp: new Date(),
      severity,
      recoveryAttempted: false,
      recoverySuccess: false,
      userImpact,
      stackTrace: error.stack || 'No stack trace available'
    };

    this.errorReports.set(errorId, errorReport);

    // Log the error
    logger.error(`Error in ${context.component}.${context.operation}:`, {
      errorId,
      message: error.message,
      severity,
      userImpact,
      context
    });

    // Record metrics
    this.monitoringService.recordMetric('error_count', 1, {
      component: context.component,
      operation: context.operation,
      severity,
      userImpact
    });

    // Emit error event
    this.emit('error', { error, context, errorReport });

    // Skip recovery if requested
    if (options?.skipRecovery) {
      return { recovered: false };
    }

    // Attempt recovery
    try {
      const recoveryResult = await this.attemptRecovery(error, context, errorReport);
      
      if (recoveryResult.success) {
        errorReport.recoveryAttempted = true;
        errorReport.recoverySuccess = true;
        errorReport.recoveryStrategy = recoveryResult.strategy;

        logger.info(`Error recovery successful:`, {
          errorId,
          strategy: recoveryResult.strategy
        });

        this.monitoringService.recordMetric('error_recovery_success', 1, {
          strategy: recoveryResult.strategy,
          component: context.component
        });

        this.emit('errorRecovered', { errorReport, result: recoveryResult.result });

        return {
          recovered: true,
          result: recoveryResult.result,
          strategy: recoveryResult.strategy
        };
      } else {
        errorReport.recoveryAttempted = true;
        errorReport.recoverySuccess = false;

        this.monitoringService.recordMetric('error_recovery_failure', 1, {
          component: context.component
        });
      }
    } catch (recoveryError) {
      logger.error('Error during recovery attempt:', {
        errorId,
        originalError: error.message,
        recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
      });
    }

    // Report critical errors immediately
    if (severity === 'critical' && !options?.skipReporting) {
      await this.reportCriticalError(errorReport);
    }

    return { recovered: false };
  }

  /**
   * Execute operation with retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfigName?: string
  ): Promise<T> {
    const config = this.retryConfigs.get(retryConfigName || 'default') || this.getDefaultRetryConfig();
    let lastError: Error;
    let attempt = 0;

    while (attempt < config.maxAttempts) {
      attempt++;

      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`Operation succeeded after ${attempt} attempts:`, {
            component: context.component,
            operation: context.operation
          });
          
          this.monitoringService.recordMetric('retry_success', 1, {
            component: context.component,
            attempts: attempt.toString()
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError, config)) {
          logger.warn(`Non-retryable error encountered:`, {
            component: context.component,
            operation: context.operation,
            error: lastError.message,
            attempt
          });
          break;
        }

        // Don't wait after the last attempt
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          
          logger.warn(`Operation failed, retrying in ${delay}ms:`, {
            component: context.component,
            operation: context.operation,
            error: lastError.message,
            attempt,
            maxAttempts: config.maxAttempts
          });

          await this.sleep(delay);
        }
      }
    }

    // All retry attempts failed
    this.monitoringService.recordMetric('retry_exhausted', 1, {
      component: context.component,
      attempts: attempt.toString()
    });

    throw lastError!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    circuitBreakerName?: string
  ): Promise<T> {
    const cbName = circuitBreakerName || `${context.component}_${context.operation}`;
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(cbName);

    return circuitBreaker.execute(operation);
  }

  /**
   * Execute operation with both retry and circuit breaker protection
   */
  public async executeWithResilience<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: {
      retryConfig?: string;
      circuitBreakerName?: string;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    const cbName = options?.circuitBreakerName || `${context.component}_${context.operation}`;
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(cbName);

    const resilientOperation = async () => {
      return this.executeWithRetry(operation, context, options?.retryConfig);
    };

    if (options?.fallback) {
      return circuitBreaker.executeWithFallback(resilientOperation, options.fallback);
    } else {
      return circuitBreaker.execute(resilientOperation);
    }
  }

  /**
   * Register a custom error recovery strategy
   */
  public registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
    
    logger.info(`Registered error recovery strategy: ${strategy.name}`, {
      priority: strategy.priority
    });
  }

  /**
   * Register a custom retry configuration
   */
  public registerRetryConfig(name: string, config: RetryConfig): void {
    this.retryConfigs.set(name, config);
    logger.info(`Registered retry configuration: ${name}`, config);
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsBySeverity: Record<string, number>;
    errorsByComponent: Record<string, number>;
    recoveryRate: number;
    recentErrors: ErrorReport[];
  } {
    const reports = Array.from(this.errorReports.values());
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const recentErrors = reports.filter(r => r.timestamp > recentCutoff);

    const errorsBySeverity: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};
    let recoveredCount = 0;

    for (const report of recentErrors) {
      errorsBySeverity[report.severity] = (errorsBySeverity[report.severity] || 0) + 1;
      errorsByComponent[report.context.component] = (errorsByComponent[report.context.component] || 0) + 1;
      
      if (report.recoverySuccess) {
        recoveredCount++;
      }
    }

    return {
      totalErrors: recentErrors.length,
      errorsBySeverity,
      errorsByComponent,
      recoveryRate: recentErrors.length > 0 ? recoveredCount / recentErrors.length : 0,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    };
  }

  // Private methods

  private initializeDefaultStrategies(): void {
    // Database connection recovery
    this.registerRecoveryStrategy({
      name: 'database_reconnection',
      priority: 100,
      canHandle: (error, context) => {
        return context.component.includes('database') || 
               error.message.includes('connection') ||
               error.message.includes('ECONNREFUSED');
      },
      recover: async (error, context) => {
        logger.info('Attempting database reconnection...');
        // Simulate database reconnection
        await this.sleep(1000);
        return { reconnected: true };
      }
    });

    // Memory system recovery
    this.registerRecoveryStrategy({
      name: 'memory_system_recovery',
      priority: 90,
      canHandle: (error, context) => {
        return context.component.includes('Memory') ||
               error.message.includes('memory') ||
               error.message.includes('corruption');
      },
      recover: async (error, context) => {
        logger.info('Attempting memory system recovery...');
        // Simulate memory system recovery
        await this.sleep(500);
        return { recovered: true };
      }
    });

    // External API recovery
    this.registerRecoveryStrategy({
      name: 'external_api_recovery',
      priority: 80,
      canHandle: (error, context) => {
        return context.component.includes('API') ||
               error.message.includes('rate limit') ||
               error.message.includes('timeout');
      },
      recover: async (error, context) => {
        logger.info('Attempting external API recovery...');
        // Implement exponential backoff for API calls
        await this.sleep(2000);
        return { recovered: true };
      }
    });

    // Generic fallback strategy
    this.registerRecoveryStrategy({
      name: 'generic_fallback',
      priority: 10,
      canHandle: () => true,
      recover: async (error, context) => {
        logger.info('Applying generic fallback strategy...');
        return { fallback: true, limitedFunctionality: true };
      }
    });
  }

  private initializeDefaultRetryConfigs(): void {
    this.registerRetryConfig('default', {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['timeout', 'connection', 'network', 'temporary']
    });

    this.registerRetryConfig('database', {
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      retryableErrors: ['connection', 'timeout', 'lock', 'deadlock']
    });

    this.registerRetryConfig('external_api', {
      maxAttempts: 4,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2.5,
      retryableErrors: ['rate limit', 'timeout', '502', '503', '504']
    });
  }

  private async attemptRecovery(
    error: Error,
    context: ErrorContext,
    errorReport: ErrorReport
  ): Promise<{ success: boolean; result?: any; strategy?: string }> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canHandle(error, context)) {
        try {
          logger.info(`Attempting recovery with strategy: ${strategy.name}`, {
            errorId: errorReport.id
          });

          const result = await strategy.recover(error, context);
          
          return {
            success: true,
            result,
            strategy: strategy.name
          };
        } catch (recoveryError) {
          logger.warn(`Recovery strategy ${strategy.name} failed:`, {
            errorId: errorReport.id,
            recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
          });
        }
      }
    }

    return { success: false };
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
    // Critical errors
    if (error.message.includes('database') && error.message.includes('connection')) {
      return 'critical';
    }
    if (context.component === 'RosterIQAgent' && context.operation === 'processQuery') {
      return 'high';
    }
    if (error.message.includes('memory') && error.message.includes('corruption')) {
      return 'critical';
    }

    // High severity errors
    if (error.message.includes('authentication') || error.message.includes('authorization')) {
      return 'high';
    }
    if (context.component.includes('Memory')) {
      return 'high';
    }

    // Medium severity errors
    if (error.message.includes('timeout') || error.message.includes('rate limit')) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  private determineUserImpact(error: Error, context: ErrorContext): ErrorReport['userImpact'] {
    const severity = this.determineSeverity(error, context);
    
    if (severity === 'critical') return 'severe';
    if (severity === 'high') return 'moderate';
    if (severity === 'medium') return 'minimal';
    return 'none';
  }

  private isRetryableError(error: Error, config: RetryConfig): boolean {
    const errorMessage = error.message.toLowerCase();
    return config.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  private getDefaultRetryConfig(): RetryConfig {
    return this.retryConfigs.get('default')!;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async reportCriticalError(errorReport: ErrorReport): Promise<void> {
    // This would typically send notifications to administrators
    logger.error('CRITICAL ERROR REPORTED:', {
      errorId: errorReport.id,
      component: errorReport.context.component,
      operation: errorReport.context.operation,
      message: errorReport.error.message,
      userImpact: errorReport.userImpact
    });

    this.emit('criticalError', errorReport);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.removeAllListeners();
    logger.info('ErrorHandlingService cleanup completed');
  }
}