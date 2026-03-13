import { SSEConnectionManager } from './SSEConnectionManager';
import { StreamingResponse } from '@/types/api';
import { ReasoningStep } from '@/types/agent';
import { logger } from '@/utils/logger';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

export interface StreamOptions {
  compress?: boolean;
  compressionThreshold?: number; // bytes
  batchSize?: number;
  batchDelay?: number; // milliseconds
}

export class StreamingService {
  private static instance: StreamingService;
  private connectionManager: SSEConnectionManager;
  private messageBatches: Map<string, StreamingResponse[]>;
  private batchTimers: Map<string, NodeJS.Timeout>;
  private readonly DEFAULT_COMPRESSION_THRESHOLD = 1024; // 1KB
  private readonly DEFAULT_BATCH_SIZE = 10;
  private readonly DEFAULT_BATCH_DELAY = 100; // 100ms

  private constructor() {
    this.connectionManager = SSEConnectionManager.getInstance();
    this.messageBatches = new Map();
    this.batchTimers = new Map();
  }

  public static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  /**
   * Stream a reasoning step to a session
   */
  public streamStep(
    sessionId: string,
    step: ReasoningStep,
    options?: StreamOptions
  ): void {
    const message: StreamingResponse = {
      type: 'step',
      data: step,
      timestamp: new Date(),
      sessionId
    };

    this.sendMessage(sessionId, message, options);
  }

  /**
   * Stream a result to a session
   */
  public streamResult(
    sessionId: string,
    result: any,
    options?: StreamOptions
  ): void {
    const message: StreamingResponse = {
      type: 'result',
      data: result,
      timestamp: new Date(),
      sessionId
    };

    this.sendMessage(sessionId, message, options);
  }

  /**
   * Stream an error to a session
   */
  public streamError(
    sessionId: string,
    error: Error | string,
    options?: StreamOptions
  ): void {
    const message: StreamingResponse = {
      type: 'error',
      data: {
        message: typeof error === 'string' ? error : error.message,
        stack: typeof error === 'object' ? error.stack : undefined
      },
      timestamp: new Date(),
      sessionId
    };

    this.sendMessage(sessionId, message, options);
  }

  /**
   * Stream completion signal to a session
   */
  public streamComplete(
    sessionId: string,
    summary?: any,
    options?: StreamOptions
  ): void {
    const message: StreamingResponse = {
      type: 'complete',
      data: summary || { completed: true },
      timestamp: new Date(),
      sessionId
    };

    this.sendMessage(sessionId, message, options);
  }

  /**
   * Send a message to a session with optional batching and compression
   */
  private sendMessage(
    sessionId: string,
    message: StreamingResponse,
    options?: StreamOptions
  ): void {
    const batchSize = options?.batchSize || this.DEFAULT_BATCH_SIZE;
    const batchDelay = options?.batchDelay || this.DEFAULT_BATCH_DELAY;

    // If batching is enabled
    if (batchSize > 1) {
      this.addToBatch(sessionId, message, batchSize, batchDelay);
    } else {
      this.sendImmediately(sessionId, message, options);
    }
  }

  /**
   * Add message to batch
   */
  private addToBatch(
    sessionId: string,
    message: StreamingResponse,
    batchSize: number,
    batchDelay: number
  ): void {
    if (!this.messageBatches.has(sessionId)) {
      this.messageBatches.set(sessionId, []);
    }

    const batch = this.messageBatches.get(sessionId)!;
    batch.push(message);

    // Send batch if it reaches the size limit
    if (batch.length >= batchSize) {
      this.flushBatch(sessionId);
    } else {
      // Set up timer to flush batch after delay
      this.resetBatchTimer(sessionId, batchDelay);
    }
  }

  /**
   * Reset batch timer
   */
  private resetBatchTimer(sessionId: string, delay: number): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushBatch(sessionId);
    }, delay);

    this.batchTimers.set(sessionId, timer);
  }

  /**
   * Flush batch for a session
   */
  private flushBatch(sessionId: string): void {
    const batch = this.messageBatches.get(sessionId);
    if (!batch || batch.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(sessionId);
    }

    // Send all messages in batch
    for (const message of batch) {
      this.sendImmediately(sessionId, message);
    }

    // Clear batch
    this.messageBatches.set(sessionId, []);
  }

  /**
   * Send message immediately
   */
  private async sendImmediately(
    sessionId: string,
    message: StreamingResponse,
    options?: StreamOptions
  ): Promise<void> {
    try {
      // Check if compression is needed
      const messageStr = JSON.stringify(message);
      const threshold = options?.compressionThreshold || this.DEFAULT_COMPRESSION_THRESHOLD;

      if (options?.compress && messageStr.length > threshold) {
        await this.sendCompressed(sessionId, message);
      } else {
        this.connectionManager.broadcastToSession(sessionId, message);
      }
    } catch (error) {
      logger.error('Failed to send streaming message', {
        sessionId,
        error
      });
    }
  }

  /**
   * Send compressed message
   */
  private async sendCompressed(
    sessionId: string,
    message: StreamingResponse
  ): Promise<void> {
    try {
      const messageStr = JSON.stringify(message);
      const compressed = await gzip(Buffer.from(messageStr));
      const base64 = compressed.toString('base64');

      const compressedMessage: StreamingResponse = {
        type: message.type,
        data: {
          compressed: true,
          data: base64,
          originalSize: messageStr.length,
          compressedSize: base64.length
        },
        timestamp: message.timestamp,
        sessionId: message.sessionId
      };

      this.connectionManager.broadcastToSession(sessionId, compressedMessage);

      logger.debug('Sent compressed message', {
        sessionId,
        originalSize: messageStr.length,
        compressedSize: base64.length,
        compressionRatio: (base64.length / messageStr.length).toFixed(2)
      });
    } catch (error) {
      logger.error('Failed to compress message', { sessionId, error });
      // Fallback to uncompressed
      this.connectionManager.broadcastToSession(sessionId, message);
    }
  }

  /**
   * Get streaming statistics
   */
  public getStats(): {
    connections: number;
    sessions: number;
    pendingBatches: number;
  } {
    return {
      connections: this.connectionManager.getTotalConnectionCount(),
      sessions: this.messageBatches.size,
      pendingBatches: Array.from(this.messageBatches.values())
        .reduce((sum, batch) => sum + batch.length, 0)
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Flush all pending batches
    for (const sessionId of this.messageBatches.keys()) {
      this.flushBatch(sessionId);
    }

    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }

    this.messageBatches.clear();
    this.batchTimers.clear();
  }
}
