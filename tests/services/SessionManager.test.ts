import { SessionManager } from '@/services/SessionManager';
import { MemoryManager } from '@/services/MemoryManager';
import { StateChange, Flag } from '@/types/domain';
import fc from 'fast-check';

// Mock the MemoryManager
jest.mock('@/services/MemoryManager');
const MockedMemoryManager = jest.mocked(MemoryManager);

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockMemoryManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getSessionHistory: jest.fn().mockResolvedValue({
        sessionId: 'test-session',
        entries: [],
        queryCount: 0,
        flags: [],
        lastActivity: new Date(),
        stateChanges: []
      }),
      detectStateChanges: jest.fn().mockResolvedValue([]),
      updateEpisodicMemory: jest.fn().mockResolvedValue(undefined),
      updateSessionActivity: jest.fn().mockResolvedValue(undefined),
      addSessionFlags: jest.fn().mockResolvedValue(undefined)
    } as any;

    (MockedMemoryManager.getInstance as jest.Mock).mockReturnValue(mockMemoryManager);

    sessionManager = new SessionManager({
      maxSessionDuration: 60000, // 1 minute for testing
      sessionTimeoutMs: 30000,   // 30 seconds for testing
      maxConcurrentSessions: 3,
      enableAutoCleanup: false,  // Disable for testing
      contextRetentionDays: 1
    });

    await sessionManager.initialize();
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  describe('Unit Tests', () => {
    describe('createSession', () => {
      it('should create a new session successfully', async () => {
        const userId = 'user-123';
        const initialContext = ['context1', 'context2'];

        const session = await sessionManager.createSession(userId, initialContext);

        expect(session).toBeDefined();
        expect(session.sessionId).toBeTruthy();
        expect(session.userId).toBe(userId);
        expect(session.activeContext).toEqual(initialContext);
        expect(session.queryCount).toBe(0);
        expect(session.flags).toEqual([]);
        expect(session.startTime).toBeInstanceOf(Date);
        expect(session.lastActivity).toBeInstanceOf(Date);
        expect(session.stateSnapshot).toBeDefined();
        expect(session.changesSinceLastSession).toBeInstanceOf(Array);
      });

      it('should enforce concurrent session limits', async () => {
        const userId = 'user-limit-test';

        // Create maximum allowed sessions
        await sessionManager.createSession(userId);
        await sessionManager.createSession(userId);
        await sessionManager.createSession(userId);

        // Fourth session should fail
        await expect(
          sessionManager.createSession(userId)
        ).rejects.toThrow('Maximum concurrent sessions');
      });

      it('should detect changes since last session', async () => {
        const userId = 'user-changes';
        const mockChanges: StateChange[] = [{
          id: 'change-1',
          type: 'data_update',
          description: 'Data updated',
          affectedData: ['roster'],
          timestamp: new Date(),
          severity: 2
        }];

        mockMemoryManager.detectStateChanges.mockResolvedValue(mockChanges);

        const session = await sessionManager.createSession(userId);

        expect(session.changesSinceLastSession).toEqual(mockChanges);
      });
    });

    describe('getSession', () => {
      it('should retrieve existing session', async () => {
        const userId = 'user-retrieve';
        const createdSession = await sessionManager.createSession(userId);

        const retrievedSession = await sessionManager.getSession(createdSession.sessionId);

        expect(retrievedSession).toBeDefined();
        expect(retrievedSession!.sessionId).toBe(createdSession.sessionId);
        expect(retrievedSession!.userId).toBe(userId);
      });

      it('should return null for non-existent session', async () => {
        const session = await sessionManager.getSession('non-existent-session');
        expect(session).toBeNull();
      });

      it('should update last activity when retrieving session', async () => {
        const userId = 'user-activity';
        const createdSession = await sessionManager.createSession(userId);
        const originalActivity = createdSession.lastActivity;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        const retrievedSession = await sessionManager.getSession(createdSession.sessionId);

        expect(retrievedSession!.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      });
    });

    describe('updateSessionActivity', () => {
      it('should update session activity and query count', async () => {
        const userId = 'user-update';
        const session = await sessionManager.createSession(userId);
        const originalActivity = session.lastActivity;
        const originalQueryCount = session.queryCount;

        await new Promise(resolve => setTimeout(resolve, 10));

        await sessionManager.updateSessionActivity(session.sessionId);

        const updatedSession = await sessionManager.getSession(session.sessionId);

        expect(updatedSession!.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
        expect(updatedSession!.queryCount).toBe(originalQueryCount + 1);
      });

      it('should merge new context with existing context', async () => {
        const userId = 'user-context';
        const session = await sessionManager.createSession(userId, ['initial1', 'initial2']);

        await sessionManager.updateSessionActivity(session.sessionId, ['new1', 'initial1', 'new2']);

        const updatedSession = await sessionManager.getSession(session.sessionId);

        expect(updatedSession!.activeContext).toContain('initial1');
        expect(updatedSession!.activeContext).toContain('initial2');
        expect(updatedSession!.activeContext).toContain('new1');
        expect(updatedSession!.activeContext).toContain('new2');
        // Should not have duplicates
        expect(updatedSession!.activeContext.filter(c => c === 'initial1').length).toBe(1);
      });

      it('should throw error for non-existent session', async () => {
        await expect(
          sessionManager.updateSessionActivity('non-existent')
        ).rejects.toThrow('Session non-existent not found');
      });
    });

    describe('addSessionFlags', () => {
      it('should add flags to session', async () => {
        const userId = 'user-flags';
        const session = await sessionManager.createSession(userId);

        const flags: Flag[] = [{
          id: 'flag-1',
          type: 'warning',
          category: 'performance',
          message: 'Test warning',
          severity: 3,
          timestamp: new Date(),
          resolved: false,
          source: 'test'
        }];

        await sessionManager.addSessionFlags(session.sessionId, flags);

        const updatedSession = await sessionManager.getSession(session.sessionId);

        expect(updatedSession!.flags).toEqual(flags);
        expect(mockMemoryManager.addSessionFlags).toHaveBeenCalledWith(session.sessionId, flags);
      });
    });

    describe('archiveSession', () => {
      it('should archive session successfully', async () => {
        const userId = 'user-archive';
        const session = await sessionManager.createSession(userId);

        await sessionManager.archiveSession(session.sessionId, 'manual');

        // Session should no longer be active
        const retrievedSession = await sessionManager.getSession(session.sessionId);
        expect(retrievedSession).toBeNull();

        // Stats should reflect the change
        const stats = sessionManager.getSessionStats();
        expect(stats.archivedSessions).toBe(1);
        expect(stats.activeSessions).toBe(0);
      });

      it('should handle archiving non-existent session gracefully', async () => {
        // Should not throw error
        await sessionManager.archiveSession('non-existent', 'manual');
      });
    });

    describe('cleanupExpiredSessions', () => {
      it('should clean up expired sessions', async () => {
        const userId = 'user-cleanup';
        const session = await sessionManager.createSession(userId);

        // Manually set session to be expired by modifying the internal state
        const activeSessions = (sessionManager as any).activeSessions;
        const sessionData = activeSessions.get(session.sessionId);
        if (sessionData) {
          sessionData.lastActivity = new Date(Date.now() - 60000); // 1 minute ago
        }

        const cleanedCount = await sessionManager.cleanupExpiredSessions();

        expect(cleanedCount).toBeGreaterThan(0);
        
        // Session should be archived
        const stats = sessionManager.getSessionStats();
        expect(stats.activeSessions).toBe(0);
        expect(stats.archivedSessions).toBeGreaterThan(0);
      });
    });

    describe('validateSessionIsolation', () => {
      it('should validate proper session isolation', async () => {
        const user1 = 'user1';
        const user2 = 'user2';
        
        const session1 = await sessionManager.createSession(user1);
        const session2 = await sessionManager.createSession(user2);

        expect(sessionManager.validateSessionIsolation(session1.sessionId)).toBe(true);
        expect(sessionManager.validateSessionIsolation(session2.sessionId)).toBe(true);
      });

      it('should return false for non-existent session', async () => {
        expect(sessionManager.validateSessionIsolation('non-existent')).toBe(false);
      });
    });
  });

  /**
   * Property 11: Session Isolation
   * 
   * **Validates: Requirements 2.5**
   * 
   * For any user with multiple sessions, state changes and memory updates 
   * in one session should not affect the state tracking of other sessions
   */
  describe('Property 11: Session Isolation', () => {
    it('should maintain complete isolation between different user sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }), // userIds
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 5 }), // context per user
          async (userIds: string[], contextItems: string[]) => {
            // Create unique user IDs to avoid conflicts
            const uniqueUserIds = [...new Set(userIds)];
            if (uniqueUserIds.length < 2) {
              uniqueUserIds.push(`extra-user-${Date.now()}`);
            }

            const sessions = [];

            // Create sessions for different users
            for (let i = 0; i < Math.min(uniqueUserIds.length, 3); i++) {
              const userId = uniqueUserIds[i];
              if (!userId) continue;
              
              const userContext = contextItems.slice(0, 2).map((item: string) => `${userId}-${item}`);
              
              try {
                const session = await sessionManager.createSession(userId, userContext);
                sessions.push(session);
              } catch (error: any) {
                // Skip if we hit concurrent session limits
                if (!error?.message?.includes('Maximum concurrent sessions')) {
                  throw error;
                }
              }
            }

            // Verify each session is properly isolated
            for (let i = 0; i < sessions.length; i++) {
              const session = sessions[i];
              
              // Validate session isolation
              expect(sessionManager.validateSessionIsolation(session?.sessionId || '')).toBe(true);
              
              // Verify session data integrity
              expect(session?.sessionId).toBeTruthy();
              expect(session?.userId).toBeTruthy();
              expect(session?.activeContext).toBeInstanceOf(Array);
              expect(session?.flags).toBeInstanceOf(Array);
              expect(session?.stateSnapshot).toBeDefined();
              
              // Verify no cross-contamination with other sessions
              for (let j = 0; j < sessions.length; j++) {
                if (i !== j) {
                  const otherSession = sessions[j];
                  
                  // Sessions should have different IDs
                  expect(session?.sessionId).not.toBe(otherSession?.sessionId);
                  
                  // Sessions for different users should not share user IDs
                  if (session?.userId !== otherSession?.userId) {
                    expect(session?.userId).not.toBe(otherSession?.userId);
                  }
                  
                  // Context should not be shared between different users
                  if (session?.userId !== otherSession?.userId) {
                    const sharedContext = session?.activeContext.filter(
                      item => otherSession?.activeContext.includes(item)
                    ) || [];
                    expect(sharedContext.length).toBe(0);
                  }
                  
                  // Flags should not be shared (different array instances)
                  expect(session?.flags).not.toBe(otherSession?.flags);
                  
                  // State snapshots should not be shared (different objects)
                  expect(session?.stateSnapshot).not.toBe(otherSession?.stateSnapshot);
                }
              }
            }

            // Clean up sessions
            for (const session of sessions) {
              await sessionManager.archiveSession(session.sessionId, 'manual');
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });

    it('should isolate session updates and modifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 2, maxLength: 4 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('alert', 'warning', 'info', 'success'),
              category: fc.constantFrom('data_quality', 'performance', 'anomaly', 'regulatory'),
              message: fc.string({ minLength: 5, maxLength: 50 }),
              severity: fc.integer({ min: 1, max: 5 }),
              resolved: fc.boolean(),
              source: fc.string({ minLength: 1, maxLength: 10 })
            }),
            { minLength: 0, maxLength: 3 }
          ),
          async (userIds: string[], contextUpdates: string[], flagsData: any[]) => {
            const uniqueUserIds = [...new Set(userIds)].slice(0, 3);
            if (uniqueUserIds.length < 2) {
              return true; // Skip if not enough unique users
            }

            const sessions = [];

            // Create sessions
            for (const userId of uniqueUserIds) {
              try {
                const session = await sessionManager.createSession(userId);
                sessions.push(session);
              } catch (error: any) {
                if (!error?.message?.includes('Maximum concurrent sessions')) {
                  throw error;
                }
              }
            }

            if (sessions.length < 2) {
              return true; // Skip if couldn't create enough sessions
            }

            // Perform isolated updates on each session
            for (let i = 0; i < sessions.length; i++) {
              const session = sessions[i];
              if (!session) continue;
              
              const userContextUpdates = contextUpdates.map((ctx: string) => `${session.userId}-${ctx}-${i}`);
              const userFlags = flagsData.map((flagData: any) => ({
                ...flagData,
                id: `${session.userId}-${flagData.id}`,
                timestamp: new Date(),
                message: `${session.userId}: ${flagData.message}`
              }));

              // Update session activity and context
              await sessionManager.updateSessionActivity(session.sessionId, userContextUpdates);

              // Add flags if any
              if (userFlags.length > 0) {
                await sessionManager.addSessionFlags(session.sessionId, userFlags);
              }
            }

            // Verify isolation after updates
            for (let i = 0; i < sessions.length; i++) {
              const session = sessions[i];
              if (!session) continue;
              
              const updatedSession = await sessionManager.getSession(session.sessionId);
              
              expect(updatedSession).toBeDefined();
              expect(sessionManager.validateSessionIsolation(session.sessionId)).toBe(true);

              // Verify updates are isolated to this session
              for (let j = 0; j < sessions.length; j++) {
                if (i !== j) {
                  const otherSession = sessions[j];
                  if (!otherSession) continue;
                  
                  const otherUpdatedSession = await sessionManager.getSession(otherSession.sessionId);
                  
                  expect(otherUpdatedSession).toBeDefined();
                  
                  // Context should not leak between sessions
                  const contextOverlap = updatedSession!.activeContext.filter(
                    item => otherUpdatedSession!.activeContext.includes(item)
                  );
                  expect(contextOverlap.length).toBe(0);
                  
                  // Flags should not leak between sessions
                  const flagOverlap = updatedSession!.flags.filter(
                    flag => otherUpdatedSession!.flags.some(otherFlag => otherFlag.id === flag.id)
                  );
                  expect(flagOverlap.length).toBe(0);
                  
                  // Query counts should be independent
                  expect(updatedSession!.queryCount).toBeGreaterThanOrEqual(1);
                  // Other sessions might have different query counts
                }
              }
            }

            // Clean up
            for (const session of sessions) {
              await sessionManager.archiveSession(session.sessionId, 'manual');
            }

            return true;
          }
        ),
        { numRuns: 15, timeout: 20000 }
      );
    });

    it('should maintain isolation during concurrent session operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }), // number of concurrent users
          async (numUsers: number) => {
            const userIds = Array.from({ length: numUsers }, (_, i) => `concurrent-user-${i}-${Date.now()}`);
            const sessions = [];

            // Create sessions concurrently
            const sessionPromises = userIds.map(userId => 
              sessionManager.createSession(userId, [`context-${userId}`])
            );

            try {
              const createdSessions = await Promise.all(sessionPromises);
              sessions.push(...createdSessions);
            } catch (error: any) {
              if (!error?.message?.includes('Maximum concurrent sessions')) {
                throw error;
              }
              return true; // Skip if hit limits
            }

            // Perform concurrent operations on sessions
            const operationPromises = sessions.map(async (session, index) => {
              const operations = [
                sessionManager.updateSessionActivity(session.sessionId, [`update-${index}`]),
                sessionManager.addSessionFlags(session.sessionId, [{
                  id: `flag-${session.sessionId}`,
                  type: 'info',
                  category: 'performance',
                  message: `Concurrent flag ${index}`,
                  severity: 1,
                  timestamp: new Date(),
                  resolved: false,
                  source: 'test'
                }])
              ];

              await Promise.all(operations);
              return session;
            });

            const updatedSessions = await Promise.all(operationPromises);

            // Verify isolation after concurrent operations
            for (let i = 0; i < updatedSessions.length; i++) {
              const session = updatedSessions[i];
              if (!session) continue;
              
              const currentSession = await sessionManager.getSession(session.sessionId);
              
              expect(currentSession).toBeDefined();
              expect(sessionManager.validateSessionIsolation(session.sessionId)).toBe(true);
              
              // Verify session-specific data
              expect(currentSession!.activeContext).toContain(`context-${session.userId}`);
              expect(currentSession!.activeContext).toContain(`update-${i}`);
              expect(currentSession!.flags.length).toBeGreaterThan(0);
              expect(currentSession!.flags[0]?.id).toBe(`flag-${session.sessionId}`);
              
              // Verify no contamination from other sessions
              for (let j = 0; j < updatedSessions.length; j++) {
                if (i !== j) {
                  const otherSession = updatedSessions[j];
                  if (!otherSession) continue;
                  
                  // Should not contain other session's context
                  expect(currentSession!.activeContext).not.toContain(`context-${otherSession.userId}`);
                  expect(currentSession!.activeContext).not.toContain(`update-${j}`);
                  
                  // Should not contain other session's flags
                  const hasOtherSessionFlag = currentSession!.flags.some(
                    flag => flag.id === `flag-${otherSession.sessionId}`
                  );
                  expect(hasOtherSessionFlag).toBe(false);
                }
              }
            }

            // Clean up
            for (const session of sessions) {
              await sessionManager.archiveSession(session.sessionId, 'manual');
            }

            return true;
          }
        ),
        { numRuns: 10, timeout: 25000 }
      );
    });

    it('should handle session archival without affecting other sessions', async () => {
      const user1 = 'isolation-user-1';
      const user2 = 'isolation-user-2';
      
      const session1 = await sessionManager.createSession(user1, ['context1']);
      const session2 = await sessionManager.createSession(user2, ['context2']);

      // Add some data to both sessions
      await sessionManager.updateSessionActivity(session1.sessionId, ['update1']);
      await sessionManager.updateSessionActivity(session2.sessionId, ['update2']);

      // Archive first session
      await sessionManager.archiveSession(session1.sessionId, 'manual');

      // Verify second session is unaffected
      const remainingSession = await sessionManager.getSession(session2.sessionId);
      expect(remainingSession).toBeDefined();
      expect(remainingSession!.userId).toBe(user2);
      expect(remainingSession!.activeContext).toContain('context2');
      expect(remainingSession!.activeContext).toContain('update2');
      expect(sessionManager.validateSessionIsolation(session2.sessionId)).toBe(true);

      // Verify first session is no longer active
      const archivedSession = await sessionManager.getSession(session1.sessionId);
      expect(archivedSession).toBeNull();

      // Clean up
      await sessionManager.archiveSession(session2.sessionId, 'manual');
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with memory manager for session persistence', async () => {
      const userId = 'integration-user';
      const session = await sessionManager.createSession(userId);

      // Verify memory manager interactions
      expect(mockMemoryManager.initialize).toHaveBeenCalled();
      expect(mockMemoryManager.detectStateChanges).toHaveBeenCalled();
      expect(mockMemoryManager.updateEpisodicMemory).toHaveBeenCalled();

      await sessionManager.updateSessionActivity(session.sessionId);
      expect(mockMemoryManager.updateSessionActivity).toHaveBeenCalledWith(session.sessionId);

      const flags: Flag[] = [{
        id: 'integration-flag',
        type: 'info',
        category: 'performance',
        message: 'Integration test flag',
        severity: 1,
        timestamp: new Date(),
        resolved: false,
        source: 'test'
      }];

      await sessionManager.addSessionFlags(session.sessionId, flags);
      expect(mockMemoryManager.addSessionFlags).toHaveBeenCalledWith(session.sessionId, flags);
    });

    it('should handle memory manager errors gracefully', async () => {
      mockMemoryManager.detectStateChanges.mockRejectedValue(new Error('Memory error'));

      // Should still create session despite memory error
      const session = await sessionManager.createSession('error-user');
      expect(session).toBeDefined();
      expect(session.changesSinceLastSession).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      mockMemoryManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      const failingManager = new SessionManager();
      await expect(failingManager.initialize()).rejects.toThrow('Init failed');
    });

    it('should require initialization before operations', async () => {
      const uninitializedManager = new SessionManager();
      
      await expect(
        uninitializedManager.createSession('test-user')
      ).rejects.toThrow('SessionManager not initialized');
    });
  });
});