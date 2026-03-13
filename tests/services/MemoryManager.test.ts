import { MemoryManager } from '@/services/MemoryManager';
import { EpisodicMemory } from '@/services/EpisodicMemory';
import { EpisodicEntry } from '@/types/memory';
import { DataStateSnapshot, Flag } from '@/types/domain';

// Mock the EpisodicMemory
jest.mock('@/services/EpisodicMemory');
jest.mock('@/utils/logger');

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let mockEpisodicMemory: jest.Mocked<EpisodicMemory>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock episodic memory
    mockEpisodicMemory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      storeEntry: jest.fn().mockResolvedValue(undefined),
      getSessionHistory: jest.fn().mockResolvedValue([]),
      getSessionFlags: jest.fn().mockResolvedValue([]),
      addSessionFlags: jest.fn().mockResolvedValue(undefined),
      detectStateChanges: jest.fn().mockResolvedValue([]),
      pruneMemory: jest.fn().mockResolvedValue(0),
      getMemoryStats: jest.fn().mockReturnValue({
        totalEntries: 0,
        totalSessions: 0,
        totalFlags: 0,
        totalStateChanges: 0
      }),
      stateChangeLog: []
    } as any;

    (EpisodicMemory as jest.Mock).mockImplementation(() => mockEpisodicMemory);
    
    // Get fresh instance
    (MemoryManager as any).instance = undefined;
    memoryManager = MemoryManager.getInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MemoryManager.getInstance();
      const instance2 = MemoryManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize episodic memory', async () => {
      await memoryManager.initialize();
      
      expect(mockEpisodicMemory.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await memoryManager.initialize();
      await memoryManager.initialize();
      
      expect(mockEpisodicMemory.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSessionHistory', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should return complete session history', async () => {
      const sessionId = 'test-session';
      const mockEntries = [createMockEpisodicEntry(sessionId)];
      const mockFlags = [createMockFlag()];
      
      mockEpisodicMemory.getSessionHistory.mockResolvedValue(mockEntries);
      mockEpisodicMemory.getSessionFlags.mockResolvedValue(mockFlags);
      
      const history = await memoryManager.getSessionHistory(sessionId);
      
      expect(history.sessionId).toBe(sessionId);
      expect(history.entries).toEqual(mockEntries);
      expect(history.flags).toEqual(mockFlags);
      expect(history.queryCount).toBe(mockEntries.length);
      expect(history.lastActivity).toEqual(mockEntries[0]?.timestamp);
    });

    it('should handle empty session history', async () => {
      const sessionId = 'empty-session';
      
      mockEpisodicMemory.getSessionHistory.mockResolvedValue([]);
      mockEpisodicMemory.getSessionFlags.mockResolvedValue([]);
      
      const history = await memoryManager.getSessionHistory(sessionId);
      
      expect(history.entries).toEqual([]);
      expect(history.flags).toEqual([]);
      expect(history.queryCount).toBe(0);
    });
  });

  describe('updateEpisodicMemory', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should store entry in episodic memory', async () => {
      const entry = createMockEpisodicEntry();
      
      await memoryManager.updateEpisodicMemory(entry);
      
      expect(mockEpisodicMemory.storeEntry).toHaveBeenCalledWith(entry);
    });

    it('should store flags when entry has flags', async () => {
      const entry = createMockEpisodicEntry();
      entry.flags = [createMockFlag()];
      
      await memoryManager.updateEpisodicMemory(entry);
      
      expect(mockEpisodicMemory.storeEntry).toHaveBeenCalledWith(entry);
      expect(mockEpisodicMemory.addSessionFlags).toHaveBeenCalledWith(
        entry.sessionId,
        entry.flags
      );
    });

    it('should not store flags when entry has no flags', async () => {
      const entry = createMockEpisodicEntry();
      entry.flags = [];
      
      await memoryManager.updateEpisodicMemory(entry);
      
      expect(mockEpisodicMemory.storeEntry).toHaveBeenCalledWith(entry);
      expect(mockEpisodicMemory.addSessionFlags).not.toHaveBeenCalled();
    });
  });

  describe('detectStateChanges', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should detect state changes with provided current state', async () => {
      const sessionId = 'test-session';
      const currentState = createMockDataStateSnapshot();
      const mockChanges = [createMockStateChange()];
      
      mockEpisodicMemory.detectStateChanges.mockResolvedValue(mockChanges);
      
      const changes = await memoryManager.detectStateChanges(sessionId, currentState);
      
      expect(mockEpisodicMemory.detectStateChanges).toHaveBeenCalledWith(
        sessionId,
        currentState
      );
      expect(changes).toEqual(mockChanges);
    });

    it('should generate current state when not provided', async () => {
      const sessionId = 'test-session';
      const mockChanges = [createMockStateChange()];
      
      mockEpisodicMemory.detectStateChanges.mockResolvedValue(mockChanges);
      
      const changes = await memoryManager.detectStateChanges(sessionId);
      
      expect(mockEpisodicMemory.detectStateChanges).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          timestamp: expect.any(Date),
          rosterProcessingChecksum: expect.any(String),
          operationalMetricsChecksum: expect.any(String)
        })
      );
      expect(changes).toEqual(mockChanges);
    });
  });

  describe('createSessionState', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should create new session state', async () => {
      const sessionId = 'new-session';
      const userId = 'user-123';
      const initialContext = ['context1', 'context2'];
      
      const sessionState = await memoryManager.createSessionState(
        sessionId,
        userId,
        initialContext
      );
      
      expect(sessionState.sessionId).toBe(sessionId);
      expect(sessionState.userId).toBe(userId);
      expect(sessionState.activeContext).toEqual(initialContext);
      expect(sessionState.queryCount).toBe(0);
      expect(sessionState.flags).toEqual([]);
      expect(sessionState.startTime).toBeInstanceOf(Date);
      expect(sessionState.dataStateSnapshot).toBeDefined();
    });

    it('should create session state with empty context by default', async () => {
      const sessionId = 'new-session';
      const userId = 'user-123';
      
      const sessionState = await memoryManager.createSessionState(sessionId, userId);
      
      expect(sessionState.activeContext).toEqual([]);
    });
  });

  describe('pruneEpisodicMemory', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should prune episodic memory with default parameters', async () => {
      const expectedPrunedCount = 10;
      mockEpisodicMemory.pruneMemory.mockResolvedValue(expectedPrunedCount);
      
      const prunedCount = await memoryManager.pruneEpisodicMemory();
      
      expect(mockEpisodicMemory.pruneMemory).toHaveBeenCalledWith(90, 100);
      expect(prunedCount).toBe(expectedPrunedCount);
    });

    it('should prune episodic memory with custom parameters', async () => {
      const maxAgeInDays = 30;
      const maxEntriesPerSession = 50;
      const expectedPrunedCount = 5;
      
      mockEpisodicMemory.pruneMemory.mockResolvedValue(expectedPrunedCount);
      
      const prunedCount = await memoryManager.pruneEpisodicMemory(
        maxAgeInDays,
        maxEntriesPerSession
      );
      
      expect(mockEpisodicMemory.pruneMemory).toHaveBeenCalledWith(
        maxAgeInDays,
        maxEntriesPerSession
      );
      expect(prunedCount).toBe(expectedPrunedCount);
    });
  });

  describe('getMemoryStatistics', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should return memory statistics', () => {
      const mockStats = {
        totalEntries: 100,
        totalSessions: 10,
        totalFlags: 5,
        totalStateChanges: 3,
        oldestEntry: new Date('2024-01-01'),
        newestEntry: new Date('2024-01-31')
      };
      
      mockEpisodicMemory.getMemoryStats.mockReturnValue(mockStats);
      
      const stats = memoryManager.getMemoryStatistics();
      
      expect(stats.episodic).toEqual(mockStats);
    });
  });

  describe('placeholder methods', () => {
    beforeEach(async () => {
      await memoryManager.initialize();
    });

    it('should throw error for loadProcedure (not yet implemented)', async () => {
      await expect(memoryManager.loadProcedure('test-procedure'))
        .rejects.toThrow('Procedural memory not yet implemented');
    });

    it('should throw error for queryKnowledge (not yet implemented)', async () => {
      await expect(memoryManager.queryKnowledge('test query'))
        .rejects.toThrow('Semantic memory not yet implemented');
    });

    it('should throw error for generateEmbeddings (not yet implemented)', async () => {
      await expect(memoryManager.generateEmbeddings('test text'))
        .rejects.toThrow('Semantic memory not yet implemented');
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      expect(() => memoryManager.getMemoryStatistics())
        .toThrow('MemoryManager not initialized');
    });
  });
});

// Helper functions

function createMockEpisodicEntry(sessionId: string = 'test-session'): EpisodicEntry {
  return {
    sessionId,
    timestamp: new Date(),
    query: 'Test query',
    response: 'Test response',
    confidence: 0.8,
    toolsUsed: ['data-query'],
    reasoning: [],
    flags: [],
    dataState: createMockDataStateSnapshot()
  };
}

function createMockFlag(): Flag {
  return {
    id: 'flag-1',
    type: 'warning',
    category: 'data_quality',
    message: 'Test flag',
    severity: 3,
    timestamp: new Date(),
    resolved: false,
    source: 'test'
  };
}

function createMockDataStateSnapshot(): DataStateSnapshot {
  return {
    timestamp: new Date(),
    rosterProcessingChecksum: 'roster-123',
    operationalMetricsChecksum: 'metrics-456',
    totalRecords: 1000,
    lastModified: new Date(),
    keyMetrics: { errorRate: 0.05 }
  };
}

function createMockStateChange() {
  return {
    id: 'change-1',
    type: 'data_update' as const,
    description: 'Test change',
    affectedData: ['test-data'],
    timestamp: new Date(),
    severity: 2 as const
  };
}