import { DiagnosticProcedures } from '../../src/services/DiagnosticProcedures';
import { ToolOrchestrator } from '../../src/services/ToolOrchestrator';
import { Database } from 'duckdb';

/**
 * Unit tests for DiagnosticProcedures
 * 
 * Tests cover:
 * - All four named diagnostic procedures
 * - Finding generation and confidence scoring
 * - Recommendation generation
 * - Error handling
 */

describe('DiagnosticProcedures', () => {
  let diagnosticProcedures: DiagnosticProcedures;
  let mockToolOrchestrator: jest.Mocked<ToolOrchestrator>;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    // Create mock database
    mockDb = {} as jest.Mocked<Database>;

    // Create mock tool orchestrator
    mockToolOrchestrator = {
      executeDataQuery: jest.fn(),
      performWebSearch: jest.fn(),
      detectAnomalies: jest.fn(),
      generateVisualization: jest.fn(),
      correlateCrossDataset: jest.fn()
    } as any;

    diagnosticProcedures = new DiagnosticProcedures(mockDb, mockToolOrchestrator);
  });

  describe('Procedure 1: triage_stuck_ros', () => {
    test('should identify stuck files and generate findings', async () => {
      // Mock stuck files query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            file_id: 'file_001',
            processing_stage: 'validation',
            processing_time_minutes: 120,
            retry_count: 2,
            error_codes: ['VAL_001'],
            final_status: 'failed',
            submission_date: new Date('2024-01-15')
          },
          {
            file_id: 'file_002',
            processing_stage: 'transformation',
            processing_time_minutes: 90,
            retry_count: 1,
            error_codes: ['TRANS_002'],
            final_status: 'partial',
            submission_date: new Date('2024-01-16')
          }
        ],
        columns: [],
        executionTime: 50,
        rowCount: 2,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock bottleneck query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            processing_stage: 'validation',
            stuck_count: 15,
            avg_time: 95,
            max_time: 180,
            avg_retries: 1.5
          }
        ],
        columns: [],
        executionTime: 30,
        rowCount: 1,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock retry pattern query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            retry_count: 1,
            file_count: 10,
            avg_time: 85,
            success_count: 7
          },
          {
            retry_count: 2,
            file_count: 5,
            avg_time: 110,
            success_count: 2
          }
        ],
        columns: [],
        executionTime: 25,
        rowCount: 2,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('triage_stuck_ros', {});

      expect(result.success).toBe(true);
      expect(result.procedureName).toBe('triage_stuck_ros');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
      
      // Check that findings include stuck files
      const stuckFilesFinding = result.findings.find(f => f.category === 'processing_bottleneck');
      expect(stuckFilesFinding).toBeDefined();
      expect(stuckFilesFinding?.description).toContain('2');
    });

    test('should handle no stuck files gracefully', async () => {
      mockToolOrchestrator.executeDataQuery.mockResolvedValue({
        rows: [],
        columns: [],
        executionTime: 10,
        rowCount: 0,
        sources: [],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('triage_stuck_ros', {});

      expect(result.success).toBe(true);
      expect(result.findings.length).toBe(0);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Procedure 2: record_quality_audit', () => {
    test('should analyze data quality vs pipeline errors', async () => {
      // Mock quality vs pipeline query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            market_segment: 'commercial',
            provider_type: 'hospital',
            total_files: 100,
            total_rejected: 150,
            total_failed: 50,
            avg_rejection_rate: 12.5,
            avg_failure_rate: 4.2
          }
        ],
        columns: [],
        executionTime: 40,
        rowCount: 1,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock validation pattern query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            error_codes: 'INVALID_NPI',
            occurrence_count: 45,
            total_rejected_records: 200,
            avg_rejection_rate: 8.5
          }
        ],
        columns: [],
        executionTime: 30,
        rowCount: 1,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock trend query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            week: new Date('2024-01-15'),
            file_count: 50,
            rejected_count: 75,
            rejection_rate: 10.5
          },
          {
            week: new Date('2024-01-08'),
            file_count: 48,
            rejected_count: 60,
            rejection_rate: 8.2
          }
        ],
        columns: [],
        executionTime: 35,
        rowCount: 2,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('record_quality_audit', {});

      expect(result.success).toBe(true);
      expect(result.procedureName).toBe('record_quality_audit');
      expect(result.findings.length).toBeGreaterThan(0);
      
      // Check for data quality findings
      const qualityFinding = result.findings.find(f => f.category === 'data_quality');
      expect(qualityFinding).toBeDefined();
      expect(qualityFinding?.description).toContain('rejection rate');
    });
  });

  describe('Procedure 3: market_health_report', () => {
    test('should generate market health assessment', async () => {
      // Mock market metrics query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            market_id: 'northeast',
            month: '2024-01',
            total_files_received: 500,
            files_processed_successfully: 475,
            average_processing_time: 45,
            error_rate_percentage: 3.5,
            data_quality_score: 0.92,
            sla_compliance_percentage: 96,
            provider_onboarding_rate: 0.15
          },
          {
            market_id: 'southwest',
            month: '2024-01',
            total_files_received: 300,
            files_processed_successfully: 240,
            average_processing_time: 65,
            error_rate_percentage: 12.5,
            data_quality_score: 0.75,
            sla_compliance_percentage: 78,
            provider_onboarding_rate: 0.08
          }
        ],
        columns: [],
        executionTime: 50,
        rowCount: 2,
        sources: [{
          name: 'aggregated_operational_metrics',
          type: 'csv',
          path: 'data/aggregated_operational_metrics.csv',
          lastModified: new Date(),
          checksum: 'def456'
        }],
        cached: false
      });

      // Mock file correlation query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            market_id: 'northeast',
            file_count: 500,
            avg_processing_time: 44,
            success_rate: 95,
            error_rate: 3.2
          }
        ],
        columns: [],
        executionTime: 40,
        rowCount: 1,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('market_health_report', {});

      expect(result.success).toBe(true);
      expect(result.procedureName).toBe('market_health_report');
      expect(result.findings.length).toBeGreaterThan(0);
      
      // Should identify both top and bottom performers
      const excellenceFinding = result.findings.find(f => f.category === 'market_excellence');
      const concernFinding = result.findings.find(f => f.category === 'market_concern');
      
      expect(excellenceFinding || concernFinding).toBeDefined();
    });
  });

  describe('Procedure 4: retry_effectiveness_analysis', () => {
    test('should analyze retry success rates and patterns', async () => {
      // Mock retry success query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            retry_count: 1,
            total_files: 100,
            successful_files: 75,
            failed_files: 25,
            avg_processing_time: 55,
            avg_success_time: 50,
            avg_failure_time: 70
          },
          {
            retry_count: 2,
            total_files: 50,
            successful_files: 20,
            failed_files: 30,
            avg_processing_time: 85,
            avg_success_time: 75,
            avg_failure_time: 95
          }
        ],
        columns: [],
        executionTime: 45,
        rowCount: 2,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock retry by error query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            error_codes: 'TIMEOUT',
            avg_retries: 1.8,
            file_count: 60,
            success_rate: 65,
            avg_time: 70
          },
          {
            error_codes: 'VALIDATION_ERROR',
            avg_retries: 2.5,
            file_count: 40,
            success_rate: 25,
            avg_time: 90
          }
        ],
        columns: [],
        executionTime: 35,
        rowCount: 2,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      // Mock cost-benefit query
      mockToolOrchestrator.executeDataQuery.mockResolvedValueOnce({
        rows: [
          {
            no_retry_time: 5000,
            retry_time: 8500,
            no_retry_count: 400,
            retry_count_total: 150,
            retry_success_count: 95
          }
        ],
        columns: [],
        executionTime: 30,
        rowCount: 1,
        sources: [{
          name: 'roster_processing_details',
          type: 'csv',
          path: 'data/roster_processing_details.csv',
          lastModified: new Date(),
          checksum: 'abc123'
        }],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('retry_effectiveness_analysis', {});

      expect(result.success).toBe(true);
      expect(result.procedureName).toBe('retry_effectiveness_analysis');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Check for retry analysis findings
      const retryFinding = result.findings.find(f => f.category === 'retry_analysis');
      expect(retryFinding).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown procedure name', async () => {
      const result = await diagnosticProcedures.executeProcedure('unknown_procedure', {});

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Unknown diagnostic procedure');
    });

    test('should handle query execution errors', async () => {
      mockToolOrchestrator.executeDataQuery.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await diagnosticProcedures.executeProcedure('triage_stuck_ros', {});

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    test('should return high confidence when findings are present', async () => {
      mockToolOrchestrator.executeDataQuery.mockResolvedValue({
        rows: [{ file_id: 'test', processing_time_minutes: 120 }],
        columns: [],
        executionTime: 10,
        rowCount: 1,
        sources: [{
          name: 'test',
          type: 'csv',
          path: 'test.csv',
          lastModified: new Date(),
          checksum: 'test'
        }],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('triage_stuck_ros', {});

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should return lower confidence when no findings', async () => {
      mockToolOrchestrator.executeDataQuery.mockResolvedValue({
        rows: [],
        columns: [],
        executionTime: 10,
        rowCount: 0,
        sources: [],
        cached: false
      });

      const result = await diagnosticProcedures.executeProcedure('triage_stuck_ros', {});

      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });
});
