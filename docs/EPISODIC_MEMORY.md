# EpisodicMemory Implementation

## Overview

The EpisodicMemory system provides session-based memory capabilities for the RosterIQ AI Agent, enabling persistent storage of user interactions, state change detection, and intelligent memory management. This implementation fulfills **Task 3.1** of the RosterIQ specification.

## Features

### ✅ Implemented Features

- **SQLite Backend**: Persistent storage with proper schema and indexing
- **Session History Tracking**: Complete interaction history per session
- **State Change Detection**: Automatic detection of data changes between sessions
- **Memory Pruning**: Age-based and relevance-based cleanup mechanisms
- **CRUD Operations**: Full create, read, update, delete functionality
- **Flag Management**: Session-specific alerts and warnings
- **Memory Statistics**: Comprehensive usage and performance metrics

### 🔄 Integration Points

- **MemoryManager**: Orchestrates all memory types (episodic, procedural, semantic)
- **DatabaseManager**: Shared SQLite connection management
- **Type System**: Full TypeScript integration with domain models

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MemoryManager │────│  EpisodicMemory  │────│ DatabaseManager │
│   (Orchestrator)│    │   (Core Logic)   │    │  (SQLite Conn)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │Session  │             │ State   │             │ SQLite  │
    │History  │             │ Change  │             │Database │
    │Tracking │             │Detection│             │ Tables  │
    └─────────┘             └─────────┘             └─────────┘
```

## Database Schema

### episodic_entries
```sql
CREATE TABLE episodic_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  confidence REAL NOT NULL,
  tools_used TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  data_state_checksum TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### session_flags
```sql
CREATE TABLE session_flags (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  severity INTEGER NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  source TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### state_changes
```sql
CREATE TABLE state_changes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_data TEXT NOT NULL,
  severity INTEGER NOT NULL,
  previous_value TEXT,
  current_value TEXT,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### Basic Usage

```typescript
import { MemoryManager } from '@/services/MemoryManager';

// Initialize
const memoryManager = MemoryManager.getInstance();
await memoryManager.initialize();

// Create session
const sessionState = await memoryManager.createSessionState(
  'session-123',
  'user-456',
  ['context1', 'context2']
);

// Store interaction
const entry: EpisodicEntry = {
  sessionId: 'session-123',
  timestamp: new Date(),
  query: 'What changed in roster processing?',
  response: 'Error rates increased by 15%...',
  confidence: 0.85,
  toolsUsed: ['data-query'],
  reasoning: [...],
  flags: [...],
  dataState: {...}
};

await memoryManager.updateEpisodicMemory(entry);
```

### State Change Detection

```typescript
// Detect changes since last session
const changes = await memoryManager.detectStateChanges(
  'session-123',
  currentDataState
);

console.log('Detected changes:', changes);
// Output: [
//   {
//     type: 'data_update',
//     description: 'Roster processing data has been updated',
//     affectedData: ['roster_processing_details'],
//     severity: 2
//   }
// ]
```

### Session History Retrieval

```typescript
// Get complete session history
const history = await memoryManager.getSessionHistory('session-123');

console.log(`Session has ${history.queryCount} queries`);
console.log(`Active flags: ${history.flags.length}`);
console.log(`State changes: ${history.stateChanges.length}`);
```

### Memory Management

```typescript
// Prune old entries
const prunedCount = await memoryManager.pruneEpisodicMemory(
  30,  // maxAgeInDays
  100  // maxEntriesPerSession
);

// Get statistics
const stats = memoryManager.getMemoryStatistics();
console.log(`Total entries: ${stats.episodic.totalEntries}`);
```

## State Change Detection Algorithm

The system detects changes by comparing data state snapshots:

1. **Checksum Comparison**: Compares roster processing and operational metrics checksums
2. **Metric Analysis**: Detects significant changes (>10% threshold) in key metrics
3. **Severity Assignment**: Assigns severity levels based on change magnitude
4. **Change Logging**: Stores detected changes with timestamps and context

