import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';
import { DatabaseManager } from '@/services/DatabaseManager';
import path from 'path';

describe('DataAnalyticsEngine', () => {
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

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(engine.isInitialized()).toBe(true);
    });

    test('should load roster processing data', async () => {
      const result = await engine.executeQuery('SELECT COUNT(*) as count FROM roster_processing_details');
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].count).toBeGreaterThan(0);
    });

    test('should load operational metrics data', async () => {
      const result = await engine.executeQuery('SELECT COUNT(*) as count FROM aggregated_operational_metrics');
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].count).toBeGreaterThan(0);
    });
  });

  describe('Query Execution', () => {
    test('should execute simple SELECT query', async () => {
      const result = await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 5');
      
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeLessThanOrEqual(5);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBeGreaterThan(0);
    });

    test('should execute query with WHERE clause', async () => {
      const result = await engine.executeQuery(
        "SELECT * FROM roster_processing_details WHERE market_segment = 'commercial'"
      );
      
      expect(result.rows).toBeDefined();
      result.rows.forEach(row => {
        expect(row.market_segment).toBe('commercial');
      });
    });

    test('should execute aggregation query', async () => {
      const result = await engine.executeQuery(`
        SELECT 
          market_segment,
          COUNT(*) as file_count,
          SUM(failed_records) as total_failures,
          AVG(processing_time_minutes) as avg_time
        FROM roster_processing_details
        GROUP BY market_segment
      `);
      
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeGreaterThan(0);
      result.rows.forEach(row => {
        expect(row.file_count).toBeGreaterThan(0);
        expect(row.avg_time).toBeGreaterThan(0);
      });
    });

    test('should execute JOIN query across datasets', async () => {
      const result = await engine.executeQuery(`
        SELECT 
          r.market_segment,
          r.file_id,
          m.error_rate_percentage
        FROM roster_processing_details r
        LEFT JOIN aggregated_operational_metrics m 
          ON r.market_segment = LOWER(SPLIT_PART(m.market_id, '_', 2))
        LIMIT 5
      `);
      
      expect(result.rows).toBeDefined();
      expect(result.sources.length).toBe(2); // Both datasets
    });
  });

  describe('Source Attribution', () => {
    test('should include source attribution for single dataset query', async () => {
      const result = await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 1');
      
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBe(1);
      expect(result.sources[0].type).toBe('csv_data');
      expect(result.sources[0].name).toBe('Roster Processing Details');
      expect(result.sources[0].confidence).toBe(1.0);
      expect(result.sources[0].metadata.dataset).toBe('roster_processing');
    });

    test('should include source attribution for cross-dataset query', async () => {
      const result = await engine.executeQuery(`
        SELECT r.file_id, m.market_id
        FROM roster_processing_details r, aggregated_operational_metrics m
        LIMIT 1
      `);
      
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBe(2);
      
      const sourceNames = result.sources.map(s => s.name);
      expect(sourceNames).toContain('Roster Processing Details');
      expect(sourceNames).toContain('Aggregated Operational Metrics');
    });
  });

  describe('Query Caching', () => {
    test('should cache query results', async () => {
      const sql = 'SELECT COUNT(*) as count FROM roster_processing_details';
      
      // First execution - not cached
      const result1 = await engine.executeQuery(sql);
      const time1 = result1.executionTime;
      
      // Second execution - should be cached
      const result2 = await engine.executeQuery(sql);
      const time2 = result2.executionTime;
      
      expect(result1.rows).toEqual(result2.rows);
      // Cached query should be faster (though in-memory DB might be too fast to measure)
      expect(time2).toBeLessThanOrEqual(time1);
    });

    test('should skip cache when requested', async () => {
      const sql = 'SELECT COUNT(*) as count FROM roster_processing_details';
      
      const result1 = await engine.executeQuery(sql);
      const result2 = await engine.executeQuery(sql, [], { skipCache: true });
      
      expect(result1.rows).toEqual(result2.rows);
    });

    test('should invalidate cache', async () => {
      const sql = 'SELECT * FROM roster_processing_details LIMIT 1';
      
      // Execute and cache
      await engine.executeQuery(sql);
      
      // Invalidate cache
      engine.invalidateCache('roster_processing_details');
      
      // Should execute fresh query
      const result = await engine.executeQuery(sql);
      expect(result).toBeDefined();
    });

    test('should respect custom cache TTL', async () => {
      const sql = 'SELECT * FROM roster_processing_details LIMIT 1';
      
      // Cache with very short TTL
      await engine.executeQuery(sql, [], { cacheTTL: 1 });
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should execute fresh query
      const result = await engine.executeQuery(sql);
      expect(result).toBeDefined();
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should reject DROP TABLE attempts', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; DROP TABLE roster_processing_details;")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject DELETE attempts', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; DELETE FROM roster_processing_details;")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject UPDATE attempts', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; UPDATE roster_processing_details SET file_id = 'hacked';")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should allow safe SELECT queries', async () => {
      const result = await engine.executeQuery("SELECT * FROM roster_processing_details WHERE file_id = 'RPF_2024_001'");
      expect(result).toBeDefined();
    });
  });

  describe('Schema Information', () => {
    test('should retrieve roster processing schema', async () => {
      const schema = await engine.getDatasetSchema('roster_processing');
      
      expect(schema.tables).toBeDefined();
      expect(schema.tables.length).toBeGreaterThan(0);
      
      const table = schema.tables[0];
      expect(table.name).toBe('roster_processing_details');
      expect(table.columns.length).toBeGreaterThan(0);
      expect(table.rowCount).toBeGreaterThan(0);
    });

    test('should retrieve operational metrics schema', async () => {
      const schema = await engine.getDatasetSchema('operational_metrics');
      
      expect(schema.tables).toBeDefined();
      expect(schema.tables.length).toBeGreaterThan(0);
      
      const table = schema.tables[0];
      expect(table.name).toBe('aggregated_operational_metrics');
      expect(table.columns.length).toBeGreaterThan(0);
    });

    test('should include relationship information', async () => {
      const schema = await engine.getDatasetSchema('roster_processing');
      
      expect(schema.relationships).toBeDefined();
      expect(schema.relationships.length).toBeGreaterThan(0);
      
      const relationship = schema.relationships[0];
      expect(relationship.fromTable).toBe('roster_processing_details');
      expect(relationship.toTable).toBe('aggregated_operational_metrics');
      expect(relationship.type).toBe('many-to-one');
    });
  });

  describe('Data Quality Reporting', () => {
    test('should generate data quality report for roster processing', async () => {
      const report = await engine.getDataQualityReport('roster_processing');
      
      expect(report.dataset).toBe('roster_processing');
      expect(report.totalRows).toBeGreaterThan(0);
      expect(report.validRows).toBeGreaterThan(0);
      expect(report.errors).toBeDefined();
      expect(report.warnings).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    test('should generate data quality report for operational metrics', async () => {
      const report = await engine.getDataQualityReport('operational_metrics');
      
      expect(report.dataset).toBe('operational_metrics');
      expect(report.totalRows).toBeGreaterThan(0);
      expect(report.validRows).toBeGreaterThan(0);
    });
  });

  describe('Views', () => {
    test('should query error_analysis view', async () => {
      const result = await engine.executeQuery('SELECT * FROM error_analysis LIMIT 5');
      
      expect(result.rows).toBeDefined();
      result.rows.forEach(row => {
        expect(row.pipeline_errors).toBeDefined();
        expect(row.data_quality_issues).toBeDefined();
        expect(row.total_errors).toBe(row.pipeline_errors + row.data_quality_issues);
      });
    });

    test('should query market_performance_summary view', async () => {
      const result = await engine.executeQuery('SELECT * FROM market_performance_summary LIMIT 5');
      
      expect(result.rows).toBeDefined();
      result.rows.forEach(row => {
        expect(row.market_id).toBeDefined();
        expect(row.success_rate).toBeDefined();
        expect(row.success_rate).toBeGreaterThanOrEqual(0);
        expect(row.success_rate).toBeLessThanOrEqual(100);
      });
    });

    test('should create custom view', async () => {
      await engine.createView('test_view', 'SELECT file_id, market_segment FROM roster_processing_details');
      
      const result = await engine.executeQuery('SELECT * FROM test_view LIMIT 1');
      expect(result.rows).toBeDefined();
      expect(result.rows[0].file_id).toBeDefined();
      expect(result.rows[0].market_segment).toBeDefined();
    });
  });

  describe('Query Optimization', () => {
    test('should get query execution plan', async () => {
      const plan = await engine.getQueryPlan('SELECT * FROM roster_processing_details WHERE market_segment = \'commercial\'');
      
      expect(plan).toBeDefined();
      expect(Array.isArray(plan)).toBe(true);
    });

    test('should optimize query', async () => {
      const originalSQL = 'SELECT * FROM roster_processing_details WHERE market_segment = \'commercial\'';
      const optimizedSQL = await engine.optimizeQuery(originalSQL);
      
      expect(optimizedSQL).toBeDefined();
      expect(typeof optimizedSQL).toBe('string');
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', () => {
      const stats = engine.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(typeof stats.hitRate).toBe('number');
    });
  });
});
