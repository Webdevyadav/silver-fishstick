import { DatabaseManager } from './DatabaseManager';
import { logger } from '@/utils/logger';
import { 
  EpisodicEntry, 
  EpisodicMemory as IEpisodicMemory 
} from '@/types/memory';
import { 
  Flag, 
  DataStateSnapshot, 
  StateChange
} from '@/types/domain';
import crypto from 'crypto';

export class EpisodicMemory implements IEpisodicMemory {
  public entries: EpisodicEntry[] = [];
  public sessionIndex: Map<string, EpisodicEntry[]> = new Map();
  public flagIndex: Map<string, Flag[]> = new Map();
  public stateChangeLog: StateChange[] = [];

  private dbManager: DatabaseManager;
  private initialized = false;

  constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.dbManager.initialize();
      await this.loadFromDatabase();
      this.initialized = true;
      logger.info('EpisodicMemory initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EpisodicMemory:', error);
      throw error;
    }
  }

  /**
   * Store a new episodic entry with proper indexing
   */
  public async storeEntry(entry: EpisodicEntry): Promise<void> {
    this.ensureInitialized();

    try {
      // Generate unique ID for the entry
      const entryId = this.generateEntryId(entry);
      
      // Store in database
      await this.insertEntryToDatabase(entryId, entry);
      
      // Update in-memory structures
      this.entries.push(entry);
      this.updateSessionIndex(entry);
      this.updateFlagIndex(entry);
      
      logger.debug(`Stored episodic entry for session ${entry.sessionId}`);
    } catch (error) {
      logger.error('Failed to store episodic entry:', error);
      throw error;
    }
  }

  /**
   * Retrieve session history for a given session ID
   */
  public async getSessionHistory(sessionId: string): Promise<EpisodicEntry[]> {
    this.ensureInitialized();
    
    const sessionEntries = this.sessionIndex.get(sessionId) || [];
    
    // Sort by timestamp (most recent first)
    return sessionEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get the last session state for state change detection
   */
  public async getLastSessionState(sessionId: string): Promise<DataStateSnapshot | null> {
    this.ensureInitialized();
    
    const sessionEntries = await this.getSessionHistory(sessionId);
    
    if (sessionEntries.length === 0) {
      return null;
    }
    
    return sessionEntries[0]?.dataState || null;
  }

  /**
   * Detect state changes since the last session
   */
  public async detectStateChanges(
    sessionId: string, 
    currentState: DataStateSnapshot
  ): Promise<StateChange[]> {
    this.ensureInitialized();
    
    const lastState = await this.getLastSessionState(sessionId);
    
    if (!lastState) {
      // First session - no changes to detect
      return [];
    }
    
    const changes: StateChange[] = [];
    
    // Compare checksums for data changes
    if (lastState.rosterProcessingChecksum !== currentState.rosterProcessingChecksum) {
      changes.push({
        id: crypto.randomUUID(),
        type: 'data_update',
        description: 'Roster processing data has been updated',
        affectedData: ['roster_processing_details'],
        timestamp: new Date(),
        severity: 2,
        previousValue: lastState.rosterProcessingChecksum,
        currentValue: currentState.rosterProcessingChecksum
      });
    }
    
    if (lastState.operationalMetricsChecksum !== currentState.operationalMetricsChecksum) {
      changes.push({
        id: crypto.randomUUID(),
        type: 'data_update',
        description: 'Operational metrics data has been updated',
        affectedData: ['aggregated_operational_metrics'],
        timestamp: new Date(),
        severity: 2,
        previousValue: lastState.operationalMetricsChecksum,
        currentValue: currentState.operationalMetricsChecksum
      });
    }
    
    // Compare key metrics for significant changes
    const metricChanges = this.detectMetricChanges(lastState, currentState);
    changes.push(...metricChanges);
    
    // Store detected changes
    if (changes.length > 0) {
      await this.storeStateChanges(sessionId, changes);
    }
    
    return changes;
  }
  /**
   * Get flags for a specific session
   */
  public async getSessionFlags(sessionId: string): Promise<Flag[]> {
    this.ensureInitialized();
    return this.flagIndex.get(sessionId) || [];
  }

  /**
   * Add flags to a session
   */
  public async addSessionFlags(sessionId: string, flags: Flag[]): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Store flags in database
      for (const flag of flags) {
        await this.insertFlagToDatabase(sessionId, flag);
      }
      
      // Update in-memory index
      const existingFlags = this.flagIndex.get(sessionId) || [];
      this.flagIndex.set(sessionId, [...existingFlags, ...flags]);
      
      logger.debug(`Added ${flags.length} flags to session ${sessionId}`);
    } catch (error) {
      logger.error('Failed to add session flags:', error);
      throw error;
    }
  }

  /**
   * Prune old entries based on age and relevance
   */
  public async pruneMemory(
    maxAgeInDays: number = 90,
    maxEntriesPerSession: number = 100
  ): Promise<number> {
    this.ensureInitialized();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    
    let prunedCount = 0;
    
    try {
      // Prune by age
      const ageBasedPruned = await this.pruneByAge(cutoffDate);
      prunedCount += ageBasedPruned;
      
      // Prune by session entry limit (keep most recent)
      const sessionBasedPruned = await this.pruneBySessionLimit(maxEntriesPerSession);
      prunedCount += sessionBasedPruned;
      
      // Rebuild in-memory structures
      await this.loadFromDatabase();
      
      logger.info(`Pruned ${prunedCount} episodic memory entries`);
      return prunedCount;
    } catch (error) {
      logger.error('Failed to prune episodic memory:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  public getMemoryStats(): {
    totalEntries: number;
    totalSessions: number;
    totalFlags: number;
    totalStateChanges: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const totalEntries = this.entries.length;
    const totalSessions = this.sessionIndex.size;
    const totalFlags = Array.from(this.flagIndex.values()).reduce((sum, flags) => sum + flags.length, 0);
    const totalStateChanges = this.stateChangeLog.length;
    
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    if (this.entries.length > 0) {
      const sortedEntries = [...this.entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      oldestEntry = sortedEntries[0]?.timestamp;
      newestEntry = sortedEntries[sortedEntries.length - 1]?.timestamp;
    }
    
    return {
      totalEntries,
      totalSessions,
      totalFlags,
      totalStateChanges,
      ...(oldestEntry && { oldestEntry }),
      ...(newestEntry && { newestEntry })
    };
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EpisodicMemory not initialized. Call initialize() first.');
    }
  }

  private generateEntryId(entry: EpisodicEntry): string {
    const content = `${entry.sessionId}-${entry.timestamp.toISOString()}-${entry.query}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async insertEntryToDatabase(entryId: string, entry: EpisodicEntry): Promise<void> {
    await this.dbManager.insertEncryptedData(
      'episodic_entries',
      {
        id: entryId,
        session_id: entry.sessionId,
        timestamp: entry.timestamp.toISOString(),
        query: entry.query,
        response: entry.response,
        confidence: entry.confidence,
        tools_used: JSON.stringify(entry.toolsUsed),
        reasoning: JSON.stringify(entry.reasoning),
        data_state_checksum: entry.dataState.rosterProcessingChecksum + '|' + entry.dataState.operationalMetricsChecksum
      },
      ['query', 'response', 'reasoning'] // Fields to encrypt
    );
  }

  private async insertFlagToDatabase(sessionId: string, flag: Flag): Promise<void> {
    await this.dbManager.insertEncryptedData(
      'session_flags',
      {
        id: flag.id,
        session_id: sessionId,
        type: flag.type,
        category: flag.category,
        message: flag.message,
        severity: flag.severity,
        resolved: flag.resolved,
        source: flag.source,
        timestamp: flag.timestamp.toISOString()
      },
      ['message'] // Fields to encrypt
    );
  }

  private async storeStateChanges(sessionId: string, changes: StateChange[]): Promise<void> {
    for (const change of changes) {
      await this.dbManager.insertEncryptedData(
        'state_changes',
        {
          id: change.id,
          session_id: sessionId,
          type: change.type,
          description: change.description,
          affected_data: JSON.stringify(change.affectedData),
          severity: change.severity,
          previous_value: change.previousValue ? JSON.stringify(change.previousValue) : null,
          current_value: change.currentValue ? JSON.stringify(change.currentValue) : null,
          timestamp: change.timestamp.toISOString()
        },
        ['description'] // Fields to encrypt
      );
    }
    
    // Add to in-memory log
    this.stateChangeLog.push(...changes);
  }
  private detectMetricChanges(
    lastState: DataStateSnapshot,
    currentState: DataStateSnapshot
  ): StateChange[] {
    const changes: StateChange[] = [];
    const threshold = 0.1; // 10% change threshold
    
    for (const [metric, currentValue] of Object.entries(currentState.keyMetrics)) {
      const previousValue = lastState.keyMetrics[metric];
      
      if (previousValue !== undefined && typeof currentValue === 'number' && typeof previousValue === 'number') {
        const percentChange = Math.abs((currentValue - previousValue) / previousValue);
        
        if (percentChange > threshold) {
          const severity = percentChange > 0.5 ? 4 : percentChange > 0.25 ? 3 : 2;
          
          changes.push({
            id: crypto.randomUUID(),
            type: 'metric_change',
            description: `Significant change detected in ${metric}: ${previousValue} → ${currentValue}`,
            affectedData: [metric],
            timestamp: new Date(),
            severity,
            previousValue,
            currentValue
          });
        }
      }
    }
    
    return changes;
  }

  private updateSessionIndex(entry: EpisodicEntry): void {
    const sessionEntries = this.sessionIndex.get(entry.sessionId) || [];
    sessionEntries.push(entry);
    this.sessionIndex.set(entry.sessionId, sessionEntries);
  }

  private updateFlagIndex(entry: EpisodicEntry): void {
    if (entry.flags.length > 0) {
      const existingFlags = this.flagIndex.get(entry.sessionId) || [];
      this.flagIndex.set(entry.sessionId, [...existingFlags, ...entry.flags]);
    }
  }

  private async loadFromDatabase(): Promise<void> {
    try {
      // Clear in-memory structures
      this.entries = [];
      this.sessionIndex.clear();
      this.flagIndex.clear();
      this.stateChangeLog = [];
      
      // Load episodic entries
      await this.loadEpisodicEntries();
      
      // Load flags
      await this.loadFlags();
      
      // Load state changes
      await this.loadStateChanges();
      
      logger.debug('Loaded episodic memory from database');
    } catch (error) {
      logger.error('Failed to load episodic memory from database:', error);
      throw error;
    }
  }

  private async loadEpisodicEntries(): Promise<void> {
    const sql = `
      SELECT * FROM episodic_entries 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.dbManager.executeSQLiteQueryWithDecryption(sql);
    
    for (const row of rows) {
      const entry: EpisodicEntry = {
        sessionId: row.session_id,
        timestamp: new Date(row.timestamp),
        query: row.query || '[ENCRYPTED]',
        response: row.response || '[ENCRYPTED]',
        confidence: row.confidence,
        toolsUsed: JSON.parse(row.tools_used),
        reasoning: row.reasoning ? JSON.parse(row.reasoning) : [],
        flags: [], // Will be loaded separately
        dataState: this.parseDataStateChecksum(row.data_state_checksum)
      };
      
      this.entries.push(entry);
      this.updateSessionIndex(entry);
    }
  }

  private async loadFlags(): Promise<void> {
    const sql = `
      SELECT * FROM session_flags 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.dbManager.executeSQLiteQueryWithDecryption(sql);
    
    for (const row of rows) {
      const flag: Flag = {
        id: row.id,
        type: row.type,
        category: row.category,
        message: row.message || '[ENCRYPTED]',
        severity: row.severity,
        resolved: Boolean(row.resolved),
        source: row.source,
        timestamp: new Date(row.timestamp)
      };
      
      const sessionFlags = this.flagIndex.get(row.session_id) || [];
      sessionFlags.push(flag);
      this.flagIndex.set(row.session_id, sessionFlags);
      
      // Also add to corresponding episodic entry
      const sessionEntries = this.sessionIndex.get(row.session_id) || [];
      for (const entry of sessionEntries) {
        if (Math.abs(entry.timestamp.getTime() - flag.timestamp.getTime()) < 60000) { // Within 1 minute
          entry.flags.push(flag);
          break;
        }
      }
    }
  }

  private async loadStateChanges(): Promise<void> {
    const sql = `
      SELECT * FROM state_changes 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.dbManager.executeSQLiteQueryWithDecryption(sql);
    
    for (const row of rows) {
      const stateChange: StateChange = {
        id: row.id,
        type: row.type,
        description: row.description || '[ENCRYPTED]',
        affectedData: JSON.parse(row.affected_data),
        timestamp: new Date(row.timestamp),
        severity: row.severity,
        previousValue: row.previous_value ? JSON.parse(row.previous_value) : undefined,
        currentValue: row.current_value ? JSON.parse(row.current_value) : undefined
      };
      
      this.stateChangeLog.push(stateChange);
    }
  }

  private parseDataStateChecksum(checksum: string): DataStateSnapshot {
    const [rosterChecksum, metricsChecksum] = checksum.split('|');
    
    return {
      timestamp: new Date(),
      rosterProcessingChecksum: rosterChecksum || '',
      operationalMetricsChecksum: metricsChecksum || '',
      totalRecords: 0, // Will be populated by actual data
      lastModified: new Date(),
      keyMetrics: {}
    };
  }

  private async pruneByAge(cutoffDate: Date): Promise<number> {
    const sql = `
      DELETE FROM episodic_entries 
      WHERE timestamp < ?
    `;
    
    const result = await this.dbManager.executeSQLiteQuery(sql, [cutoffDate.toISOString()]);
    
    // Also prune related flags and state changes
    await this.dbManager.executeSQLiteQuery(
      'DELETE FROM session_flags WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );
    
    await this.dbManager.executeSQLiteQuery(
      'DELETE FROM state_changes WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );
    
    return (result as any).changes || 0;
  }

  private async pruneBySessionLimit(maxEntriesPerSession: number): Promise<number> {
    let prunedCount = 0;
    
    // Get all sessions with entry counts
    const sessionCountsSQL = `
      SELECT session_id, COUNT(*) as entry_count
      FROM episodic_entries
      GROUP BY session_id
      HAVING entry_count > ?
    `;
    
    const sessionCounts = await this.dbManager.executeSQLiteQuery(sessionCountsSQL, [maxEntriesPerSession]);
    
    for (const session of sessionCounts) {
      const excessCount = session.entry_count - maxEntriesPerSession;
      
      // Delete oldest entries for this session
      const deleteSQL = `
        DELETE FROM episodic_entries
        WHERE id IN (
          SELECT id FROM episodic_entries
          WHERE session_id = ?
          ORDER BY timestamp ASC
          LIMIT ?
        )
      `;
      
      await this.dbManager.executeSQLiteQuery(deleteSQL, [session.session_id, excessCount]);
      prunedCount += excessCount;
    }
    
    return prunedCount;
  }
}