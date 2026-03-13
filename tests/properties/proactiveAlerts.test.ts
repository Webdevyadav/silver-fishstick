import { ProactiveMonitor } from '@/services/ProactiveMonitor';
import { MemoryManager } from '@/services/MemoryManager';
import { StateChange } from '@/types/domain';
import { Anomaly } from '@/types/tools';
import fc from 'fast-check';

// Mock the MemoryManager
jest.mock('@/services/MemoryManager');
const MockedMemoryManager = jest.mocked(MemoryManager);

/**
 * Property 12: Proactive Alert Generation
 * 
 * **Validates: Requirements 15.1, 15.2, 15.4**
 * 
 * For any detected anomaly or concerning trend, the system should generate 
 * appropriate alerts with severity levels and actionable recommendations
 */
describe('Property 12: Proactive Alert Generation', () => {
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockMemoryManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      detectStateChanges: jest.fn().mockResolvedValue([])
    } as any;

    (MockedMemoryManager.getInstance as jest.Mock).mockReturnValue(mockMemoryManager);
  });

  // Helper function to create valid anomaly
  const createAnomalyArbitrary = (severityRange: fc.Arbitrary<number>) => 
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      type: fc.constantFrom('statistical', 'pattern', 'threshold', 'trend'),
      description: fc.string({ minLength: 10, maxLength: 100 }),
      severity: severityRange.map(n => n as 1 | 2 | 3 | 4 | 5),
      affectedMetrics: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
      confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
      detectionTime: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
      evidence: fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          content: fc.string({ minLength: 5, maxLength: 50 }),
          sources: fc.array(fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            type: fc.constantFrom('csv_data', 'web_search', 'knowledge_base', 'diagnostic_procedure'),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            timestamp: fc.date(),
            confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
            metadata: fc.record({})
          }), { minLength: 1, maxLength: 3 }),
          confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
          timestamp: fc.date(),
          type: fc.constantFrom('data_point', 'correlation', 'pattern', 'anomaly')
        }),
        { minLength: 1, maxLength: 3 }
      )
    });
  it('should generate alerts for high-severity anomalies with appropriate recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createAnomalyArbitrary(fc.integer({ min: 4, max: 5 })), { minLength: 1, maxLength: 3 }),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            type: fc.constantFrom('data_update', 'new_anomaly', 'metric_change', 'error_pattern'),
            description: fc.string({ minLength: 10, maxLength: 100 }),
            affectedData: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            severity: fc.integer({ min: 1, max: 5 }).map(n => n as 1 | 2 | 3 | 4 | 5),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
          }),
          { minLength: 0, maxLength: 2 }
        ),
        async (anomalies: Anomaly[], stateChanges: StateChange[]) => {
          // Create fresh monitor for each test to avoid rate limiting issues
          const monitor = new ProactiveMonitor({
            checkIntervalMs: 1000,
            anomalyThreshold: 0.7,
            alertSeverityThreshold: 3,
            maxAlertsPerHour: 10, // Higher limit to avoid rate limiting in tests
            enablePatternLearning: false // Disable to avoid side effects
          });
          
          await monitor.initialize();
          
          try {
            const alert = await monitor.generateAlert(anomalies, stateChanges);

            // Alert should be generated for high-severity anomalies (4-5)
            expect(alert).not.toBeNull();
            
            if (alert) {
              // Alert should have valid structure
              expect(alert.id).toBeDefined();
              expect(typeof alert.id).toBe('string');
              expect(alert.id.length).toBeGreaterThan(0);

              // Alert type should be proactive
              expect(alert.type).toBe('proactive');

              // Severity should be appropriate (>= 4 for high severity anomalies)
              expect(alert.severity).toBeGreaterThanOrEqual(4);
              expect(alert.severity).toBeLessThanOrEqual(5);

              // Alert should have title and message
              expect(alert.title).toBeDefined();
              expect(typeof alert.title).toBe('string');
              expect(alert.title.length).toBeGreaterThan(0);
              
              expect(alert.message).toBeDefined();
              expect(typeof alert.message).toBe('string');
              expect(alert.message.length).toBeGreaterThan(0);

              // Alert should have actionable recommendations
              expect(alert.recommendations).toBeDefined();
              expect(Array.isArray(alert.recommendations)).toBe(true);
              expect(alert.recommendations.length).toBeGreaterThan(0);

              // Each recommendation should be actionable
              for (const recommendation of alert.recommendations) {
                expect(typeof recommendation).toBe('string');
                expect(recommendation.length).toBeGreaterThan(0);
                // Recommendations should contain action words
                const actionWords = ['investigate', 'review', 'analyze', 'implement', 'monitor', 'adjust', 'validate', 'apply'];
                const hasActionWord = actionWords.some(word => 
                  recommendation.toLowerCase().includes(word)
                );
                expect(hasActionWord).toBe(true);
              }

              // Alert should identify affected systems
              expect(alert.affectedSystems).toBeDefined();
              expect(Array.isArray(alert.affectedSystems)).toBe(true);

              // Timestamp should be valid and recent
              expect(alert.timestamp).toBeInstanceOf(Date);
              expect(alert.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
              expect(alert.timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute

              // Alert should not be resolved initially
              expect(alert.resolved).toBe(false);

              // State changes should be included if provided
              if (stateChanges.length > 0) {
                expect(alert.stateChanges).toEqual(stateChanges);
              }
            }
          } finally {
            monitor.stopMonitoring();
          }

          return true;
        }
      ),
      { numRuns: 15, timeout: 10000 }
    );
  });

  it('should not generate alerts for low-severity issues below threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createAnomalyArbitrary(fc.integer({ min: 1, max: 2 })), { minLength: 1, maxLength: 3 }),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            type: fc.constantFrom('data_update', 'metric_change'),
            description: fc.string({ minLength: 10, maxLength: 100 }),
            affectedData: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            severity: fc.integer({ min: 1, max: 2 }).map(n => n as 1 | 2),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
          }),
          { minLength: 0, maxLength: 2 }
        ),
        async (lowSeverityAnomalies: Anomaly[], lowSeverityStateChanges: StateChange[]) => {
          // Create fresh monitor for each test
          const monitor = new ProactiveMonitor({
            checkIntervalMs: 1000,
            anomalyThreshold: 0.7,
            alertSeverityThreshold: 3,
            maxAlertsPerHour: 10,
            enablePatternLearning: false
          });
          
          await monitor.initialize();
          
          try {
            const alert = await monitor.generateAlert(lowSeverityAnomalies, lowSeverityStateChanges);

            // No alert should be generated for low-severity issues
            expect(alert).toBeNull();
          } finally {
            monitor.stopMonitoring();
          }

          return true;
        }
      ),
      { numRuns: 10, timeout: 8000 }
    );
  });

  it('should generate alerts with severity levels matching input anomalies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          anomalySeverity: fc.integer({ min: 4, max: 5 }),
          stateSeverity: fc.integer({ min: 1, max: 5 }),
          hasStateChanges: fc.boolean()
        }),
        async ({ anomalySeverity, stateSeverity, hasStateChanges }) => {
          // Create fresh monitor for each test
          const monitor = new ProactiveMonitor({
            checkIntervalMs: 1000,
            anomalyThreshold: 0.7,
            alertSeverityThreshold: 3,
            maxAlertsPerHour: 10,
            enablePatternLearning: false
          });
          
          await monitor.initialize();
          
          try {
            // Create anomaly with specified severity
            const anomaly: Anomaly = {
              id: 'test-anomaly',
              type: 'statistical',
              description: 'Test anomaly for property testing',
              severity: anomalySeverity as 4 | 5,
              affectedMetrics: ['test_metric'],
              detectionTime: new Date(),
              confidence: 0.8,
              evidence: [{
                id: 'test-evidence',
                content: 'Test evidence',
                sources: [{
                  id: 'test-source',
                  type: 'csv_data',
                  name: 'test_data',
                  timestamp: new Date(),
                  confidence: 0.8,
                  metadata: {}
                }],
                confidence: 0.8,
                timestamp: new Date(),
                type: 'data_point'
              }]
            };

            // Create state change with specified severity if needed
            const stateChanges: StateChange[] = hasStateChanges ? [{
              id: 'test-state-change',
              type: 'data_update',
              description: 'Test state change',
              affectedData: ['test_data'],
              severity: stateSeverity as 1 | 2 | 3 | 4 | 5,
              timestamp: new Date()
            }] : [];

            const alert = await monitor.generateAlert([anomaly], stateChanges);

            if (alert) {
              // Alert severity should be the maximum of anomaly and state change severities
              const expectedSeverity = hasStateChanges ? 
                Math.max(anomalySeverity, stateSeverity) : anomalySeverity;
              expect(alert.severity).toBe(expectedSeverity);

              // Alert should have appropriate structure
              expect(alert.type).toBe('proactive');
              expect(alert.recommendations.length).toBeGreaterThan(0);
              expect(alert.affectedSystems.length).toBeGreaterThan(0);
            }
          } finally {
            monitor.stopMonitoring();
          }

          return true;
        }
      ),
      { numRuns: 20, timeout: 8000 }
    );
  });
});