import fc from 'fast-check';
import { DiagnosticProcedures } from '../../src/services/DiagnosticProcedures';
import { ToolOrchestrator } from '../../src/services/ToolOrchestrator';
import { Database } from 'duckdb';
import { QueryResult } from '../../src/types/tools';

/**
 * Property-based tests for DiagnosticProcedures
 * 
 * **Validates: Requirements 1.1, 1.5**
 * 
 * Property 13: Query Processing Completeness
 * For any natural language query about roster operations, the system should either
 * generate an appropriate analytical response or provide a clear explanation of
 * limitations with alternative approaches.
 */

describe('DiagnosticProcedures - Property Tests', () => {
  let diagnosticProcedures: DiagnosticProcedures;
  let mockToolOrchestrator: jest.Mocked<ToolOrchestrator>;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = {} as jest.Mocked<Database>;
    mockToolOrchestrator = {
      executeDataQuery: jest.fn(),
      performWebSearch: jest.fn(),
      detectAnomalies: jest.fn(),
      generateVisualization: jest.fn(),
      correlateCrossDataset: jest.fn()
    } as any;

    diagnosticProcedures = new DiagnosticProcedures(mockDb, mockToolOrchestrator);
  });

  /**
   * Property 13: Query Processing Completeness
   * 
   * For any diagnostic procedure execution with valid parameters,
   * the system must return a complete DiagnosticResult with either:
   * - success=true with findings and recommendations, OR
   * - success=false with a clear error message
   */
  describe('Property 13: Query Processing Completeness', () => {
    const procedureNameArb = fc.constantFrom(
      'triage_stuck_ros',
      'record_quality_audit',
      'market_health_report',
      'retry_effectiveness_analysis'
    );

    const parametersArb = fc.record({
      market_segment: fc.option(fc.constantFrom('commercial', 'medicare', 'medicaid'), { nil: undefined }),
      time_period: fc.option(fc.constantFrom('7days', '30days', '90days'), { nil: undefined }),
      error_threshold: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined })
    });

    const queryResultArb = fc.record({
      rows: fc.array(fc.record({
        file_id: fc.string(),
        processing_time_minutes: fc.integer({ min: 0, max: 500 }),
        retry_count: fc.integer({ min: 0, max: 5 }),
        final_status: fc.constantFrom('success', 'failed', 'partial')
      }), { maxLength: 100 }),
      columns: fc.constant([]),
      executionTime: fc.integer({ min: 10, max: 1000 }),
      rowCount: fc.integer({ min: 0, max: 100 }),
      sources: fc.constant([{
        name: 'test_data',
        type: 'csv' as const,
        path: 'test.csv',
        lastModified: new Date(),
        checksum: 'test123'
      }]),
      cached: fc.boolean()
    });

    test('Property: All procedure executions return complete results', async () => {
      await fc.assert(
        fc.asyncProperty(
          procedureNameArb,
          parametersArb,
          queryResultArb,
          async (procedureName, parameters, queryResult) => {
            // Setup mock to return query result
            mockToolOrchestrator.executeDataQuery.mockResolvedValue(queryResult as QueryResult);

            // Execute procedure
            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: Result must be complete
            expect(result).toBeDefined();
            expect(result.procedureName).toBe(procedureName);
            expect(result.version).toBeDefined();
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.confidence).toBe('number');
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(Array.isArray(result.findings)).toBe(true);
            expect(Array.isArray(result.recommendations)).toBe(true);
            expect(Array.isArray(result.evidence)).toBe(true);

            // Property: If success, must have valid structure
            if (result.success) {
              expect(result.errorMessage).toBeUndefined();
              // Findings may be empty if no issues found
              for (const finding of result.findings) {
                expect(finding.id).toBeDefined();
                expect(finding.category).toBeDefined();
                expect(finding.description).toBeDefined();
                expect(finding.severity).toBeGreaterThanOrEqual(1);
                expect(finding.severity).toBeLessThanOrEqual(5);
                expect(finding.confidence).toBeGreaterThanOrEqual(0);
                expect(finding.confidence).toBeLessThanOrEqual(1);
              }
            } else {
              // Property: If failure, must have error message
              expect(result.errorMessage).toBeDefined();
              expect(typeof result.errorMessage).toBe('string');
              expect(result.errorMessage.length).toBeGreaterThan(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Property: Confidence scores are always valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          procedureNameArb,
          parametersArb,
          queryResultArb,
          async (procedureName, parameters, queryResult) => {
            mockToolOrchestrator.executeDataQuery.mockResolvedValue(queryResult as QueryResult);

            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: Confidence must be in valid range [0, 1]
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(Number.isFinite(result.confidence)).toBe(true);

            // Property: All finding confidences must be valid
            for (const finding of result.findings) {
              expect(finding.confidence).toBeGreaterThanOrEqual(0);
              expect(finding.confidence).toBeLessThanOrEqual(1);
              expect(Number.isFinite(finding.confidence)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Property: Findings have required structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          procedureNameArb,
          parametersArb,
          queryResultArb,
          async (procedureName, parameters, queryResult) => {
            mockToolOrchestrator.executeDataQuery.mockResolvedValue(queryResult as QueryResult);

            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: All findings must have complete structure
            for (const finding of result.findings) {
              expect(typeof finding.id).toBe('string');
              expect(finding.id.length).toBeGreaterThan(0);
              
              expect(typeof finding.category).toBe('string');
              expect(finding.category.length).toBeGreaterThan(0);
              
              expect(typeof finding.description).toBe('string');
              expect(finding.description.length).toBeGreaterThan(0);
              
              expect(typeof finding.severity).toBe('number');
              expect([1, 2, 3, 4, 5]).toContain(finding.severity);
              
              expect(Array.isArray(finding.recommendations)).toBe(true);
              expect(Array.isArray(finding.affectedSystems)).toBe(true);
              expect(Array.isArray(finding.evidence)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Property: Execution time is recorded', async () => {
      await fc.assert(
        fc.asyncProperty(
          procedureNameArb,
          parametersArb,
          queryResultArb,
          async (procedureName, parameters, queryResult) => {
            mockToolOrchestrator.executeDataQuery.mockResolvedValue(queryResult as QueryResult);

            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: Execution time must be non-negative
            expect(typeof result.executionTime).toBe('number');
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(result.executionTime)).toBe(true);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Property: Recommendations are actionable strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          procedureNameArb,
          parametersArb,
          queryResultArb,
          async (procedureName, parameters, queryResult) => {
            mockToolOrchestrator.executeDataQuery.mockResolvedValue(queryResult as QueryResult);

            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: All recommendations must be non-empty strings
            for (const recommendation of result.recommendations) {
              expect(typeof recommendation).toBe('string');
              expect(recommendation.length).toBeGreaterThan(0);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Error Handling Completeness', () => {
    test('Property: Query failures result in failed DiagnosticResult', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'triage_stuck_ros',
            'record_quality_audit',
            'market_health_report',
            'retry_effectiveness_analysis'
          ),
          fc.record({}),
          async (procedureName, parameters) => {
            // Simulate query failure
            mockToolOrchestrator.executeDataQuery.mockRejectedValue(
              new Error('Database connection failed')
            );

            const result = await diagnosticProcedures.executeProcedure(procedureName, parameters);

            // Property: Failed execution must return complete error result
            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
            expect(typeof result.errorMessage).toBe('string');
            expect(result.errorMessage.length).toBeGreaterThan(0);
            expect(result.confidence).toBe(0);
            expect(result.findings).toEqual([]);
            expect(result.recommendations).toEqual([]);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Property: Unknown procedures return error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => !['triage_stuck_ros', 'record_quality_audit', 'market_health_report', 'retry_effectiveness_analysis'].includes(s)),
          fc.record({}),
          async (unknownProcedure, parameters) => {
            const result = await diagnosticProcedures.executeProcedure(unknownProcedure, parameters);

            // Property: Unknown procedure must fail gracefully
            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain('Unknown diagnostic procedure');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
