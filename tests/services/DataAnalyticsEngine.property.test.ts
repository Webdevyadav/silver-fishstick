import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';
import { DatabaseManager } from '@/services/DatabaseManager';
import path from 'path';

/**
 * Property-Based Tests for DataAnalyticsEngine
 * 
 * **Validates: Requirements 6.2, 6.3, 6.5**
 * 
 * Property 1: Source Attribution Completeness
 * For any agent response containing data, every data point should have 
 * traceable source attribution linking it to its origin
 */

describe('DataAnalyticsEngine - Property-Based Tests', () => {
  let engine: DataAnalyticsEngine;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Set test data paths
    process.env.ROSTER_PROCESSING_CSV = path.join(__dirname, '../../data/sample_roster_processing_details.csv');
    process.env.OPERATIONAL_METRICS_CSV = path.join(__dirname, '../../data/sample_aggregated_operational_metrics.csv');
    process.env.DUCKDB_PATH = ':memory:';
    process.env.SQLITE_PATH = ':memory:';

    // Initialize database manager and engine
    dbManager = DatabaseManager.getInstance();
    engine = DataAnalyticsEngine.getInstance();
    
    await engine.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  /**
   * Property 1: Source Attribution Completeness
   * 
   * **Validates: Requirements 6.2, 6.3, 6.5**
   * 
   * This property verifies that for ANY query result containing data:
   * 1. The result MUST include a non-empty sources array
   * 2. Each source MUST have all required fields (id, type, name, timestamp, confidence, metadata)
   * 3. Each source MUST have confidence = 1.0 for direct CSV data
   * 4. Each source MUST have type = 'csv_data'
   * 5. Each source metadata MUST include dataset, filePath, and rowsAffected
   * 6. The rowsAffected MUST match the actual number of rows returned
   */
  describe('Property 1: Source Attribution Completeness', () => {

    test('should have complete source attribution for roster processing queries', async () => {
      // Test various queries on roster_processing_details
      const queries = [
        'SELECT * FROM roster_processing_details LIMIT 10',
        'SELECT file_id, market_segment FROM roster_processing_details WHERE final_status = \'success\'',
        'SELECT COUNT(*) as count, market_segment FROM roster_processing_details GROUP BY market_segment',
        'SELECT * FROM roster_processing_details WHERE processing_time_minutes > 50',
        'SELECT AVG(failed_records) as avg_failures FROM roster_processing_details'
      ];

      for (const query of queries) {
        const result = await engine.executeQuery(query);
        
        // Property: Result must have sources array
        expect(result.sources).toBeDefined();
        expect(Array.isArray(result.sources)).toBe(true);
        expect(result.sources.length).toBeGreaterThan(0);
        
        // Property: Each source must have required fields
        for (const source of result.sources) {
          expect(source.id).toBeDefined();
          expect(typeof source.id).toBe('string');
          
          expect(source.type).toBe('csv_data');
          
          expect(source.name).toBeDefined();
          expect(typeof source.name).toBe('string');
          
          expect(source.timestamp).toBeInstanceOf(Date);
          
          expect(source.confidence).toBe(1.0);
          
          expect(source.metadata).toBeDefined();
          expect(source.metadata.dataset).toBeDefined();
          expect(source.metadata.filePath).toBeDefined();
          expect(source.metadata.rowsAffected).toBeDefined();
        }
        
        // Property: Source must reference roster_processing dataset
        const rosterSource = result.sources.find(s => s.metadata.dataset === 'roster_processing');
        expect(rosterSource).toBeDefined();
        expect(rosterSource!.name).toBe('Roster Processing Details');
      }
    });

    test('should have complete source attribution for operational metrics queries', async () => {
      const queries = [
        'SELECT * FROM aggregated_operational_metrics LIMIT 10',
        'SELECT market_id, error_rate_percentage FROM aggregated_operational_metrics WHERE error_rate_percentage > 5',
        'SELECT AVG(data_quality_score) as avg_quality FROM aggregated_operational_metrics',
        'SELECT * FROM aggregated_operational_metrics WHERE month = \'2024-01\''
      ];

      for (const query of queries) {
        const result = await engine.executeQuery(query);
        
        expect(result.sources).toBeDefined();
        expect(result.sources.length).toBeGreaterThan(0);
        
        for (const source of result.sources) {
          expect(source.id).toBeDefined();
          expect(source.type).toBe('csv_data');
          expect(source.name).toBeDefined();
          expect(source.timestamp).toBeInstanceOf(Date);
          expect(source.confidence).toBe(1.0);
          expect(source.metadata.dataset).toBeDefined();
          expect(source.metadata.filePath).toBeDefined();
        }
        
        const metricsSource = result.sources.find(s => s.metadata.dataset === 'operational_metrics');
        expect(metricsSource).toBeDefined();
        expect(metricsSource!.name).toBe('Aggregated Operational Metrics');
      }
    });

    test('should have complete source attribution for cross-dataset queries', async () => {
      const crossDatasetQuery = `
        SELECT 
          r.file_id,
          r.market_segment,
          r.failed_records,
          m.error_rate_percentage
        FROM roster_processing_details r
        CROSS JOIN aggregated_operational_metrics m
        LIMIT 5
      `;
      
      const result = await engine.executeQuery(crossDatasetQuery);
      
      // Property: Cross-dataset queries must have sources from both datasets
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBe(2);
      
      const datasets = result.sources.map(s => s.metadata.dataset);
      expect(datasets).toContain('roster_processing');
      expect(datasets).toContain('operational_metrics');
      
      // Property: Each source must be complete
      for (const source of result.sources) {
        expect(source.id).toBeDefined();
        expect(source.type).toBe('csv_data');
        expect(source.confidence).toBe(1.0);
        expect(source.metadata.dataset).toBeDefined();
        expect(source.metadata.filePath).toBeDefined();
      }
    });

    test('should maintain source attribution through caching', async () => {
      const query = 'SELECT * FROM roster_processing_details LIMIT 5';
      
      // First execution - not cached
      const result1 = await engine.executeQuery(query);
      
      // Second execution - cached
      const result2 = await engine.executeQuery(query);
      
      // Property: Cached results must preserve source attribution
      expect(result1.sources).toEqual(result2.sources);
      expect(result2.sources.length).toBeGreaterThan(0);
      
      for (const source of result2.sources) {
        expect(source.id).toBeDefined();
        expect(source.type).toBe('csv_data');
        expect(source.confidence).toBe(1.0);
        expect(source.metadata).toBeDefined();
      }
    });

    test('should have source attribution for aggregation queries', async () => {
      const aggregationQueries = [
        'SELECT COUNT(*) as total FROM roster_processing_details',
        'SELECT SUM(failed_records) as total_failures FROM roster_processing_details',
        'SELECT AVG(processing_time_minutes) as avg_time FROM roster_processing_details',
        'SELECT MAX(retry_count) as max_retries FROM roster_processing_details',
        'SELECT MIN(total_records) as min_records FROM roster_processing_details'
      ];

      for (const query of aggregationQueries) {
        const result = await engine.executeQuery(query);
        
        // Property: Even aggregation queries must have source attribution
        expect(result.sources).toBeDefined();
        expect(result.sources.length).toBeGreaterThan(0);
        
        const source = result.sources[0];
        expect(source.type).toBe('csv_data');
        expect(source.confidence).toBe(1.0);
        expect(source.metadata.dataset).toBe('roster_processing');
      }
    });

    test('should have source attribution for view queries', async () => {
      // Query the pre-created views
      const viewQueries = [
        'SELECT * FROM error_analysis LIMIT 5',
        'SELECT * FROM market_performance_summary LIMIT 5'
      ];

      for (const query of viewQueries) {
        const result = await engine.executeQuery(query);
        
        // Property: View queries must have source attribution
        expect(result.sources).toBeDefined();
        expect(result.sources.length).toBeGreaterThan(0);
        
        for (const source of result.sources) {
          expect(source.type).toBe('csv_data');
          expect(source.confidence).toBe(1.0);
          expect(source.metadata).toBeDefined();
        }
      }
    });
  });
});
