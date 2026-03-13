import { EpisodicMemory } from '@/services/EpisodicMemory';
import { DatabaseManager } from '@/services/DatabaseManager';
import { EpisodicEntry } from '@/types/memory';
import { Flag, DataStateSnapshot } from '@/types/domain';
import { ReasoningStep } from '@/types/agent';

// Mock the DatabaseManager
jest.mock('@/services/DatabaseManager');
jest.mock('@/utils/logger');

describe('EpisodicMemory', () => {
  let episodicMemory: EpisodicMemory;
  let mockDbManager: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock database manager
    mockDbManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      executeSQLiteQuery: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn()
    } as any;

    (DatabaseManager.getInstance as jest.Mock).mockReturnValue(mockDbManager);
    
    episodicMemory = new EpisodicMemory();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await episodicMemory.initialize();
      
      expect(mockDbManager.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await episodicMemory.initialize();
      await episodicMemory.initialize();
      
      expect(mockDbManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('storeEntry', () => {
    beforeEach(async () => {
      await episodicMemory.initialize();
    });

    it('should store an episodic entry successfully', async () => {
      const entry = createMockEpisodicEntry();
      
      await episodicMemory.storeEntry(entry);
      
      expect(mockDbManager.executeSQLiteQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO episodic_entries'),
        expect.arrayContaining([
          expect.any(String), // entryId
          entry.sessionId,
          entry.timestamp.toISOString(),
          entry.query,
          entry.response,
          entry.confidence,
          JSON.stringify(entry.toolsUsed),
          JSON.stringify(entry.reasoning),
          expect.any(String) // data state checksum
        ])
      );
    });

    it('should update in-memory structures when storing entry', async () => {
      const entry = createMockEpisodicEntry();
      
      await episodicMemory.storeEntry(entry);
      
      expect(episodicMemory.entries).toContain(entry);
      expect(episodicMemory.sessionIndex.get(entry.sessionId)).toContain(entry);
    });

    it('should handle entries with flags', async () => {
      const entry = createMockEpisodicEntry();
      entry.flags = [createMockFlag()];
      
      await episodicMemory.storeEntry(entry);
      
      expect(episodicMemory.flagIndex.get(entry.sessionId)).toEqual(entry.flags);
    });
  });

  describe('getSessionHistory', () => {
    beforeEach(async () => {
      await episodicMemory.initialize();
    });

    it('should return empty array for non-existent session', async () => {
      const history = await episodicMemory.getSessionHistory('non-existent');
      
      expect(history).toEqual([]);
    });

    it('should return session entries sorted by timestamp (newest first)', async () => {
      const sessionId = 'test-session';
      const entry1 = createMockEpisodicEntry(sessionId, new Date('2024-01-01'));
      const entry2 = createMockEpisodicEntry(sessionId, new Date('2024-01-02'));
      
      await episodicMemory.storeEntry(entry1);
      await episodicMemory.storeEntry(entry2);
      
      const history = await episodicMemory.getSessionHistory(sessionId);
      
      expect(history).toHaveLength(2);
      expect(history[0]?.timestamp).toEqual(entry2.timestamp);
      expect(history[1]?.timestamp).toEqual(entry1.timestamp);
    });
  });

  describe('detectStateChanges', () => {
    beforeEach(async () => {
      await episodicMemory.initialize();
    });

    it('should return empty array for first session', async () => {
      const sessionId = 'new-session';
      const currentState = createMockDataStateSnapshot();
      
      const changes = await episodicMemory.detectStateChanges(sessionId, currentState);
      
      expect(changes).toEqual([]);
    });

    it('should detect roster processing data changes', async () => {
      const sessionId = 'test-session';
      
      // Store initial entry with old state
      const oldState = createMockDataStateSnapshot();
      oldState.rosterProcessingChecksum = 'old-roster-checksum';
      const oldEntry = createMockEpisodicEntry(sessionId);
      oldEntry.dataState = oldState;
      await episodicMemory.storeEntry(oldEntry);
      
      // Detect changes with new state
      const newState = createMockDataStateSnapshot();
      newState.rosterProcessingChecksum = 'new-roster-checksum';
      
      const changes = await episodicMemory.detectStateChanges(sessionId, newState);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]?.type).toBe('data_update');
      expect(changes[0]?.description).toContain('Roster processing data has been updated');
      expect(changes[0]?.affectedData).toContain('roster_processing_details');
    });

    it('should detect operational metrics changes', async () => {
      const sessionId = 'test-session';
      
      // Store initial entry with old state
      const oldState = createMockDataStateSnapshot();
      oldState.operationalMetricsChecksum = 'old-metrics-checksum';
      const oldEntry = createMockEpisodicEntry(sessionId);
      oldEntry.dataState = oldState;
      await episodicMemory.storeEntry(oldEntry);
      
      // Detect changes with new state
      const newState = createMockDataStateSnapshot();
      newState.operationalMetricsChecksum = 'new-metrics-checksum';
      
      const changes = await episodicMemory.detectStateChanges(sessionId, newState);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]?.type).toBe('data_update');
      expect(changes[0]?.description).toContain('Operational metrics data has been updated');
      expect(changes[0]?.affectedData).toContain('aggregated_operational_metrics');
    });

    it('should detect significant metric changes', async () => {
      const sessionId = 'test-session';
      
      // Store initial entry with old metrics
      const oldState = createMockDataStateSnapshot();
      oldState.keyMetrics = { errorRate: 0.1, avgProcessingTime: 100 };
      const oldEntry = createMockEpisodicEntry(sessionId);
      oldEntry.dataState = oldState;
      await episodicMemory.storeEntry(oldEntry);
      
      // Detect changes with significantly different metrics
      const newState = createMockDataStateSnapshot();
      newState.keyMetrics = { errorRate: 0.25, avgProcessingTime: 150 }; // 150% and 50% increases
      
      const changes = await episodicMemory.detectStateChanges(sessionId, newState);
      
      const metricChanges = changes.filter(c => c.type === 'metric_change');
      expect(metricChanges.length).toBeGreaterThan(0);
      
      const errorRateChange = metricChanges.find(c => c.description.includes('errorRate'));
      expect(errorRateChange).toBeDefined();
      expect(errorRateChange!.severity).toBeGreaterThanOrEqual(3); // High severity for >25% change
    });
  });

  describe('pruneMemory', () => {
    beforeEach(async () => {
      await episodicMemory.initialize();
      // Clear previous mock calls from initialization
      mockDbManager.executeSQLiteQuery.mockClear();
    });

    it('should prune entries older than specified age', async () => {
      const maxAgeInDays = 30;
      // Mock all database calls to return arrays
      mockDbManager.executeSQLiteQuery
        .mockResolvedValueOnce({ changes: 5 } as any) // Age-based delete
        .mockResolvedValueOnce([]) // Session counts query (no excess sessions)
        .mockResolvedValue([]); // All subsequent queries return empty arrays
      
      const prunedCount = await episodicMemory.pruneMemory(maxAgeInDays);
      
      expect(prunedCount).toBe(5);
      // Check that DELETE queries were called
      expect(mockDbManager.executeSQLiteQuery).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM episodic_entries\s+WHERE timestamp < \?/),
        expect.arrayContaining([expect.any(String)])
      );
    });

    it('should prune excess entries per session', async () => {
      const maxEntriesPerSession = 50;
      
      // Mock session with excess entries
      mockDbManager.executeSQLiteQuery
        .mockResolvedValueOnce({ changes: 0 } as any) // Age-based delete (no old entries)
        .mockResolvedValueOnce([]) // Age-based flag delete
        .mockResolvedValueOnce([]) // Age-based state change delete
        .mockResolvedValueOnce([{ session_id: 'test-session', entry_count: 75 }]) // Session counts query
        .mockResolvedValueOnce([]) // Delete query for excess entries
        .mockResolvedValue([]); // Subsequent queries from loadFromDatabase
      
      await episodicMemory.pruneMemory(90, maxEntriesPerSession);
      
      // Check that the session count query was called
      expect(mockDbManager.executeSQLiteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT session_id, COUNT(*) as entry_count'),
        expect.arrayContaining([maxEntriesPerSession])
      );
      
      // Check that delete query was called
      expect(mockDbManager.executeSQLiteQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM episodic_entries'),
        expect.arrayContaining(['test-session', 25]) // Should delete 25 excess entries
      );
    });
  });

  describe('getMemoryStats', () => {
    beforeEach(async () => {
      await episodicMemory.initialize();
    });

    it('should return correct memory statistics', async () => {
      // Add some test data
      const entry1 = createMockEpisodicEntry('session1');
      const entry2 = createMockEpisodicEntry('session2');
      entry2.flags = [createMockFlag()];
      
      await episodicMemory.storeEntry(entry1);
      await episodicMemory.storeEntry(entry2);
      
      const stats = episodicMemory.getMemoryStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalFlags).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });
});

