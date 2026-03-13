# Property-Based Tests

This directory contains property-based tests that validate universal correctness properties of the RosterIQ AI Agent system.

## What are Property-Based Tests?

Property-based tests validate characteristics or behaviors that should hold true across all valid executions of the system. Unlike traditional unit tests that check specific inputs and outputs, property tests verify that certain invariants are maintained regardless of the specific scenario.

## Available Property Tests

### Property 14: External Service Resilience

**File**: `external-service-resilience.test.ts`

**Property Statement**: For any external service failure (database, API, web search), the system should gracefully degrade functionality while maintaining core capabilities through fallback mechanisms.

**Requirements Validated**: 9.1, 9.2, 18.4

**Test Categories**:
1. Database Connection Failure Resilience
2. External API Service Unavailability
3. Web Search Service Resilience
4. Graceful Degradation with Multiple Failures
5. Service Recovery Detection
6. Fallback Configuration Validation

**Documentation**: See [docs/PROPERTY_14_EXTERNAL_SERVICE_RESILIENCE.md](../../docs/PROPERTY_14_EXTERNAL_SERVICE_RESILIENCE.md)

## Running Property Tests

### Run All Property Tests

```bash
npm run test:properties
```

### Run Specific Property Test

```bash
# External Service Resilience
npm run test:property:resilience

# Or use Jest directly
npm test tests/properties/external-service-resilience.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage tests/properties/
```

### Run Specific Test Suite

```bash
npm test -- --testNamePattern="Database Connection Failure"
```

### Watch Mode

```bash
npm test -- --watch tests/properties/
```

## Test Structure

Each property test file follows this structure:

```typescript
/**
 * Property-Based Tests for [Property Name]
 * 
 * Property N: [Property Statement]
 * [Detailed property description]
 * 
 * Validates: Requirements X.Y, Z.W
 */

describe('Property N: [Property Name]', () => {
  // Test Category 1
  describe('[Category Name]', () => {
    it('should [behavior] when [condition]', async () => {
      // Arrange: Set up test conditions
      // Act: Execute the operation
      // Assert: Verify the property holds
    });
  });
});
```

## Writing New Property Tests

When adding new property tests:

1. **Identify the Property**
   - What universal behavior should always hold?
   - Which requirements does it validate?

2. **Create Test File**
   - Name: `[property-name].test.ts`
   - Location: `tests/properties/`

3. **Document the Property**
   - Add property statement at top of file
   - List requirements validated
   - Explain the invariant being tested

4. **Organize Test Cases**
   - Group related tests in describe blocks
   - Use clear, descriptive test names
   - Follow Arrange-Act-Assert pattern

5. **Add Documentation**
   - Create corresponding doc in `docs/`
   - Explain test categories and cases
   - Provide execution instructions

6. **Update Scripts**
   - Add npm script in package.json
   - Update this README

## Property Test Best Practices

### 1. Test Universal Behaviors

✅ **Good**: "For any external service failure, system should use fallback"  
❌ **Bad**: "When Gemini API returns 429, retry after 1 second"

### 2. Cover Edge Cases

- Test boundary conditions
- Test failure scenarios
- Test recovery scenarios
- Test configuration variations

### 3. Use Meaningful Assertions

```typescript
// Good: Specific, meaningful assertion
expect(response.model).toBe('fallback');
expect(stats.retryCount).toBeGreaterThan(0);

// Bad: Vague assertion
expect(response).toBeTruthy();
```

### 4. Mock External Dependencies

- Mock all external services
- Control failure scenarios
- Verify retry behavior
- Test timing and delays

### 5. Document Requirements Mapping

```typescript
/**
 * Property Test: [Name]
 * WHEN [condition]
 * THEN [expected behavior]
 * Validates: Requirement X.Y
 */
```

## Integration with CI/CD

Property tests should be run:

- ✅ On every pull request
- ✅ Before merging to main
- ✅ As part of release validation
- ✅ In nightly test runs

Add to CI pipeline:

```yaml
- name: Run Property Tests
  run: npm run test:properties
```

## Monitoring in Production

Use property tests as a baseline for production monitoring:

1. **Resilience Metrics**
   - Alert when retry rates exceed test thresholds
   - Monitor cache hit rates during outages
   - Track service recovery times

2. **Performance Metrics**
   - Compare production response times to test baselines
   - Monitor resource usage patterns
   - Track error rates

3. **Configuration Validation**
   - Verify production config matches test assumptions
   - Validate fallback mechanisms are active
   - Check retry limits are appropriate

## Troubleshooting

### Tests Failing Intermittently

- Check timing assumptions (use jest.setTimeout)
- Verify mock setup is consistent
- Check for race conditions in async tests

### Tests Passing but Production Failing

- Verify mocks accurately represent real services
- Check production configuration matches test config
- Review production logs for unexpected scenarios

### Slow Test Execution

- Reduce backoff times in tests (use shorter delays)
- Mock time-dependent operations
- Run tests in parallel where possible

## Related Documentation

- [Requirements Document](../../.kiro/specs/rosteriq-ai-agent/requirements.md)
- [Design Document](../../.kiro/specs/rosteriq-ai-agent/design.md)
- [API Documentation](../../docs/API_DOCUMENTATION.md)
- [Gemini Integration](../../docs/GEMINI_INTEGRATION.md)
- [Web Search Integration](../../docs/WEB_SEARCH_INTEGRATION.md)

## Future Property Tests

Planned property tests to be added:

- **Property 1**: Source Attribution Completeness
- **Property 2**: Confidence Score Validity
- **Property 3**: Memory Consistency Across Time
- **Property 4**: State Change Detection Accuracy
- **Property 5**: Cross-Dataset Correlation Mathematical Validity
- **Property 6**: Tool Selection Appropriateness
- **Property 7**: Diagnostic Procedure Determinism
- **Property 8**: Memory Update Atomicity
- **Property 9**: Error Type Classification Accuracy
- **Property 10**: Visualization Source Traceability
- **Property 11**: Session Isolation
- **Property 12**: Proactive Alert Generation
- **Property 13**: Query Processing Completeness
- **Property 15**: Data Encryption Completeness

## Contributing

When contributing property tests:

1. Follow the established structure
2. Document thoroughly
3. Map to requirements
4. Add to CI/CD pipeline
5. Update this README
