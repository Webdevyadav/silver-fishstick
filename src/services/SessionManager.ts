import { MemoryManager } from './MemoryManager';
import { logger } from '@/utils/logger';
import { 
  SessionState, 
  DataStateSnapshot,
  StateChange,
  Flag
} from '@/types/domain';
import { EpisodicEntry } from '@/types/memory';
import crypto from 'crypto';

export interface SessionConfig {
  maxSessionDuration: number;
  sessionTimeoutMs: number;
  maxConcurrentSessions: number;
  enableAutoCleanup: boolean;
  contextRetentionDays: number;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  queryCount: number;
  flags: Flag[];
  activeContext: string[];
  stateSnapshot: DataStateSnapshot;
  changesSinceLastSession: StateChange[];
}

export interface SessionArchive {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  totalQueries: number;
  finalFlags: Flag[];
  archiveReason: 'timeout' | 'manual' | 'cleanup' | 'user_logout';
  archiveTimestamp: Date;
}

/**
 * SessionManager - Manages session continuity and context
 * 
 * This class handles session state management, automatic context restoration,
 * "what changed since last session" functionality, session isolation,
 * and session cleanup/archival mechanisms.
 */
export class SessionManager {
  private memoryManager: MemoryManager;
  private config: SessionConfig;
  private activeSessions: Map<string, SessionContext> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private sessionArchives: Map<string, SessionArchive> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private initialized = false;

  constructor(config?: Partial<SessionConfig>) {
    this.memoryManager = MemoryManager.getInstance();
    this.config = {
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
      sessionTimeoutMs: 2 * 60 * 60 * 1000,    // 2 hours
      maxConcurrentSessions: 10,
      enableAutoCleanup: true,
      contextRetentionDays: 30,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.memoryManager.initialize();
      
      if (this.config.enableAutoCleanup) {
        this.startCleanupProcess();
      }
      
      this.initialized = true;
      logger.info('SessionManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SessionManager:', error);
      throw error;
    }
  }

  /**
   * Create a new session with automatic context restoration
   */
  public async createSession(
    userId: string, 
    initialContext: string[] = []
  ): Promise<SessionContext> {
    this.ensureInitialized();

    // Check concurrent session limits
    const userSessionCount = this.getUserSessionCount(userId);
    if (userSessionCount >= this.config.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions (${this.config.maxConcurrentSessions}) exceeded for user ${userId}`);
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();

    // Get current data state snapshot
    const stateSnapshot = await this.getCurrentDataState();

    // Detect changes since last session for this user
    const changesSinceLastSession = await this.detectChangesSinceLastUserSession(userId);

    // Create session context
    const sessionContext: SessionContext = {
      sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      queryCount: 0,
      flags: [],
      activeContext: [...initialContext],
      stateSnapshot,
      changesSinceLastSession
    };

    // Store session
    this.activeSessions.set(sessionId, sessionContext);
    
    // Update user session tracking
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Create session state in memory manager
    const sessionState: SessionState = {
      sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      queryCount: 0,
      flags: [],
      dataStateSnapshot: stateSnapshot,
      activeContext: initialContext
    };

    // Store in episodic memory for persistence
    await this.storeSessionCreation(sessionState, changesSinceLastSession);

    logger.info(`Created session ${sessionId} for user ${userId} with ${changesSinceLastSession.length} changes detected`);
    return sessionContext;
  }

  /**
   * Get session context with automatic restoration
   */
  public async getSession(sessionId: string): Promise<SessionContext | null> {
    this.ensureInitialized();

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      // Try to restore from memory
      return await this.restoreSession(sessionId);
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Update session activity and context
   */
  public async updateSessionActivity(
    sessionId: string, 
    newContext?: string[]
  ): Promise<void> {
    this.ensureInitialized();

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastActivity = new Date();
    session.queryCount++;

    if (newContext) {
      // Merge new context with existing, avoiding duplicates
      const contextSet = new Set([...session.activeContext, ...newContext]);
      session.activeContext = Array.from(contextSet);
    }

    // Update memory manager
    await this.memoryManager.updateSessionActivity(sessionId);

    logger.debug(`Updated activity for session ${sessionId}`);
  }

  /**
   * Get "what changed since last session" for a user
   */
  public async getChangesSinceLastSession(userId: string): Promise<StateChange[]> {
    this.ensureInitialized();

    return await this.detectChangesSinceLastUserSession(userId);
  }

  /**
   * Add flags to a session
   */
  public async addSessionFlags(sessionId: string, flags: Flag[]): Promise<void> {
    this.ensureInitialized();

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.flags.push(...flags);
    session.lastActivity = new Date();

    // Store flags in episodic memory
    await this.memoryManager.addSessionFlags(sessionId, flags);

    logger.debug(`Added ${flags.length} flags to session ${sessionId}`);
  }

  /**
   * Archive a session (manual or automatic)
   */
  public async archiveSession(
    sessionId: string, 
    reason: SessionArchive['archiveReason'] = 'manual'
  ): Promise<void> {
    this.ensureInitialized();

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to archive non-existent session ${sessionId}`);
      return;
    }

