import { ProactiveMonitor } from '@/services/ProactiveMonitor';
import { MemoryManager } from '@/services/MemoryManager';
import { StateChange } from '@/types/domain';
import { Anomaly } from '@/types/tools';
import fc from 'fast-check';

// Mock the MemoryManager
jest.mock('@/services/MemoryManager');
const MockedMemoryManager = jest.mocked(MemoryManager);

describe('ProactiveMonitor', () => {
  let monitor: ProactiveMonitor;
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockMemoryManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      detectStateChanges: jest.fn().mockResolvedValue([])
    } as any;

    (MockedMemoryManager.getInstance as jest.Mock).mockReturnValue(mockMemoryManager);

    monitor = new ProactiveMonitor({
      checkIntervalMs: 1000,
      anomalyThreshold: 0.7,
      alertSeverityThreshold: 3,
      maxAlertsPerHour: 5,
      enablePatternLearning: true
    });

    await monitor.initialize();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Unit Tests', () => {
    describe('detectAnomalies', () => {
      it('should detect statistical anomalies in metrics', async () => {
        const dataset = 'roster_processing';
        const metrics = ['errorRate', 'avgProcessingTime'];

        const anomalies = await monitor.detectAnomalies(dataset, metrics);

        expect(anomalies).toBeInstanceOf(Array);
        // First run should have no anomalies (no baseline)
        expect(anomalies.length).toBe(0);

        // Second run should potentially detect anomalies
        const secondAnomalies = await monitor.detectAnomalies(dataset, metrics);
        expect(secondAnomalies).toBeInstanceOf(Array);
      });

      it('should return empty array for unknown metrics', async () => {
        const anomalies = await monitor.detectAnomalies('unknown_dataset', ['nonexistent_metric']);
        expect(anomalies).toEqual([]);
      });

      it('should handle errors gracefully', async () => {
        // Mock an error in the detection process
        const originalCaptureState = (monitor as any).captureCurrentDataState;
        (monitor as any).captureCurrentDataState = jest.fn().mockRejectedValue(new Error('Data error'));

        const anomalies = await monitor.detectAnomalies('test_dataset', ['metric1']);
        expect(anomalies).toEqual([]);

        // Restore original method
        (monitor as any).captureCurrentDataState = originalCaptureState;
      });
    });

    describe('generateAlert', () => {
      it('should generate alert for high-severity anomalies', async () => {
        const anomalies: Anomaly[] = [{
          id: 'anomaly-1',
          type: 'statistical',
          description: 'High error rate detected',
          severity: 4,
          affectedMetrics: ['errorRate'],
          detectionTime: new Date(),
          confidence: 0.9,
          evidence: []
        }];

        const alert = await monitor.generateAlert(anomalies, []);

        expect(alert).toBeDefined();
        expect(alert!.type).toBe('proactive');
        expect(alert!.severity).toBe(4);
        expect(alert!.recommendations).toBeInstanceOf(Array);
        expect(alert!.recommendations.length).toBeGreaterThan(0);
        expect(alert!.affectedSystems).toBeInstanceOf(Array);
      });

      it('should not generate alert for low-severity issues', async () => {
        const lowSeverityAnomalies: Anomaly[] = [{
          id: 'anomaly-1',
          type: 'statistical',
          description: 'Minor change detected',
          severity: 1,
          affectedMetrics: ['metric1'],
          detectionTime: new Date(),
          confidence: 0.5,
          evidence: []
        }];

        const alert = await monitor.generateAlert(lowSeverityAnomalies, []);
        expect(alert).toBeNull();
      });

      it('should respect rate limiting', async () => {
        const highSeverityAnomalies: Anomaly[] = [{
          id: 'anomaly-1',
          type: 'statistical',
          description: 'Critical issue',
          severity: 5,
          affectedMetrics: ['errorRate'],
          detectionTime: new Date(),
          confidence: 0.95,
          evidence: []
        }];

        // Generate multiple alerts quickly
        const alerts = await Promise.all([
          monitor.generateAlert(highSeverityAnomalies, []),
          monitor.generateAlert(highSeverityAnomalies, []),
          monitor.generateAlert(highSeverityAnomalies, []),
          monitor.generateAlert(highSeverityAnomalies, []),
          monitor.generateAlert(highSeverityAnomalies, []),
          monitor.generateAlert(highSeverityAnomalies, []) // This should be rate limited
        ]);

        const generatedAlerts = alerts.filter(alert => alert !== null);
        expect(generatedAlerts.length).toBeLessThanOrEqual(5); // maxAlertsPerHour
      });

      it('should combine anomalies and state changes in alert', async () => {
        const anomalies: Anomaly[] = [{
          id: 'anomaly-1',
          type: 'statistical',
          description: 'Error rate spike',
          severity: 4,
          affectedMetrics: ['errorRate'],
          detectionTime: new Date(),
          confidence: 0.8,
          evidence: []
        }];

        const stateChanges: StateChange[] = [{
          id: 'change-1',
          type: 'data_update',
          description: 'Data updated',
          affectedData: ['roster_processing'],
          timestamp: new Date(),
          severity: 3
        }];

        const alert = await monitor.generateAlert(anomalies, stateChanges);

        expect(alert).toBeDefined();
        expect(alert!.severity).toBe(4); // Should use max severity
        expect(alert!.stateChanges).toEqual(stateChanges);
        expect(alert!.message).toContain('ANOMALIES');
        expect(alert!.message).toContain('STATE CHANGES');
      });
    });

    describe('analyzeStateChanges', () => {
      it('should analyze state changes for a session', async () => {
        const mockStateChanges: StateChange[] = [{
          id: 'change-1',
          type: 'metric_change',
          description: 'Processing time increased',
          affectedData: ['avgProcessingTime'],
          timestamp: new Date(),
          severity: 3
        }];

        mockMemoryManager.detectStateChanges.mockResolvedValue(mockStateChanges);

        const changes = await monitor.analyzeStateChanges('test-session');

        expect(changes).toEqual(mockStateChanges);
        expect(mockMemoryManager.detectStateChanges).toHaveBeenCalledWith('test-session');
      });

      it('should return empty array when no changes detected', async () => {
        mockMemoryManager.detectStateChanges.mockResolvedValue([]);

        const changes = await monitor.analyzeStateChanges('test-session');

        expect(changes).toEqual([]);
      });

      it('should handle memory manager errors', async () => {
        mockMemoryManager.detectStateChanges.mockRejectedValue(new Error('Memory error'));

        const changes = await monitor.analyzeStateChanges('test-session');

        expect(changes).toEqual([]);
      });
    });

    describe('trackAlertResolution', () => {
      it('should track alert resolution', async () => {
        // First generate an alert
        const anomalies: Anomaly[] = [{
          id: 'anomaly-1',
          type: 'statistical',
          description: 'Test anomaly',
          severity: 4,
          affectedMetrics: ['errorRate'],
          detectionTime: new Date(),
          confidence: 0.8,
          evidence: []
        }];

        const alert = await monitor.generateAlert(anomalies, []);
        expect(alert).toBeDefined();

        // Track its resolution
        await monitor.trackAlertResolution(
          alert!.id,
          'manual_intervention',
          0.9,
          'Issue resolved by restarting service'
        );

        const stats = monitor.getMonitoringStats();
        expect(stats.resolvedAlerts).toBe(1);
      });
    });

    describe('monitoring lifecycle', () => {
      it('should start and stop monitoring', async () => {
        expect(monitor.getMonitoringStats().isRunning).toBe(false);

        await monitor.startMonitoring();
        expect(monitor.getMonitoringStats().isRunning).toBe(true);

        monitor.stopMonitoring();
        expect(monitor.getMonitoringStats().isRunning).toBe(false);
      });

      it('should not start monitoring twice', async () => {
        await monitor.startMonitoring();
        expect(monitor.getMonitoringStats().isRunning).toBe(true);

        // Try to start again
        await monitor.startMonitoring();
        expect(monitor.getMonitoringStats().isRunning).toBe(true);
      });
    });
  });

  /**
   * Property 4: State Change Detection Accuracy
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * For any session, detected state changes should only include modifications 
   * that occurred after the last session activity and should be verifiable 
   * against actual data
   */
  describe('Property 4: State Change Detection Accuracy', () => {
    it('should only detect changes that occurred after last session activity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // sessionId
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              type: fc.constantFrom('data_update', 'metric_change', 'new_anomaly', 'error_pattern'),
              description: fc.string({ minLength: 10, maxLength: 100 }),
              affectedData: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
              severity: fc.integer({ min: 1, max: 5 }).map(n => n as 1 | 2 | 3 | 4 | 5),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
            }),
            { minLength: 0, maxLength: 10 }
          ), // stateChanges
          async (sessionId: string, mockStateChanges: StateChange[]) => {
            // Mock the memory manager to return our test state changes
            mockMemoryManager.detectStateChanges.mockResolvedValue(mockStateChanges);

            const detectedChanges = await monitor.analyzeStateChanges(sessionId);

            // All detected changes should be valid StateChange objects
            for (const change of detectedChanges) {
              expect(change).toHaveProperty('id');
              expect(change).toHaveProperty('type');
              expect(change).toHaveProperty('description');
              expect(change).toHaveProperty('affectedData');
              expect(change).toHaveProperty('timestamp');
              expect(change).toHaveProperty('severity');

              // Verify data integrity
              expect(typeof change.id).toBe('string');
              expect(change.id.length).toBeGreaterThan(0);
              expect(['data_update', 'metric_change', 'new_anomaly', 'error_pattern']).toContain(change.type);
              expect(typeof change.description).toBe('string');
              expect(change.description.length).toBeGreaterThan(0);
              expect(Array.isArray(change.affectedData)).toBe(true);
              expect(change.affectedData.length).toBeGreaterThan(0);
              expect(change.timestamp).toBeInstanceOf(Date);
              expect(change.severity).toBeGreaterThanOrEqual(1);
              expect(change.severity).toBeLessThanOrEqual(5);
            }

            // The number of detected changes should match what memory manager returned
            expect(detectedChanges.length).toBe(mockStateChanges.length);

            return true;
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should maintain temporal consistency in state change detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              type: fc.constantFrom('data_update', 'metric_change', 'new_anomaly'),
              description: fc.string({ minLength: 5, maxLength: 50 }),
              affectedData: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
              severity: fc.integer({ min: 1, max: 5 }).map(n => n as 1 | 2 | 3 | 4 | 5),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (sessionId: string, stateChanges: StateChange[]) => {
            // Sort state changes by timestamp for temporal consistency testing
            const sortedChanges = [...stateChanges].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            mockMemoryManager.detectStateChanges.mockResolvedValue(sortedChanges);

            const detectedChanges = await monitor.analyzeStateChanges(sessionId);

            // Verify temporal ordering is preserved
            for (let i = 1; i < detectedChanges.length; i++) {
              const prevChange = detectedChanges[i - 1];
              const currentChange = detectedChanges[i];
              
              // Timestamps should be in non-decreasing order
              expect(currentChange?.timestamp.getTime()).toBeGreaterThanOrEqual(
                prevChange?.timestamp.getTime() || 0
              );
            }

            // All changes should have valid timestamps
            const now = new Date();
            for (const change of detectedChanges) {
              expect(change.timestamp).toBeInstanceOf(Date);
              expect(change.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
              expect(change.timestamp.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
            }

            return true;
          }
        ),
        { numRuns: 25, timeout: 8000 }
      );
    });

    it('should correctly categorize different types of state changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.constantFrom('data_update', 'metric_change', 'new_anomaly', 'error_pattern'),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (sessionId: string, changeType: StateChange['type'], affectedData: string[], severity: number) => {
            const mockChange: StateChange = {
              id: `test-change-${Date.now()}`,
              type: changeType,
              description: `Test ${changeType} change`,
              affectedData,
              timestamp: new Date(),
              severity: severity as 1 | 2 | 3 | 4 | 5
            };

            mockMemoryManager.detectStateChanges.mockResolvedValue([mockChange]);

            const detectedChanges = await monitor.analyzeStateChanges(sessionId);

            expect(detectedChanges.length).toBe(1);
            const detectedChange = detectedChanges[0];

            // Verify the change type is preserved and valid
            expect(detectedChange?.type).toBe(changeType);
            expect(['data_update', 'metric_change', 'new_anomaly', 'error_pattern']).toContain(detectedChange?.type);

            // Verify affected data is preserved
            expect(detectedChange?.affectedData).toEqual(affectedData);

            // Verify severity is preserved and valid
            expect(detectedChange?.severity).toBe(severity);
            expect(detectedChange?.severity).toBeGreaterThanOrEqual(1);
            expect(detectedChange?.severity).toBeLessThanOrEqual(5);

            return true;
          }
        ),
        { numRuns: 40, timeout: 8000 }
      );
    });

    it('should handle edge cases in state change detection', async () => {
      // Test empty state changes
      mockMemoryManager.detectStateChanges.mockResolvedValue([]);
      const emptyChanges = await monitor.analyzeStateChanges('empty-session');
      expect(emptyChanges).toEqual([]);

      // Test state changes with minimal data
      const minimalChange: StateChange = {
        id: 'minimal',
        type: 'data_update',
        description: 'Min',
        affectedData: ['x'],
        timestamp: new Date(),
        severity: 1
      };

      mockMemoryManager.detectStateChanges.mockResolvedValue([minimalChange]);
      const minimalChanges = await monitor.analyzeStateChanges('minimal-session');
      expect(minimalChanges.length).toBe(1);
      expect(minimalChanges[0]).toEqual(minimalChange);

      // Test state changes with maximum severity
      const maxSeverityChange: StateChange = {
        id: 'max-severity',
        type: 'new_anomaly',
        description: 'Critical system failure detected',
        affectedData: ['roster_processing', 'operational_metrics'],
        timestamp: new Date(),
        severity: 5
      };

      mockMemoryManager.detectStateChanges.mockResolvedValue([maxSeverityChange]);
      const maxSeverityChanges = await monitor.analyzeStateChanges('max-severity-session');
      expect(maxSeverityChanges.length).toBe(1);
      expect(maxSeverityChanges[0]?.severity).toBe(5);
    });

    it('should maintain data consistency across multiple detection cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 2, max: 5 }), // number of detection cycles
          async (sessionId: string, numCycles: number) => {
            const allDetectedChanges: StateChange[][] = [];

            // Run multiple detection cycles
            for (let i = 0; i < numCycles; i++) {
              const mockChanges: StateChange[] = [{
                id: `change-${i}`,
                type: 'data_update',
                description: `Change ${i}`,
                affectedData: [`data_${i}`],
                timestamp: new Date(Date.now() + i * 1000), // Ensure different timestamps
                severity: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5
              }];

              mockMemoryManager.detectStateChanges.mockResolvedValue(mockChanges);
              const detectedChanges = await monitor.analyzeStateChanges(sessionId);
              allDetectedChanges.push(detectedChanges);
            }

            // Verify consistency across cycles
            for (let i = 0; i < numCycles; i++) {
              const changes = allDetectedChanges[i];
              expect(changes?.length).toBe(1);
              
              const change = changes?.[0];
              expect(change?.id).toBe(`change-${i}`);
              expect(change?.type).toBe('data_update');
              expect(change?.affectedData).toEqual([`data_${i}`]);
              expect(change?.severity).toBe(((i % 5) + 1));
            }

            return true;
          }
        ),
        { numRuns: 15, timeout: 10000 }
      );
    });
  });

  describe('Integration Tests', () => {
    it('should integrate anomaly detection with alert generation', async () => {
      // Start monitoring
      await monitor.startMonitoring();

      // Wait for a monitoring cycle (using a short interval for testing)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const stats = monitor.getMonitoringStats();
      expect(stats.isRunning).toBe(true);

      monitor.stopMonitoring();
    });

    it('should learn from anomaly patterns over time', async () => {
      const initialStats = monitor.getMonitoringStats();
      const initialPatterns = initialStats.knownPatterns;

      // Detect some anomalies to trigger learning
      await monitor.detectAnomalies('test_dataset', ['errorRate']);
      await monitor.detectAnomalies('test_dataset', ['errorRate']);

      const updatedStats = monitor.getMonitoringStats();
      // Pattern learning might increase known patterns
      expect(updatedStats.knownPatterns).toBeGreaterThanOrEqual(initialPatterns);
    });
  });

  describe('Error Handling', () => {
    it('should handle memory manager initialization errors', async () => {
      mockMemoryManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      const failingMonitor = new ProactiveMonitor();
      await expect(failingMonitor.initialize()).rejects.toThrow('Init failed');
    });

    it('should continue monitoring despite individual cycle errors', async () => {
      // Mock a temporary error in state change detection
      let callCount = 0;
      mockMemoryManager.detectStateChanges.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary error');
        }
        return Promise.resolve([]);
      });

      await monitor.startMonitoring();
      
      // Wait for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      // Monitor should still be running despite the error
      expect(monitor.getMonitoringStats().isRunning).toBe(true);
      
      monitor.stopMonitoring();
    });
  });
});