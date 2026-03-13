/**
 * Demonstration of EpisodicMemory functionality
 * This example shows how to use the EpisodicMemory system for session tracking,
 * state change detection, and memory management.
 */

import { MemoryManager } from '../src/services/MemoryManager';
import { EpisodicEntry } from '../src/types/memory';
import { DataStateSnapshot, Flag } from '../src/types/domain';
import { ReasoningStep } from '../src/types/agent';

async function demonstrateEpisodicMemory() {
  console.log('🧠 EpisodicMemory Demonstration\n');

  // Initialize the memory manager
  const memoryManager = MemoryManager.getInstance();
  await memoryManager.initialize();
  console.log('✅ MemoryManager initialized\n');

  // Create a session
  const sessionId = 'demo-session-001';
  const userId = 'user-123';
  
  const sessionState = await memoryManager.createSessionState(
    sessionId,
    userId,
    ['roster-analysis', 'healthcare-ops']
  );
  console.log('📝 Created session state:', {
    sessionId: sessionState.sessionId,
    userId: sessionState.userId,
    activeContext: sessionState.activeContext
  });

  // Simulate first query and response
  const firstEntry: EpisodicEntry = {
    sessionId,
    timestamp: new Date(),
    query: 'What are the main issues with our roster processing?',
    response: 'Based on analysis of recent data, I found 3 main issues: 1) High rejection rates in commercial segment (15%), 2) Processing delays in validation stage, 3) Retry failures for large files.',
    confidence: 0.85,
    toolsUsed: ['data-query', 'correlation-analysis'],
    reasoning: [
      {
        id: 'step-1',
        type: 'analyze',
        description: 'Analyzed roster processing data for patterns',
        toolsUsed: ['data-query'],
        evidence: [],
        timestamp: new Date(),
        duration: 2500,
        confidence: 0.9
      }
    ],
    flags: [
      {
        id: 'flag-1',
        type: 'warning',
        category: 'data_quality',
        message: 'High rejection rate detected in commercial segment',
        severity: 3,
        timestamp: new Date(),
        resolved: false,
        source: 'data-analysis'
      }
    ],
    dataState: {
      timestamp: new Date(),
      rosterProcessingChecksum: 'roster-abc123',
      operationalMetricsChecksum: 'metrics-def456',
      totalRecords: 10000,
      lastModified: new Date(),
      keyMetrics: {
        errorRate: 0.15,
        avgProcessingTime: 120,
        qualityScore: 0.82
      }
    }
  };

  await memoryManager.updateEpisodicMemory(firstEntry);
  console.log('💾 Stored first episodic entry\n');

  // Simulate second query with state changes
  const secondEntry: EpisodicEntry = {
    sessionId,
    timestamp: new Date(Date.now() + 60000), // 1 minute later
    query: 'Has anything changed since my last query?',
    response: 'Yes, I detected significant changes: Error rate increased from 15% to 22% (+47% change), and 150 new files were processed with improved quality scores.',
    confidence: 0.92,
    toolsUsed: ['state-change-detection', 'data-query'],
    reasoning: [
      {
        id: 'step-2',
        type: 'correlate',
        description: 'Detected state changes and analyzed impact',
        toolsUsed: ['state-change-detection'],
        evidence: [],
        timestamp: new Date(),
        duration: 1800,
        confidence: 0.95
      }
    ],
    flags: [
      {
        id: 'flag-2',
        type: 'alert',
        category: 'performance',
        message: 'Error rate increased significantly (+47%)',
        severity: 4,
        timestamp: new Date(),
        resolved: false,
        source: 'state-change-detection'
      }
    ],
    dataState: {
      timestamp: new Date(),
      rosterProcessingChecksum: 'roster-xyz789', // Changed
      operationalMetricsChecksum: 'metrics-def456', // Same
      totalRecords: 10150, // Increased
      lastModified: new Date(),
      keyMetrics: {
        errorRate: 0.22, // Increased significantly
        avgProcessingTime: 115, // Improved
        qualityScore: 0.87 // Improved
      }
    }
  };

  await memoryManager.updateEpisodicMemory(secondEntry);
  console.log('💾 Stored second episodic entry with state changes\n');

  // Demonstrate state change detection
  const stateChanges = await memoryManager.detectStateChanges(sessionId, secondEntry.dataState);
  console.log('🔍 Detected state changes:');
  stateChanges.forEach((change, index) => {
    console.log(`  ${index + 1}. ${change.type}: ${change.description} (severity: ${change.severity})`);
  });
  console.log();

  // Retrieve session history
  const sessionHistory = await memoryManager.getSessionHistory(sessionId);
  console.log('📚 Session History Summary:');
  console.log(`  - Total queries: ${sessionHistory.queryCount}`);
  console.log(`  - Active flags: ${sessionHistory.flags.length}`);
  console.log(`  - State changes: ${sessionHistory.stateChanges.length}`);
  console.log(`  - Last activity: ${sessionHistory.lastActivity.toISOString()}`);
  console.log();

  // Show memory statistics
  const stats = memoryManager.getMemoryStatistics();
  console.log('📊 Memory Statistics:');
  console.log(`  - Total entries: ${stats.episodic.totalEntries}`);
  console.log(`  - Total sessions: ${stats.episodic.totalSessions}`);
  console.log(`  - Total flags: ${stats.episodic.totalFlags}`);
  console.log(`  - Total state changes: ${stats.episodic.totalStateChanges}`);
  if (stats.episodic.oldestEntry) {
    console.log(`  - Oldest entry: ${stats.episodic.oldestEntry.toISOString()}`);
  }
  if (stats.episodic.newestEntry) {
    console.log(`  - Newest entry: ${stats.episodic.newestEntry.toISOString()}`);
  }
  console.log();

  // Demonstrate memory pruning
  console.log('🧹 Demonstrating memory pruning...');
  const prunedCount = await memoryManager.pruneEpisodicMemory(30, 50);
  console.log(`  - Pruned ${prunedCount} old entries\n`);

  console.log('✨ EpisodicMemory demonstration completed successfully!');
}

// Run the demonstration
if (require.main === module) {
  demonstrateEpisodicMemory().catch(console.error);
}

export { demonstrateEpisodicMemory };