    // Create archive record
    const archive: SessionArchive = {
      sessionId,
      userId: session.userId,
      startTime: session.startTime,
      endTime: new Date(),
      totalQueries: session.queryCount,
      finalFlags: [...session.flags],
      archiveReason: reason,
      archiveTimestamp: new Date()
    };

    // Store archive
    this.sessionArchives.set(sessionId, archive);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Update user session tracking
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Store final session state in episodic memory
    await this.storeSessionArchival(session, archive);

    logger.info(`Archived session ${sessionId} for user ${session.userId} (reason: ${reason})`);
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    this.ensureInitialized();

    const now = new Date();
    const expiredSessions: string[] = [];

    // Find expired sessions
    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      const sessionDuration = now.getTime() - session.startTime.getTime();

      if (timeSinceActivity > this.config.sessionTimeoutMs || 
          sessionDuration > this.config.maxSessionDuration) {
        expiredSessions.push(sessionId);
      }
    }

    // Archive expired sessions
    for (const sessionId of expiredSessions) {
      await this.archiveSession(sessionId, 'timeout');
    }

    // Clean up old archives
    const archiveCleanupCount = await this.cleanupOldArchives();

    logger.info(`Cleaned up ${expiredSessions.length} expired sessions and ${archiveCleanupCount} old archives`);
    return expiredSessions.length + archiveCleanupCount;
  }

  /**
   * Get session statistics
   */
  public getSessionStats(): {
    activeSessions: number;
    totalUsers: number;
    archivedSessions: number;
    averageSessionDuration: number;
    averageQueriesPerSession: number;
  } {
    const activeSessions = this.activeSessions.size;
    const totalUsers = this.userSessions.size;
    const archivedSessions = this.sessionArchives.size;

    // Calculate averages from archived sessions
    const archives = Array.from(this.sessionArchives.values());
    const totalDuration = archives.reduce((sum, archive) => 
      sum + (archive.endTime.getTime() - archive.startTime.getTime()), 0);
    const totalQueries = archives.reduce((sum, archive) => sum + archive.totalQueries, 0);

    const averageSessionDuration = archives.length > 0 ? totalDuration / archives.length : 0;
    const averageQueriesPerSession = archives.length > 0 ? totalQueries / archives.length : 0;

    return {
      activeSessions,
      totalUsers,
      archivedSessions,
      averageSessionDuration,
      averageQueriesPerSession
    };
  }

  /**
   * Ensure session isolation - verify no cross-contamination
   */
  public validateSessionIsolation(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Check that session data is properly isolated
    const userSessions = this.userSessions.get(session.userId);
    if (!userSessions || !userSessions.has(sessionId)) {
      logger.error(`Session isolation violation: session ${sessionId} not properly tracked for user ${session.userId}`);
      return false;
    }

    // Verify no data leakage between sessions
    for (const [otherSessionId, otherSession] of this.activeSessions) {
      if (otherSessionId !== sessionId && otherSession.userId !== session.userId) {
        // Check for any shared references (should not happen)
        if (otherSession.flags === session.flags || 
            otherSession.activeContext === session.activeContext) {
          logger.error(`Session isolation violation: shared references between ${sessionId} and ${otherSessionId}`);
          return false;
        }
      }
    }

    return true;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SessionManager not initialized. Call initialize() first.');
    }
  }

  private getUserSessionCount(userId: string): number {
    const userSessions = this.userSessions.get(userId);
    return userSessions ? userSessions.size : 0;
  }

  private async getCurrentDataState(): Promise<DataStateSnapshot> {
    // TODO: In a real implementation, this would query actual data sources
    const timestamp = new Date();
    
    return {
      timestamp,
      rosterProcessingChecksum: `roster_${timestamp.getTime()}`,
      operationalMetricsChecksum: `metrics_${timestamp.getTime()}`,
      totalRecords: Math.floor(Math.random() * 10000) + 1000,
      lastModified: timestamp,
      keyMetrics: {
        totalFiles: Math.floor(Math.random() * 1000) + 500,
        errorRate: Math.random() * 0.1,
        avgProcessingTime: Math.floor(Math.random() * 300) + 60,
        qualityScore: 0.8 + Math.random() * 0.2
      }
    };
  }

  private async detectChangesSinceLastUserSession(userId: string): Promise<StateChange[]> {
    try {
      // Get the most recent session for this user from archives
      const userArchives = Array.from(this.sessionArchives.values())
        .filter(archive => archive.userId === userId)
        .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

      if (userArchives.length === 0) {
        // No previous sessions, no changes to detect
        return [];
      }

      const lastSession = userArchives[0];
      const lastSessionId = lastSession.sessionId;

      // Use memory manager to detect changes since last session
      return await this.memoryManager.detectStateChanges(lastSessionId);

    } catch (error) {
      logger.error('Failed to detect changes since last session:', error);
      return [];
    }
  }

  private async restoreSession(sessionId: string): Promise<SessionContext | null> {
    try {
      // Try to restore from episodic memory
      const sessionHistory = await this.memoryManager.getSessionHistory(sessionId);
      
      if (sessionHistory.entries.length === 0) {
        return null;
      }

      // Find session in archives
      const archive = this.sessionArchives.get(sessionId);
      if (!archive) {
        return null;
      }

      // Restore session context (but don't make it active)
      const restoredContext: SessionContext = {
        sessionId,
        userId: archive.userId,
        startTime: archive.startTime,
        lastActivity: archive.endTime,
        queryCount: archive.totalQueries,
        flags: [...archive.finalFlags],
        activeContext: [], // Context not preserved in archive
        stateSnapshot: await this.getCurrentDataState(), // Get fresh state
        changesSinceLastSession: []
      };

      logger.info(`Restored session ${sessionId} from archive`);
      return restoredContext;

    } catch (error) {
      logger.error(`Failed to restore session ${sessionId}:`, error);
      return null;
    }
  }

  private async storeSessionCreation(
    sessionState: SessionState, 
    changes: StateChange[]
  ): Promise<void> {
    // Create episodic entry for session creation
    const entry: EpisodicEntry = {
      sessionId: sessionState.sessionId,
      timestamp: sessionState.startTime,
      query: 'SESSION_CREATED',
      response: `Session created for user ${sessionState.userId}${changes.length > 0 ? ` with ${changes.length} changes detected` : ''}`,
      flags: sessionState.flags,
      dataState: sessionState.dataStateSnapshot,
      toolsUsed: ['session_manager'],
      confidence: 1.0,
      reasoning: [{
        id: crypto.randomUUID(),
        type: 'analyze',
        description: 'Session creation and change detection',
        toolsUsed: ['session_manager'],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 1.0
      }]
    };

    await this.memoryManager.updateEpisodicMemory(entry);
  }

  private async storeSessionArchival(
    session: SessionContext, 
    archive: SessionArchive
  ): Promise<void> {
    // Create episodic entry for session archival
    const entry: EpisodicEntry = {
      sessionId: session.sessionId,
      timestamp: archive.archiveTimestamp,
      query: 'SESSION_ARCHIVED',
      response: `Session archived after ${session.queryCount} queries (reason: ${archive.archiveReason})`,
      flags: session.flags,
      dataState: session.stateSnapshot,
      toolsUsed: ['session_manager'],
      confidence: 1.0,
      reasoning: [{
        id: crypto.randomUUID(),
        type: 'conclude',
        description: 'Session archival and cleanup',
        toolsUsed: ['session_manager'],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 1.0
      }]
    };

    await this.memoryManager.updateEpisodicMemory(entry);
  }

  private startCleanupProcess(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Error in session cleanup process:', error);
      }
    }, 60 * 60 * 1000);

    logger.info('Started automatic session cleanup process');
  }

  private async cleanupOldArchives(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.contextRetentionDays);

    let cleanedCount = 0;
    
    for (const [sessionId, archive] of this.sessionArchives) {
      if (archive.archiveTimestamp < cutoffDate) {
        this.sessionArchives.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      delete this.cleanupInterval;
    }

    logger.info('SessionManager shutdown complete');
  }
}