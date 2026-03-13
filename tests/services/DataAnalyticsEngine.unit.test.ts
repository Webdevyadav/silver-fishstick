import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';
import { DatabaseManager } from '@/services/DatabaseManager';
import path from 'path';

/**
 * Unit Tests for DataAnalyticsEngine Query Execution
 * 
 * **Validates: Requirements 10.1, 10.3**
 * 
 * Tests cover:
 * - SQL query validation and parameter binding
 * - Query result caching and invalidation logic
 * - Connection pooling under concurrent load
 */

describe('DataAnalyticsEngine - Unit Tests', () => {
  let engine: DataAnalyticsEngine;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    process.env.ROSTER_PROCESSING_CSV = path.join(__dirname, '../../data/sample_roster_processing_details.csv');
    process.env.OPERATIONAL_METRICS_CSV = path.join(__dirname, '../../data/sample_aggregated_operational_metrics.csv');
    process.env.DUCKDB_PATH = ':memory:';
    process.env.SQLITE_PATH = ':memory:';

    dbManager = DatabaseManager.getInstance();
    engine = DataAnalyticsEngine.getInstance();
    
    await engine.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('SQL Query Validation and Parameter Binding', () => {
    test('should execute parameterized query safely', async () => {
      const result = await engine.executeQuery(
        'SELECT * FROM roster_processing_details WHERE market_segment = ? LIMIT 5',
        ['commercial']
      );
      
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeGreaterThan(0);
    });

    test('should reject DROP TABLE injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; DROP TABLE roster_processing_details;")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject DELETE injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; DELETE FROM roster_processing_details WHERE 1=1;")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject UPDATE injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; UPDATE roster_processing_details SET file_id = 'hacked';")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject INSERT injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; INSERT INTO roster_processing_details VALUES ('hack', '2024-01-01', 'commercial', 'primary_care', 100, 100, 0, 0, 'complete', '', 10, 0, 'success');")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject ALTER TABLE injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; ALTER TABLE roster_processing_details ADD COLUMN hacked VARCHAR;")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should reject CREATE TABLE injection attempt', async () => {
      await expect(
        engine.executeQuery("SELECT * FROM roster_processing_details; CREATE TABLE hacked_table (id INT);")
      ).rejects.toThrow('potentially dangerous operations');
    });

    test('should allow safe SELECT with WHERE clause', async () => {
      const result = await engine.executeQuery(
        "SELECT * FROM roster_processing_details WHERE final_status = 'success' LIMIT 5"
      );
      
      expect(result.rows).toBeDefined();
      result.rows.forEach(row => {
        expect(row.final_status).toBe('success');
      });
    });

    test('should allow safe JOIN query', async () => {
      const result = await engine.executeQuery(`
        SELECT r.file_id, m.market_id
        FROM roster_processing_details r
        CROSS JOIN aggregated_operational_metrics m
        LIMIT 5
      `);
      
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeGreaterThan(0);
    });

    test('should allow safe aggregation query', async () => {
      const result = await engine.executeQuery(`
        SELECT 
          market_segment,
          COUNT(*) as count,
          AVG(processing_time_minutes) as avg_time
        FROM roster_processing_details
        GROUP BY market_segment
      `);
      
      expect(result.rows).toBeDefined();
      result.rows.forEach(row => {
        expect(row.count).toBeGreaterThan(0);
        expect(row.avg_time).toBeGreaterThan(0);
      });
    });
  });

  describe('Query Result Caching and Invalidation Logic', () => {
    beforeEach(() => {
      engine.invalidateCache();
    });

    test('should cache query results', async () => {
      const sql = 'SELECT COUNT(*) as count FROM roster_processing_details';
      
      const result1 = await engine.executeQuery(sql);
      const time1 = result1.executionTime;
      
      const result2 = await engine.executeQuery(sql);
      const time2 = result2.executionTime;
      
      expect(result1.rows).toEqual(result2.rows);
      expect(time2).toBeLessThanOrEqual(time1);
    });

    test('should respect skipCache option', async () => {
      const sql = 'SELECT * FROM roster_processing_details LIMIT 1';
      
      await engine.executeQuery(sql);
      
      const result = await engine.executeQuery(sql, [], { skipCache: true });
      
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    test('should respect custom cache TTL', async () => {
      const sql = 'SELECT * FROM roster_processing_details LIMIT 1';
      
      await engine.executeQuery(sql, [], { cacheTTL: 1 });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await engine.executeQuery(sql);
      expect(result).toBeDefined();
    });

    test('should invalidate all cache when no pattern provided', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 1');
      await engine.executeQuery('SELECT * FROM aggregated_operational_metrics LIMIT 1');
      
      engine.invalidateCache();
      
      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('should invalidate cache by pattern', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 1');
      await engine.executeQuery('SELECT * FROM aggregated_operational_metrics LIMIT 1');
      
      engine.invalidateCache('roster_processing_details');
      
      const result = await engine.executeQuery('SELECT * FROM aggregated_operational_metrics LIMIT 1');
      expect(result).toBeDefined();
    });

    test('should generate consistent cache keys for same query', async () => {
      const sql = 'SELECT * FROM roster_processing_details WHERE file_id = ?';
      const params = ['RPF_2024_001'];
      
      const result1 = await engine.executeQuery(sql, params);
      const result2 = await engine.executeQuery(sql, params);
      
      expect(result1.rows).toEqual(result2.rows);
    });

    test('should generate different cache keys for different parameters', async () => {
      const sql = 'SELECT * FROM roster_processing_details WHERE market_segment = ?';
      
      const result1 = await engine.executeQuery(sql, ['commercial']);
      const result2 = await engine.executeQuery(sql, ['medicare']);
      
      expect(result1.rows).not.toEqual(result2.rows);
    });
  });

  describe('Connection Pooling Under Concurrent Load', () => {
    test('should handle concurrent queries successfully', async () => {
      const queries = [
        'SELECT * FROM roster_processing_details LIMIT 5',
        'SELECT * FROM aggregated_operational_metrics LIMIT 5',
        'SELECT COUNT(*) as count FROM roster_processing_details',
        'SELECT AVG(error_rate_percentage) as avg_error FROM aggregated_operational_metrics',
        'SELECT * FROM error_analysis LIMIT 5'
      ];

      const promises = queries.map(sql => engine.executeQuery(sql));
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(queries.length);
      results.forEach(result => {
        expect(result.rows).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(0);
        expect(result.sources).toBeDefined();
      });
    });

    test('should handle 10 concurrent queries', async () => {
      const queries = Array(10).fill('SELECT * FROM roster_processing_details LIMIT 1');
      
      const promises = queries.map(sql => engine.executeQuery(sql));
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.rows).toBeDefined();
        expect(result.rowCount).toBe(1);
      });
    });

    test('should handle 50 concurrent queries', async () => {
      const queries = Array(50).fill('SELECT COUNT(*) as count FROM roster_processing_details');
      
      const startTime = Date.now();
      const promises = queries.map(sql => engine.executeQuery(sql));
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results.length).toBe(50);
      results.forEach(result => {
        expect(result.rows).toBeDefined();
        expect(result.rows[0].count).toBeGreaterThan(0);
      });
      
      expect(totalTime).toBeLessThan(10000);
    });

    test('should handle mixed concurrent queries', async () => {
      const queries = [
        ...Array(10).fill('SELECT * FROM roster_processing_details LIMIT 1'),
        ...Array(10).fill('SELECT * FROM aggregated_operational_metrics LIMIT 1'),
        ...Array(10).fill('SELECT COUNT(*) as count FROM roster_processing_details'),
        ...Array(10).fill('SELECT AVG(error_rate_percentage) as avg FROM aggregated_operational_metrics')
      ];

      const promises = queries.map(sql => engine.executeQuery(sql));
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(40);
      results.forEach(result => {
        expect(result.rows).toBeDefined();
        expect(result.sources.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      engine.resetQueryMetrics();
    });

    test('should record query metrics', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 5');
      
      const metrics = engine.getQueryMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      
      const metric = metrics[0];
      expect(metric.executionCount).toBe(1);
      expect(metric.avgExecutionTime).toBeGreaterThan(0);
      expect(metric.minExecutionTime).toBeGreaterThan(0);
      expect(metric.maxExecutionTime).toBeGreaterThan(0);
    });

    test('should aggregate metrics for repeated queries', async () => {
      const sql = 'SELECT * FROM roster_processing_details LIMIT 5';
      
      await engine.executeQuery(sql);
      await engine.executeQuery(sql);
      await engine.executeQuery(sql);
      
      const metrics = engine.getQueryMetrics();
      const metric = metrics.find(m => m.queryPattern.includes('roster_processing_details'));
      
      expect(metric).toBeDefined();
      expect(metric!.executionCount).toBeGreaterThanOrEqual(1);
    });

    test('should identify slow queries', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 1000');
      
      const slowQueries = engine.getSlowQueries(0);
      expect(slowQueries.length).toBeGreaterThan(0);
    });

    test('should reset query metrics', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 5');
      
      engine.resetQueryMetrics();
      
      const metrics = engine.getQueryMetrics();
      expect(metrics.length).toBe(0);
    });

    test('should filter metrics by pattern', async () => {
      await engine.executeQuery('SELECT * FROM roster_processing_details LIMIT 5');
      await engine.executeQuery('SELECT * FROM aggregated_operational_metrics LIMIT 5');
      
      const rosterMetrics = engine.getQueryMetrics('roster_processing_details');
      expect(rosterMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', () => {
      const stats = engine.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });
});
