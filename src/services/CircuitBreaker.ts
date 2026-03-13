import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  uptime: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * CircuitBreaker - Implements circuit breaker pattern for external service calls
 * 
 * Provides automatic failure detection and recovery for external dependencies,
 * preventing cascading failures and allowing graceful degradation.
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private resetTimer?: NodeJS.Timeout;
  private readonly startTime = new Date();

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {
    super();
    this.validateConfig();
    logger.info(`CircuitBreaker initialized: ${name}`, { config });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.emit('stateChange', { from: CircuitBreakerState.OPEN, to: CircuitBreakerState.HALF_OPEN });
        logger.info(`CircuitBreaker ${this.name}: State changed to HALF_OPEN`);
      } else {
        const error = new CircuitBreakerError(
          `CircuitBreaker ${this.name} is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`,
          CircuitBreakerState.OPEN
        );
        this.emit('rejected', { error, stats: this.getStats() });
        throw error;
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with fallback
   */
  public async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        logger.warn(`CircuitBreaker ${this.name}: Using fallback due to circuit breaker`, { error: error.message });
        return await fallback();
      }
      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.emit('reset', { stats: this.getStats() });
    logger.info(`CircuitBreaker ${this.name}: Manually reset`);
  }

  /**
   * Force circuit breaker to open state
   */
  public forceOpen(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.lastFailureTime = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    
    this.emit('stateChange', { from: previousState, to: CircuitBreakerState.OPEN });
    logger.warn(`CircuitBreaker ${this.name}: Forced to OPEN state`);
  }

  /**
   * Check if circuit breaker is healthy
   */
  public isHealthy(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Get failure rate over monitoring period
   */
  public getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.failureCount / this.totalRequests;
  }

  // Private methods

  private validateConfig(): void {
    if (this.config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    if (this.config.resetTimeout <= 0) {
      throw new Error('resetTimeout must be greater than 0');
    }
    if (this.config.monitoringPeriod <= 0) {
      throw new Error('monitoringPeriod must be greater than 0');
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    // Add timeout protection if needed
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`CircuitBreaker ${this.name}: Operation timeout`));
      }, this.config.monitoringPeriod);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.lastFailureTime = undefined;
      this.nextAttemptTime = undefined;
      
      this.emit('stateChange', { from: CircuitBreakerState.HALF_OPEN, to: CircuitBreakerState.CLOSED });
      logger.info(`CircuitBreaker ${this.name}: State changed to CLOSED after successful request`);
    }

    this.emit('success', { stats: this.getStats() });
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    // Check if this is an expected error that shouldn't trigger circuit breaker
    if (this.isExpectedError(error)) {
      this.emit('expectedError', { error, stats: this.getStats() });
      return;
    }

    this.emit('failure', { error, stats: this.getStats() });

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.tripCircuitBreaker();
    } else if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.tripCircuitBreaker();
    }
  }

  private isExpectedError(error: any): boolean {
    if (!this.config.expectedErrors || this.config.expectedErrors.length === 0) {
      return false;
    }

    const errorMessage = error?.message || error?.toString() || '';
    return this.config.expectedErrors.some(expectedError => 
      errorMessage.includes(expectedError)
    );
  }

  private tripCircuitBreaker(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);

    // Set timer to automatically transition to HALF_OPEN
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.emit('stateChange', { from: CircuitBreakerState.OPEN, to: CircuitBreakerState.HALF_OPEN });
        logger.info(`CircuitBreaker ${this.name}: Automatically transitioned to HALF_OPEN`);
      }
    }, this.config.resetTimeout);

    this.emit('stateChange', { from: previousState, to: CircuitBreakerState.OPEN });
    this.emit('circuitOpened', { stats: this.getStats() });
    
    logger.warn(`CircuitBreaker ${this.name}: Circuit breaker OPENED`, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      nextAttemptTime: this.nextAttemptTime
    });
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
    
    this.removeAllListeners();
    logger.info(`CircuitBreaker ${this.name}: Cleanup completed`);
  }
}

/**
 * CircuitBreakerManager - Manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Create or get a circuit breaker
   */
  public getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 10000, // 10 seconds
        expectedErrors: []
      };

      const circuitBreaker = new CircuitBreaker(name, { ...defaultConfig, ...config });
      this.circuitBreakers.set(name, circuitBreaker);
      
      // Forward events
      circuitBreaker.on('stateChange', (event) => {
        logger.info(`CircuitBreaker ${name}: State changed`, event);
      });
      
      circuitBreaker.on('circuitOpened', (event) => {
        logger.error(`CircuitBreaker ${name}: Circuit opened`, event.stats);
      });
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  public resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Get health status of all circuit breakers
   */
  public getHealthStatus(): { healthy: string[]; unhealthy: string[] } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      if (circuitBreaker.isHealthy()) {
        healthy.push(name);
      } else {
        unhealthy.push(name);
      }
    }

    return { healthy, unhealthy };
  }

  /**
   * Cleanup all circuit breakers
   */
  public cleanup(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.cleanup();
    }
    this.circuitBreakers.clear();
    logger.info('CircuitBreakerManager cleanup completed');
  }
}