// Helper functions to create mock objects

function createMockEpisodicEntry(
  sessionId: string = 'test-session',
  timestamp: Date = new Date()
): EpisodicEntry {
  return {
    sessionId,
    timestamp,
    query: 'Test query',
    response: 'Test response',
    confidence: 0.8,
    toolsUsed: ['data-query', 'analysis'],
    reasoning: [createMockReasoningStep()],
    flags: [],
    dataState: createMockDataStateSnapshot()
  };
}

function createMockReasoningStep(): ReasoningStep {
  return {
    id: 'step-1',
    type: 'analyze',
    description: 'Test reasoning step',
    toolsUsed: ['data-query'],
    evidence: [],
    timestamp: new Date(),
    duration: 1000,
    confidence: 0.9
  };
}

function createMockFlag(): Flag {
  return {
    id: 'flag-1',
    type: 'warning',
    category: 'data_quality',
    message: 'Test flag message',
    severity: 3,
    timestamp: new Date(),
    resolved: false,
    source: 'test-source'
  };
}

function createMockDataStateSnapshot(): DataStateSnapshot {
  return {
    timestamp: new Date(),
    rosterProcessingChecksum: 'roster-checksum-123',
    operationalMetricsChecksum: 'metrics-checksum-456',
    totalRecords: 1000,
    lastModified: new Date(),
    keyMetrics: {
      errorRate: 0.05,
      avgProcessingTime: 120,
      qualityScore: 0.95
    }
  };
}