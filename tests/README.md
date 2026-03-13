# RosterIQ AI Agent - Test Suite

Comprehensive testing suite for the RosterIQ AI Agent system, including unit tests, integration tests, and property-based tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── validation/         # CSV schema and data validation tests
│   ├── utils/              # Utility function tests
│   └── services/           # Service layer tests
├── integration/            # End-to-end integration tests
├── properties/             # Property-based tests for correctness
├── fixtures/               # Test data generators and fixtures
└── setup.ts               # Global test configuration
```

## Test Categories

### Unit Tests

Unit tests verify individual components in isolation with mocked dependencies.

**Coverage Target**: 90% code coverage

**Location**: `tests/unit/`

**Run Command**:
```bash
npm run test:unit
```

**Key Test Suites**:
- `validation/csvSchemas.test.ts` - CSV data validation logic
- `utils/confidence.test.ts` - Confidence scoring algorithms
- `services/DatabaseManager.test.ts` - Database connection management
- `services/RedisManager.test.ts` - Cache and session management
- `services/GeminiService.test.ts` - AI service integration
- `services/WebSearchService.test.ts` - Web search integration

### Integration Tests

Integration tests verify complete workflows with realistic data and multiple components working together.

**Location**: `tests/integration/`

**Run Command**:
```bash
npm run test:integration
```

**Key Test Suites**:
- `end-to-end.test.ts` - Complete query processing workflows
  - Natural language query processing
  - Cross-dataset correlation analysis
  - Session continuity and state management
  - Diagnostic procedure execution
  - Real-time streaming
  - Visualization generation
  - Error handling and resilience
  - Performance under concurrent load

### Property-Based Tests

Property-based tests validate universal correctness properties that should hold across all valid inputs.

**Location**: `tests/properties/`

**Run Command**:
```bash
npm run test:properties
```

**Available Properties**:

1. **Property 8: Memory Update Atomicity** (`memory-update-atomicity.test.ts`)
   - Validates: Requirements 5.1, 5.4
   - Ensures episodic memory entries are consistently stored across all indexes
   - Tests concurrent updates and referential integrity

2. **Property 9: Error Type Classification Accuracy** (`error-type-classification.test.ts`)
   - Validates: Requirements 12.1, 12.2, 12.3, 12.4
   - Ensures correct differentiation between pipeline errors and data quality issues
   - Tests recommendation appropriateness and classification consistency

3. **Property 14: External Service Resilience** (`external-service-resilience.test.ts`)
   - Validates: Requirements 9.1, 9.2, 18.4
   - Ensures graceful degradation when external services fail
   - Tests fallback mechanisms and recovery detection

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Property-based tests only
npm run test:properties
```

### Run Specific Test Files
```bash
# Run specific unit test
npm test tests/unit/validation/csvSchemas.test.ts

# Run specific property test
npm run test:property:memory
npm run test:property:error-classification
npm run test:property:resilience
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/lcov.info` - LCOV format for CI/CD integration

## Test Configuration

### Jest Configuration

Located in `jest.config.js`:

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### Test Setup

Global test setup in `tests/setup.ts`:
- Mock environment variables
- Mock external services (Gemini AI, OpenAI)
- Configure test timeouts
- Set up test database connections

## Writing Tests

### Unit Test Example

```typescript
import { calculateConfidence } from '@/utils/confidence';
import { Evidence } from '@/types/domain';

describe('calculateConfidence', () => {
  it('should calculate confidence based on evidence quality', () => {
    const evidence: Evidence[] = [
      { confidence: 0.9, sources: [...], ... },
      { confidence: 0.8, sources: [...], ... }
    ];

    const result = calculateConfidence(evidence);
    
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});
```

### Property-Based Test Example

```typescript
import * as fc from 'fast-check';

describe('Property: Confidence Score Validity', () => {
  it('should always return confidence between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          confidence: fc.double({ min: 0, max: 1 }),
          sources: fc.array(fc.anything())
        })),
        (evidence) => {
          const result = calculateConfidence(evidence);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import { app } from '@/index';

describe('Query Processing', () => {
  it('should process natural language query end-to-end', async () => {
    const response = await request(app)
      .post('/api/query')
      .send({ query: 'What are the main issues?', sessionId: 'test-123' })
      .expect(200);

    expect(response.body).toHaveProperty('response');
    expect(response.body).toHaveProperty('confidence');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0);
  });
});
```

## Test Data and Fixtures

Test fixtures and data generators are available in `tests/fixtures/testData.ts`:

```typescript
import { 
  generateRosterProcessingRecord,
  generateOperationalMetrics,
  errorScenarios,
  marketScenarios
} from '@/tests/fixtures/testData';

// Generate single record
const record = generateRosterProcessingRecord();

// Generate multiple records
const records = generateRosterProcessingRecords(10);

// Use predefined scenarios
const pipelineError = errorScenarios.pipelineOnly();
const healthyMarket = marketScenarios.healthy();
```

## Mocking Strategies

### External Services

External services are mocked in `tests/setup.ts`:
- Gemini AI API
- OpenAI Embeddings API
- Web Search APIs

### Database Connections

Tests use in-memory databases:
- DuckDB: `:memory:`
- SQLite: `:memory:`
- Redis: Mock implementation

### Time-Dependent Tests

Use Jest's fake timers for time-dependent tests:

```typescript
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-15'));

// Run test

jest.useRealTimers();
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Nightly builds

### Coverage Requirements

- Minimum 80% coverage required for all metrics
- Target 90% coverage for core components
- Property tests must pass 100% of runs

### Test Execution Order

1. Unit tests (fastest)
2. Property-based tests
3. Integration tests (slowest)

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should calculate confidence"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

### Verbose Output
```bash
npm test -- --verbose
```

### Show Console Logs
```bash
npm test -- --silent=false
```

## Performance Testing

Integration tests include performance benchmarks:
- Query response time < 5 seconds
- Concurrent query handling (10+ simultaneous)
- Memory usage monitoring
- Database query optimization

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Use descriptive test names
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Dependencies**: Don't rely on external services
5. **Test Edge Cases**: Include boundary conditions
6. **Property Tests**: Use for universal behaviors
7. **Integration Tests**: Test realistic workflows
8. **Coverage**: Aim for 90% but focus on critical paths

## Troubleshooting

### Tests Timing Out

Increase timeout in test file:
```typescript
jest.setTimeout(30000); // 30 seconds
```

### Database Connection Issues

Ensure test databases are properly initialized:
```typescript
beforeAll(async () => {
  await dbManager.initialize();
});

afterAll(async () => {
  await dbManager.close();
});
```

### Mock Not Working

Clear mocks between tests:
```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```

### Property Test Failures

Reduce number of runs for debugging:
```typescript
fc.assert(fc.property(...), { numRuns: 10 });
```

## Contributing

When adding new tests:

1. Follow existing test structure
2. Add to appropriate category (unit/integration/property)
3. Update this README if adding new test suites
4. Ensure tests pass locally before committing
5. Maintain or improve code coverage

## Related Documentation

- [Requirements Document](../.kiro/specs/rosteriq-ai-agent/requirements.md)
- [Design Document](../.kiro/specs/rosteriq-ai-agent/design.md)
- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Property Tests README](./properties/README.md)
