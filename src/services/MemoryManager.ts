import { EpisodicMemory } from './EpisodicMemory';
import { logger } from '@/utils/logger';
import { 
  EpisodicEntry,
  DiagnosticProcedure,
  KnowledgeFact
} from '@/types/memory';
import { 
  StateChange, 
  DataStateSnapshot,
  SessionState,
  Flag
} from '@/types/domain';

export interface SessionHistory {
  sessionId: string;
  entries: EpisodicEntry[];
  queryCount: number;
  flags: Flag[];
  lastActivity: Date;
  stateChanges: StateChange[];
}

export interface KnowledgeResult {
  fact: KnowledgeFact;
  relevanceScore: number;
  source: string;
}

/**
 * MemoryManager orchestrates all three memory types:
 * - Episodic Memory: Session-based interactions and state tracking
 * - Procedural Memory: Diagnostic workflows and procedures (TODO: Task 3.3)
 * - Semantic Memory: Domain knowledge and embeddings (TODO: Task 3.5)
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private episodicMemory: EpisodicMemory;
  private initialized = false;

  private constructor() {
    this.episodicMemory = new EpisodicMemory();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.episodicMemory.initialize();
      this.initialized = true;
      logger.info('MemoryManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MemoryManager:', error);
      throw error;
    }
  }

  // Episodic Memory Methods

  /**
   * Get complete session history including entries, flags, and state changes
   */
  public async getSessionHistory(sessionId: string): Promise<SessionHistory> {
    this.ensureInitialized();

    const entries = await this.episodicMemory.getSessionHistory(sessionId);
    const flags = await this.episodicMemory.getSessionFlags(sessionId);
    
    // Get state changes for this session from the log
    const allStateChanges = this.episodicMemory.stateChangeLog;
    const sessionStateChanges = allStateChanges.filter(change => 
      entries.some(entry => 
        Math.abs(entry.timestamp.getTime() - change.timestamp.getTime()) < 3600000 // Within 1 hour
      )
    );

    const lastActivity = entries.length > 0 ? entries[0]?.timestamp || new Date() : new Date();

    return {
      sessionId,
      entries,
      queryCount: entries.length,
      flags,
      lastActivity,
      stateChanges: sessionStateChanges
    };
  }

  /**
   * Update episodic memory with a new entry
   */
  public async updateEpisodicMemory(entry: EpisodicEntry): Promise<void> {
    this.ensureInitialized();
    
    await this.episodicMemory.storeEntry(entry);
    
    // Store any flags associated with the entry
    if (entry.flags.length > 0) {
      await this.episodicMemory.addSessionFlags(entry.sessionId, entry.flags);
    }
  }

  /**
   * Detect state changes since the last session
   */
  public async detectStateChanges(
    sessionId: string,
    currentState?: DataStateSnapshot
  ): Promise<StateChange[]> {
    this.ensureInitialized();
    
    if (!currentState) {
      // Generate current state snapshot
      currentState = await this.generateCurrentDataState();
    }
    
    return await this.episodicMemory.detectStateChanges(sessionId, currentState);
  }

  /**
   * Create a new session state
   */
  public async createSessionState(
    sessionId: string,
    userId: string,
    initialContext: string[] = []
  ): Promise<SessionState> {
    this.ensureInitialized();
    
    const currentDataState = await this.generateCurrentDataState();
    
    const sessionState: SessionState = {
      sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      queryCount: 0,
      flags: [],
      dataStateSnapshot: currentDataState,
      activeContext: initialContext
    };
    
    return sessionState;
  }

  /**
   * Update session activity timestamp
   */
  public async updateSessionActivity(sessionId: string): Promise<void> {
    this.ensureInitialized();
    
    // This would typically update a sessions table, but for now we track through episodic entries
    logger.debug(`Updated activity for session ${sessionId}`);
  }

  /**
   * Prune old episodic memory entries
   */
  public async pruneEpisodicMemory(
    maxAgeInDays: number = 90,
    maxEntriesPerSession: number = 100
  ): Promise<number> {
    this.ensureInitialized();
    
    return await this.episodicMemory.pruneMemory(maxAgeInDays, maxEntriesPerSession);
  }

  /**
   * Get memory statistics across all memory types
   */
  public getMemoryStatistics(): {
    episodic: ReturnType<EpisodicMemory['getMemoryStats']>;
    // TODO: Add procedural and semantic stats in future tasks
  } {
    this.ensureInitialized();
    
    return {
      episodic: this.episodicMemory.getMemoryStats()
    };
  }

  // Procedural Memory Methods (Placeholder for Task 3.3)

  /**
   * Load a diagnostic procedure by name
   * TODO: Implement in Task 3.3
   */
  public async loadProcedure(_name: string): Promise<DiagnosticProcedure> {
    throw new Error('Procedural memory not yet implemented. Will be completed in Task 3.3');
  }

  /**
   * Save a diagnostic procedure
   * TODO: Implement in Task 3.3
   */
  public async saveProcedure(_procedure: DiagnosticProcedure): Promise<void> {
    throw new Error('Procedural memory not yet implemented. Will be completed in Task 3.3');
  }

  /**
   * Version a procedure with improvements
   * TODO: Implement in Task 3.3
   */
  public async versionProcedure(_name: string, _changes: string): Promise<string> {
    throw new Error('Procedural memory not yet implemented. Will be completed in Task 3.3');
  }

  // Semantic Memory Methods (Placeholder for Task 3.5)

  /**
   * Query the knowledge base
   * TODO: Implement in Task 3.5
   */
  public async queryKnowledge(_query: string): Promise<KnowledgeResult[]> {
    throw new Error('Semantic memory not yet implemented. Will be completed in Task 3.5');
  }

  /**
   * Update knowledge base with new facts
   * TODO: Implement in Task 3.5
   */
  public async updateKnowledge(_facts: KnowledgeFact[]): Promise<void> {
    throw new Error('Semantic memory not yet implemented. Will be completed in Task 3.5');
  }

  /**
   * Generate embeddings for text
   * TODO: Implement in Task 3.5
   */
  public async generateEmbeddings(_text: string): Promise<number[]> {
    throw new Error('Semantic memory not yet implemented. Will be completed in Task 3.5');
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MemoryManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate current data state snapshot
   * This would typically query the actual data sources
   */
  private async generateCurrentDataState(): Promise<DataStateSnapshot> {
    // TODO: In a real implementation, this would:
    // 1. Query DuckDB for current data checksums
    // 2. Calculate key metrics
    // 3. Get last modified timestamps
    
    // For now, return a placeholder snapshot
    const timestamp = new Date();
    
    return {
      timestamp,
      rosterProcessingChecksum: `roster_${timestamp.getTime()}`,
      operationalMetricsChecksum: `metrics_${timestamp.getTime()}`,
      totalRecords: 0, // Would be calculated from actual data
      lastModified: timestamp,
      keyMetrics: {
        totalFiles: 0,
        errorRate: 0,
        avgProcessingTime: 0,
        qualityScore: 0
      }
    };
  }
}