import { StreamingService } from '@/services/StreamingService';
import { SSEConnectionManager } from '@/services/SSEConnectionManager';
import { ReasoningStep } from '@/types/agent';
import { Response } from 'express';

jest.mock('@/services/SSEConnectionManager');

describe('StreamingService', () => {
  let service: StreamingService;
  let mockConnectionManager: jest.Mocked<SSEConnectionManager>;

  beforeEach(() => {
    service = StreamingService.getInstance();
    mockConnectionManager = SSEConnectionManager.getInstance() as jest.Mocked<SSEConnectionManager>;
    mockConnectionManager.broadcastToSession = jest.fn();
  });

  afterEach(() => {
    service.cleanup();
    jest.clearAllMocks();
  });

  describe('streamStep', () => {
    it('should stream a reasoning step to a session', () => {
      const sessionId = 'session-1';
      const step: ReasoningStep = {
        id: 'step-1',
        type: 'analyze',
        description: 'Analyzing query',
        toolsUsed: [],
        evidence: [],
        timestamp: new Date(),
        duration: 100,
        confidence: 0.9
      };

      service.streamStep(sessionId, step);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'step',
          data: step,
          sessionId
        })
      );
    });
  });

  describe('streamResult', () => {
    it('should stream a result to a session', () => {
      const sessionId = 'session-1';
      const result = { data: 'test result' };

      service.streamResult(sessionId, result);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'result',
          data: result,
          sessionId
        })
      );
    });
  });

  describe('streamError', () => {
    it('should stream an error message to a session', () => {
      const sessionId = 'session-1';
      const error = new Error('Test error');

      service.streamError(sessionId, error);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'error',
          sessionId
        })
      );
    });

    it('should handle string errors', () => {
      const sessionId = 'session-1';
      const errorMsg = 'String error message';

      service.streamError(sessionId, errorMsg);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({
            message: errorMsg
          }),
          sessionId
        })
      );
    });
  });

  describe('streamComplete', () => {
    it('should stream completion signal to a session', () => {
      const sessionId = 'session-1';
      const summary = { completed: true, totalSteps: 5 };

      service.streamComplete(sessionId, summary);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'complete',
          data: summary,
          sessionId
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return streaming statistics', () => {
      mockConnectionManager.getTotalConnectionCount = jest.fn().mockReturnValue(5);

      const stats = service.getStats();

      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('pendingBatches');
    });
  });
});
