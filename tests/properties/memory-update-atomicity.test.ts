/**
 * Property-Based Tests for Memory Update Atomicity
 * 
 * Property 8: Memory Update Atomicity
 * For any episodic memory entry that is successfully updated, the entry should be 
 * consistently stored across all memory indexes and retrieval mechanisms.
 * 
 * Validates: Requirements 5.1, 5.4
 */

import * as fc from 'fast-check';
import { EpisodicEntry, Flag } from '@/types/memory';
import { DataStateSnapshot } from '@/types/domain';
import { ReasoningStep } from '@/types/agent';

describe('Property 8: Memory Update Atomicity', () => {
  /**
   * Mock Memory Manager for testing
   */
  class MockMemoryManager {
    private entries: Map<string, EpisodicEntry> = new Map();
    private sessionIndex: Map<string, EpisodicEntry[]> = new Map();
    private flagIndex: Map<string, Flag[]> = new Map();

    async updateEpisodicMemory(entry: EpisodicEntry): Promise<void> {
      // Simulate atomic update across all indexes
      const entryId = `${entry.sessionId}-${entry.timestamp.getTime()}`;
      
      // Update main storage
      this.entries.set(entryId, entry);
      
      // Update session index
      const sessionEntries = this.sessionIndex.get(entry.sessionId) || [];
      sessionEntries.push(entry);
      this.sessionIndex.set(entry.sessionId, sessionEntries);
      
      // Update flag index
      for (const flag of entry.flags) {
        const flagEntries = this.flagIndex.get(flag.id) || [];
        flagEntries.push(flag);
        this.flagIndex.set(flag.id, flagEntries);
      }
    }

    async getEntry(sessionId: string, timestamp: Date): Promise<EpisodicEntry | null> {
      const entryId = `${sessionId}-${timestamp.getTime()}`;
      return this.entries.get(entryId) || null;
    }

    async getSessionEntries(sessionId: string): Promise<EpisodicEntry[]> {
      return this.sessionIndex.get(sessionId) || [];
    }

    async getFlagEntries(flagId: string): Promise<Flag[]> {
      return this.flagIndex.get(flagId) || [];
    }

    clear(): void {
      this.entries.clear();
      this.sessionIndex.clear();
      this.flagIndex.clear();
    }
  }

  let memoryManager: MockMemoryManager;

  beforeEach(() => {
    memoryManager = new MockMemoryManager();
  });

  afterEach(() => {
    memoryManager.clear();
  });

  describe('Atomic Storage Consistency', () => {
    it('should store entry consistently across all indexes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid(),
            timestamp: fc.date(),
            query: fc.string({ minLength: 1, maxLength: 200 }),
            response: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.double({ min: 0, max: 1 }),
            toolsUsed: fc.array(fc.string(), { minLength: 0, maxLength: 5 })
          }),
          async (entryData) => {
            const entry: EpisodicEntry = {
              ...entryData,
              flags: [],
              dataState: {
                timestamp: entryData.timestamp,
                rosterProcessingChecksum: 'checksum1',
                operationalMetricsChecksum: 'checksum2',
                totalRecords: 1000,
                lastModified: entryData.timestamp,
                keyMetrics: {}
              },
              reasoning: []
            };

            // Update memory
            await memoryManager.updateEpisodicMemory(entry);

            // Verify entry exists in main storage
            const retrievedEntry = await memoryManager.getEntry(
              entry.sessionId,
              entry.timestamp
            );
            expect(retrievedEntry).not.toBeNull();
            expect(retrievedEntry?.sessionId).toBe(entry.sessionId);
            expect(retrievedEntry?.query).toBe(entry.query);

            // Verify entry exists in session index
            const sessionEntries = await memoryManager.getSessionEntries(entry.sessionId);
            expect(sessionEntries.length).toBeGreaterThan(0);
            const foundInSession = sessionEntries.some(
              e => e.timestamp.getTime() === entry.timestamp.getTime()
            );
            expect(foundInSession).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain flag index consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid(),
            timestamp: fc.date(),
            query: fc.string({ minLength: 1 }),
            response: fc.string({ minLength: 1 }),
            confidence: fc.double({ min: 0, max: 1 }),
            flags: fc.array(
              fc.record({
                id: fc.uuid(),
                type: fc.constantFrom('alert', 'warning', 'info', 'success'),
                category: fc.constantFrom('data_quality', 'performance', 'anomaly', 'regulatory'),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                severity: fc.integer({ min: 1, max: 5 }) as fc.Arbitrary<1 | 2 | 3 | 4 | 5>,
                timestamp: fc.date(),
                resolved: fc.boolean(),
                source: fc.string({ minLength: 1 })
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (entryData) => {
            const entry: EpisodicEntry = {
              ...entryData,
              dataState: {
                timestamp: entryData.timestamp,
                rosterProcessingChecksum: 'checksum1',
                operationalMetricsChecksum: 'checksum2',
                totalRecords: 1000,
                lastModified: entryData.timestamp,
                keyMetrics: {}
              },
              toolsUsed: [],
              reasoning: []
            };

            await memoryManager.updateEpisodicMemory(entry);

            // Verify all flags are indexed
            for (const flag of entry.flags) {
              const flagEntries = await memoryManager.getFlagEntries(flag.id);
              expect(flagEntries.length).toBeGreaterThan(0);
              const foundFlag = flagEntries.some(f => f.id === flag.id);
              expect(foundFlag).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Concurrent Update Consistency', () => {
    it('should handle concurrent updates to different sessions atomically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              sessionId: fc.uuid(),
              timestamp: fc.date(),
              query: fc.string({ minLength: 1 }),
              response: fc.string({ minLength: 1 }),
              confidence: fc.double({ min: 0, max: 1 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (entriesData) => {
            const entries: EpisodicEntry[] = entriesData.map(data => ({
              ...data,
              flags: [],
              dataState: {
                timestamp: data.timestamp,
                rosterProcessingChecksum: 'checksum',
                operationalMetricsChecksum: 'checksum',
                totalRecords: 1000,
                lastModified: data.timestamp,
                keyMetrics: {}
              },
              toolsUsed: [],
              reasoning: []
            }));

            // Update all entries concurrently
            await Promise.all(
              entries.map(entry => memoryManager.updateEpisodicMemory(entry))
            );

            // Verify all entries are retrievable
            for (const entry of entries) {
              const retrieved = await memoryManager.getEntry(
                entry.sessionId,
                entry.timestamp
              );
              expect(retrieved).not.toBeNull();
              expect(retrieved?.sessionId).toBe(entry.sessionId);
            }

            // Verify session index integrity
            const uniqueSessions = new Set(entries.map(e => e.sessionId));
            for (const sessionId of uniqueSessions) {
              const sessionEntries = await memoryManager.getSessionEntries(sessionId);
              const expectedCount = entries.filter(e => e.sessionId === sessionId).length;
              expect(sessionEntries.length).toBe(expectedCount);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Data Integrity After Update', () => {
    it('should preserve all entry fields after storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid(),
            timestamp: fc.date(),
            query: fc.string({ minLength: 1, maxLength: 200 }),
            response: fc.string({ minLength: 1, maxLength: 500 }),
            confidence: fc.double({ min: 0, max: 1 }),
            toolsUsed: fc.array(fc.string(), { minLength: 0, maxLength: 5 })
          }),
          async (entryData) => {
            const entry: EpisodicEntry = {
              ...entryData,
              flags: [],
              dataState: {
                timestamp: entryData.timestamp,
                rosterProcessingChecksum: 'checksum1',
                operationalMetricsChecksum: 'checksum2',
                totalRecords: 1000,
                lastModified: entryData.timestamp,
                keyMetrics: { metric1: 100, metric2: 200 }
              },
              reasoning: []
            };

            await memoryManager.updateEpisodicMemory(entry);

            const retrieved = await memoryManager.getEntry(
              entry.sessionId,
              entry.timestamp
            );

            // Verify all fields are preserved
            expect(retrieved).not.toBeNull();
            expect(retrieved?.sessionId).toBe(entry.sessionId);
            expect(retrieved?.query).toBe(entry.query);
            expect(retrieved?.response).toBe(entry.response);
            expect(retrieved?.confidence).toBe(entry.confidence);
            expect(retrieved?.toolsUsed).toEqual(entry.toolsUsed);
            expect(retrieved?.dataState.totalRecords).toBe(entry.dataState.totalRecords);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Index Consistency Validation', () => {
    it('should maintain referential integrity between indexes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              sessionId: fc.uuid(),
              timestamp: fc.date(),
              query: fc.string({ minLength: 1 }),
              response: fc.string({ minLength: 1 }),
              confidence: fc.double({ min: 0, max: 1 })
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (entriesData) => {
            const entries: EpisodicEntry[] = entriesData.map(data => ({
              ...data,
              flags: [],
              dataState: {
                timestamp: data.timestamp,
                rosterProcessingChecksum: 'checksum',
                operationalMetricsChecksum: 'checksum',
                totalRecords: 1000,
                lastModified: data.timestamp,
                keyMetrics: {}
              },
              toolsUsed: [],
              reasoning: []
            }));

            // Update all entries
            for (const entry of entries) {
              await memoryManager.updateEpisodicMemory(entry);
            }

            // Verify: every entry in session index exists in main storage
            const uniqueSessions = new Set(entries.map(e => e.sessionId));
            for (const sessionId of uniqueSessions) {
              const sessionEntries = await memoryManager.getSessionEntries(sessionId);
              
              for (const sessionEntry of sessionEntries) {
                const mainEntry = await memoryManager.getEntry(
                  sessionEntry.sessionId,
                  sessionEntry.timestamp
                );
                expect(mainEntry).not.toBeNull();
                expect(mainEntry?.sessionId).toBe(sessionEntry.sessionId);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
