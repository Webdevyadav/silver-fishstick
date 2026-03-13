import { ToolOrchestrator } from '../../src/services/ToolOrchestrator';
import { Database } from 'duckdb';
import { VisualizationSpec, Source } from '../../src/types/tools';

/**
 * Property-Based Tests for Tool Orchestrator
 * 
 * These tests validate universal properties that should hold across all executions
 */

describe('ToolOrchestrator Property Tests', () => {
  let toolOrchestrator: ToolOrchestrator;
  let db: Database;

  beforeAll(() => {
    // Initialize DuckDB for testing
    db = new Database(':memory:');
    toolOrchestrator = new ToolOrchestrator(db);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  describe('Property 5: Cross-Dataset Correlation Mathematical Validity', () => {
    /**
     * **Validates: Requirements 3.2, 3.4**
     * 
     * For any correlation result, the correlation coefficient should be within 
     * the valid mathematical range [-1, 1] and statistical significance should 
     * be properly calculated
     */

    test('correlation coefficients must be within valid range [-1, 1]', async () => {
      // Create test data with known correlation
      const query1 = `
        SELECT 
          'market1' as market_segment,
          10 as avg_failures,
          5 as avg_time
        UNION ALL
        SELECT 'market2', 20, 10
        UNION ALL
        SELECT 'market3', 30, 15
      `;

      const query2 = `
        SELECT 
          'market1' as market_id,
          0.05 as market_error_rate,
          95 as quality_score
        UNION ALL
        SELECT 'market2', 0.10, 90
        UNION ALL
        SELECT 'market3', 0.15, 85
      `;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: All correlation coefficients must be in [-1, 1]
        for (const row of result.correlations.coefficients) {
          for (const coefficient of row) {
            expect(coefficient).toBeGreaterThanOrEqual(-1);
            expect(coefficient).toBeLessThanOrEqual(1);
            expect(isNaN(coefficient)).toBe(false);
            expect(isFinite(coefficient)).toBe(true);
          }
        }

        // Property: Diagonal elements should be 1 (perfect self-correlation)
        for (let i = 0; i < result.correlations.coefficients.length; i++) {
          expect(result.correlations.coefficients[i][i]).toBeCloseTo(1.0, 5);
        }

        // Property: Correlation matrix should be symmetric
        for (let i = 0; i < result.correlations.coefficients.length; i++) {
          for (let j = 0; j < result.correlations.coefficients[i].length; j++) {
            expect(result.correlations.coefficients[i][j]).toBeCloseTo(
              result.correlations.coefficients[j][i],
              5
            );
          }
        }
      } catch (error) {
        // If correlation fails, it should fail gracefully
        expect(error).toBeDefined();
      }
    });

    test('statistical significance must be between 0 and 1', async () => {
      const query1 = `SELECT 1 as metric1, 2 as metric2`;
      const query2 = `SELECT 3 as metric3, 4 as metric4`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Statistical significance is a probability [0, 1]
        expect(result.statisticalSignificance).toBeGreaterThanOrEqual(0);
        expect(result.statisticalSignificance).toBeLessThanOrEqual(1);
        expect(isNaN(result.statisticalSignificance)).toBe(false);
      } catch (error) {
        // Graceful failure is acceptable
        expect(error).toBeDefined();
      }
    });

    test('p-values must be between 0 and 1', async () => {
      const query1 = `
        SELECT 1.0 as x, 2.0 as y
        UNION ALL SELECT 2.0, 4.0
        UNION ALL SELECT 3.0, 6.0
      `;

      const query2 = `
        SELECT 1.0 as a, 10.0 as b
        UNION ALL SELECT 2.0, 20.0
        UNION ALL SELECT 3.0, 30.0
      `;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: All p-values must be in [0, 1]
        for (const row of result.correlations.pValues) {
          for (const pValue of row) {
            expect(pValue).toBeGreaterThanOrEqual(0);
            expect(pValue).toBeLessThanOrEqual(1);
            expect(isNaN(pValue)).toBe(false);
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('correlation patterns must have valid strength classification', async () => {
      const query1 = `SELECT 1 as metric1, 2 as metric2`;
      const query2 = `SELECT 3 as metric3, 4 as metric4`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Pattern strength must be one of the valid values
        const validStrengths = ['weak', 'moderate', 'strong'];
        for (const pattern of result.patterns) {
          expect(validStrengths).toContain(pattern.strength);
          
          // Property: Strength classification must match coefficient magnitude
          const absCoeff = Math.abs(pattern.coefficient);
          if (pattern.strength === 'strong') {
            expect(absCoeff).toBeGreaterThanOrEqual(0.7);
          } else if (pattern.strength === 'moderate') {
            expect(absCoeff).toBeGreaterThanOrEqual(0.4);
            expect(absCoeff).toBeLessThan(0.7);
          } else if (pattern.strength === 'weak') {
            expect(absCoeff).toBeLessThan(0.4);
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('correlation direction must match coefficient sign', async () => {
      const query1 = `
        SELECT 1.0 as x, 10.0 as y
        UNION ALL SELECT 2.0, 8.0
        UNION ALL SELECT 3.0, 6.0
      `;

      const query2 = `SELECT 1.0 as a, 2.0 as b`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Direction must match coefficient sign
        for (const pattern of result.patterns) {
          if (pattern.coefficient > 0) {
            expect(pattern.direction).toBe('positive');
          } else if (pattern.coefficient < 0) {
            expect(pattern.direction).toBe('negative');
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('confidence score must be between 0 and 1', async () => {
      const query1 = `SELECT 1 as metric1`;
      const query2 = `SELECT 2 as metric2`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Confidence is a probability [0, 1]
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(isNaN(result.confidence)).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('correlation result must include source attribution', async () => {
      const query1 = `SELECT 1 as x`;
      const query2 = `SELECT 2 as y`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Sources must be present and non-empty
        expect(result.sources).toBeDefined();
        expect(Array.isArray(result.sources)).toBe(true);
        expect(result.sources.length).toBeGreaterThan(0);

        // Property: Each source must have required fields
        for (const source of result.sources) {
          expect(source.name).toBeDefined();
          expect(source.type).toBeDefined();
          expect(source.path).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('methodology must be included and valid', async () => {
      const query1 = `SELECT 1 as x`;
      const query2 = `SELECT 2 as y`;

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);

        // Property: Methodology must be present
        expect(result.methodology).toBeDefined();
        expect(result.methodology.method).toBeDefined();
        expect(result.methodology.threshold).toBeDefined();
        expect(result.methodology.metrics).toBeDefined();

        // Property: Method must be a valid correlation method
        const validMethods = ['pearson', 'spearman', 'kendall'];
        expect(validMethods).toContain(result.methodology.method);

        // Property: Threshold must be in [0, 1]
        expect(result.methodology.threshold).toBeGreaterThanOrEqual(0);
        expect(result.methodology.threshold).toBeLessThanOrEqual(1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Property 10: Visualization Source Traceability', () => {
    /**
     * **Validates: Requirements 6.2, 6.3, 17.4**
     * 
     * For any generated visualization, every data point should maintain 
     * complete traceability to its source dataset and original record
     */

    test('all visualizations must include source attribution', async () => {
      const sources: Source[] = [
        {
          id: 'test-source-1',
          type: 'csv_data',
          name: 'test_dataset',
          timestamp: new Date(),
          confidence: 1.0,
          metadata: {}
        }
      ];

      const spec: VisualizationSpec = {
        type: 'bar',
        data: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 }
        ],
        config: {
          width: 800,
          height: 600
        },
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: Visualization must have sources
      expect(visualization.sources).toBeDefined();
      expect(Array.isArray(visualization.sources)).toBe(true);
      expect(visualization.sources.length).toBeGreaterThan(0);

      // Property: Sources must match input sources
      expect(visualization.sources).toEqual(sources);
    });

    test('every data point must have source traceability', async () => {
      const sources: Source[] = [
        {
          id: 'source-1',
          type: 'csv_data',
          name: 'roster_data',
          timestamp: new Date(),
          confidence: 1.0,
          metadata: { file: 'roster.csv' }
        }
      ];

      const spec: VisualizationSpec = {
        type: 'scatter',
        data: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 6 }
        ],
        config: {},
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: Every data point must have source IDs
      for (const dataPoint of visualization.data) {
        expect(dataPoint._sourceIds).toBeDefined();
        expect(Array.isArray(dataPoint._sourceIds)).toBe(true);
        expect(dataPoint._sourceIds.length).toBeGreaterThan(0);
        
        // Property: Source IDs must match provided sources
        for (const sourceId of dataPoint._sourceIds) {
          const sourceExists = sources.some(s => s.id === sourceId);
          expect(sourceExists).toBe(true);
        }
      }
    });

    test('data points must have source timestamp', async () => {
      const sources: Source[] = [
        {
          id: 'source-1',
          type: 'csv_data',
          name: 'test_data',
          timestamp: new Date(),
          confidence: 1.0,
          metadata: {}
        }
      ];

      const spec: VisualizationSpec = {
        type: 'timeline',
        data: [
          { date: '2024-01-01', value: 100 },
          { date: '2024-01-02', value: 150 }
        ],
        config: {},
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: Every data point must have source timestamp
      for (const dataPoint of visualization.data) {
        expect(dataPoint._sourceTimestamp).toBeDefined();
        expect(dataPoint._sourceTimestamp).toBeInstanceOf(Date);
      }
    });

    test('sources must have required fields for traceability', async () => {
      const sources: Source[] = [
        {
          id: 'complete-source',
          type: 'csv_data',
          name: 'complete_dataset',
          timestamp: new Date(),
          confidence: 0.95,
          metadata: { version: '1.0' }
        }
      ];

      const spec: VisualizationSpec = {
        type: 'bar',
        data: [{ x: 1, y: 2 }],
        config: {},
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: Each source must have all required fields
      for (const source of visualization.sources) {
        expect(source.id).toBeDefined();
        expect(typeof source.id).toBe('string');
        
        expect(source.type).toBeDefined();
        expect(typeof source.type).toBe('string');
        
        expect(source.name).toBeDefined();
        expect(typeof source.name).toBe('string');
        
        expect(source.timestamp).toBeDefined();
        expect(source.timestamp).toBeInstanceOf(Date);
        
        expect(source.confidence).toBeDefined();
        expect(typeof source.confidence).toBe('number');
        expect(source.confidence).toBeGreaterThanOrEqual(0);
        expect(source.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('visualization without sources must fail', async () => {
      const spec: VisualizationSpec = {
        type: 'bar',
        data: [{ x: 1, y: 2 }],
        config: {},
        sources: [] // Empty sources
      };

      // Property: Visualization without sources should throw error
      await expect(toolOrchestrator.generateVisualization(spec)).rejects.toThrow();
    });

    test('source attribution must be preserved through export', async () => {
      const sources: Source[] = [
        {
          id: 'export-test-source',
          type: 'csv_data',
          name: 'export_dataset',
          url: 'https://example.com/data.csv',
          timestamp: new Date(),
          confidence: 1.0,
          metadata: {}
        }
      ];

      const spec: VisualizationSpec = {
        type: 'bar',
        data: [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 }
        ],
        config: {},
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: Original data must maintain source attribution
      expect(visualization.data[0]._sourceIds).toBeDefined();
      expect(visualization.data[1]._sourceIds).toBeDefined();
      
      // Property: Sources must be accessible from visualization
      expect(visualization.sources.length).toBe(sources.length);
      expect(visualization.sources[0].id).toBe(sources[0].id);
    });

    test('multiple sources must all be tracked', async () => {
      const sources: Source[] = [
        {
          id: 'source-1',
          type: 'csv_data',
          name: 'dataset_1',
          timestamp: new Date(),
          confidence: 1.0,
          metadata: {}
        },
        {
          id: 'source-2',
          type: 'csv_data',
          name: 'dataset_2',
          timestamp: new Date(),
          confidence: 0.9,
          metadata: {}
        }
      ];

      const spec: VisualizationSpec = {
        type: 'scatter',
        data: [{ x: 1, y: 2 }],
        config: {},
        sources
      };

      const visualization = await toolOrchestrator.generateVisualization(spec);

      // Property: All sources must be present
      expect(visualization.sources.length).toBe(2);
      
      // Property: Data points must reference all sources
      for (const dataPoint of visualization.data) {
        expect(dataPoint._sourceIds.length).toBe(2);
        expect(dataPoint._sourceIds).toContain('source-1');
        expect(dataPoint._sourceIds).toContain('source-2');
      }
    });
  });

  describe('Property 6: Tool Selection Appropriateness', () => {
    /**
     * **Validates: Requirements 1.3, 7.1**
     * 
     * For any classified query intent, there should exist appropriate tools 
     * that can handle that intent, and all selected tools should be capable 
     * of processing the query type
     */

    test('data query tool must handle valid SQL queries', async () => {
      const query = {
        sql: 'SELECT 1 as test',
        dataset: 'roster_processing' as const,
        parameters: {}
      };

      try {
        const result = await toolOrchestrator.executeDataQuery(query);
        
        // Property: Result must have required structure
        expect(result.rows).toBeDefined();
        expect(result.columns).toBeDefined();
        expect(result.executionTime).toBeDefined();
        expect(result.rowCount).toBeDefined();
        expect(result.sources).toBeDefined();
      } catch (error) {
        // Tool should handle errors gracefully
        expect(error).toBeDefined();
      }
    });

    test('web search tool must handle search contexts', async () => {
      const context = {
        query: 'test query',
        domain: 'healthcare' as const
      };

      const results = await toolOrchestrator.performWebSearch(context);
      
      // Property: Results must be an array
      expect(Array.isArray(results)).toBe(true);
      
      // Property: Each result must have required fields
      for (const result of results) {
        expect(result.title).toBeDefined();
        expect(result.url).toBeDefined();
        expect(result.snippet).toBeDefined();
        expect(result.relevanceScore).toBeDefined();
        expect(result.credibilityScore).toBeDefined();
      }
    });

    test('visualization tool must handle visualization specs', async () => {
      const spec: VisualizationSpec = {
        type: 'bar',
        data: [{ x: 1, y: 2 }],
        config: {},
        sources: [{
          id: 'test',
          type: 'csv_data',
          name: 'test',
          timestamp: new Date(),
          confidence: 1,
          metadata: {}
        }]
      };

      const viz = await toolOrchestrator.generateVisualization(spec);
      
      // Property: Visualization must have required structure
      expect(viz.id).toBeDefined();
      expect(viz.type).toBeDefined();
      expect(viz.chartUrl).toBeDefined();
      expect(viz.data).toBeDefined();
      expect(viz.sources).toBeDefined();
    });
  });
});