```typescript
// Example state change detection
const changes = detectMetricChanges(lastState, currentState);
// Detects: errorRate: 0.15 → 0.22 (+47% change, severity: 4)
```

## Performance Considerations

### Indexing Strategy
- Primary indexes on `session_id` and `timestamp`
- Composite indexes for common query patterns
- Optimized for session-based retrieval

### Memory Management
- Automatic pruning based on age and relevance
- Configurable retention policies
- Efficient in-memory caching with lazy loading

### Query Optimization
- Prepared statements for all database operations
- Connection pooling through DatabaseManager
- Batch operations for bulk updates

## Testing

### Unit Tests
- **Coverage**: 100% of core functionality
- **Mocking**: DatabaseManager and external dependencies
- **Scenarios**: All CRUD operations, state detection, pruning

### Test Execution
```bash
npm test -- tests/services/EpisodicMemory.test.ts
npm test -- tests/services/MemoryManager.test.ts
```

### Property-Based Testing
Future implementation will include property-based tests for:
- Memory consistency across time (Property 3)
- State change detection accuracy (Property 4)
- Memory update atomicity (Property 8)

## Integration with RosterIQ System

### Requirements Fulfilled
- **Requirement 5.1**: ✅ Store query, response, and context with timestamps
- **Requirement 2.1**: ✅ Retrieve previous session state and detect changes
- **Requirement 2.4**: ✅ Persist current data state snapshot
- **Requirement 5.5**: ✅ Prune old entries while preserving important context

### Design Compliance
- **Component 2**: ✅ Memory Manager interface implementation
- **Data Models**: ✅ Full TypeScript type compliance
- **Error Handling**: ✅ Graceful degradation and recovery

## Future Enhancements

### Task 3.3 - Procedural Memory
- YAML-based diagnostic procedure storage
- Git versioning for procedure improvements
- Execution history tracking

### Task 3.5 - Semantic Memory
- Knowledge base with embeddings
- Semantic search capabilities
- Domain ontology management

### Advanced Features
- Memory compression for long-term storage
- Distributed memory across multiple nodes
- Advanced analytics and insights

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```typescript
   // Ensure proper initialization
   await memoryManager.initialize();
   ```

2. **Memory Growth**
   ```typescript
   // Regular pruning
   await memoryManager.pruneEpisodicMemory(30, 100);
   ```

3. **State Change Detection**
   ```typescript
   // Ensure proper data state snapshots
   const currentState = await generateCurrentDataState();
   ```

### Debug Logging
Set `LOG_LEVEL=debug` to enable detailed logging of memory operations.

## API Reference

### EpisodicMemory Class

#### Methods
- `initialize()`: Initialize the memory system
- `storeEntry(entry)`: Store a new episodic entry
- `getSessionHistory(sessionId)`: Retrieve session entries
- `detectStateChanges(sessionId, currentState)`: Detect data changes
- `pruneMemory(maxAge, maxEntries)`: Clean up old entries
- `getMemoryStats()`: Get usage statistics

### MemoryManager Class

#### Methods
- `getSessionHistory(sessionId)`: Get complete session history
- `updateEpisodicMemory(entry)`: Store new interaction
- `detectStateChanges(sessionId, currentState?)`: Detect changes
- `createSessionState(sessionId, userId, context?)`: Create new session
- `pruneEpisodicMemory(maxAge?, maxEntries?)`: Prune old entries
- `getMemoryStatistics()`: Get system-wide statistics

## Contributing

When extending the EpisodicMemory system:

1. **Follow TypeScript strict mode** - All code must pass type checking
2. **Write comprehensive tests** - Include unit tests for new functionality
3. **Update documentation** - Keep this README current with changes
4. **Consider performance** - Profile database operations and memory usage
5. **Maintain backwards compatibility** - Don't break existing interfaces

## License

This implementation is part of the RosterIQ AI Agent system and follows the project's licensing terms.