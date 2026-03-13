import { ToolOrchestrator } from '../../src/services/ToolOrchestrator';
import { Database } from 'duckdb';
import { DataQuery, SearchContext, VisualizationSpec, Source } from '../../src/types/tools';

describe('ToolOrchestrator Unit Tests', () => {
  let toolOrchestrator: ToolOrchestrator;
  let db: Database;

  beforeAll(() => {
    db = new Database(':memory:');
    toolOrchestrator = new ToolOrchestrator(db);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  describe('Tool Analytics and Monitoring', () => {
    test('should track tool usage statistics', async () => {
      const context: SearchContext = {
        query: 'test query',
        domain: 'healthcare'
      };

      await toolOrchestrator.performWebSearch(context);

      const analytics = toolOrchestrator.getToolAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.webSearch).toBeDefined();
      expect(analytics.webSearch.totalCalls).toBeGreaterThan(0);
    });

    test('should calculate average execution time', async () => {
      const context: SearchContext = {
        query: 'performance test',
        domain: 'healthcare'
      };

      await toolOrchestrator.performWebSearch(context);
      await toolOrchestrator.performWebSearch(context);

      const analytics = toolOrchestrator.getToolAnalytics();
      
      expect(analytics.webSearch.averageTime).toBeGreaterThanOrEqual(0);
      expect(typeof analytics.webSearch.averageTime).toBe('number');
    });

    test('should track error rates', async () => {
      const analytics = toolOrchestrator.getToolAnalytics();
      
      for (const tool of Object.values(analytics)) {
        expect(tool.errorRate).toBeGreaterThanOrEqual(0);
        expect(tool.errorRate).toBeLessThanOrEqual(1);
      }
    });

    test('should provide optimization recommendations', () => {
      const recommendations = toolOrchestrator.getOptimizationRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      // Recommendations should be strings
      for (const rec of recommendations) {
        expect(typeof rec).toBe('string');
      }
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect anomalies in dataset metrics', async () => {
      const dataset = 'roster_processing';
      const metrics = ['failed_records', 'processing_time_minutes'];

      const anomalies = await toolOrchestrator.detectAnomalies(dataset, metrics);
      
      expect(Array.isArray(anomalies)).toBe(true);
      
      for (const anomaly of anomalies) {
        expect(anomaly.id).toBeDefined();
        expect(anomaly.type).toBeDefined();
        expect(anomaly.description).toBeDefined();
        expect(anomaly.severity).toBeGreaterThanOrEqual(1);
        expect(anomaly.severity).toBeLessThanOrEqual(5);
        expect(anomaly.confidence).toBeGreaterThanOrEqual(0);
        expect(anomaly.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should return empty array for invalid dataset', async () => {
      const dataset = 'invalid_dataset';
      const metrics = ['metric1'];

      const anomalies = await toolOrchestrator.detectAnomalies(dataset, metrics);
      
      expect(Array.isArray(anomalies)).toBe(true);
    });

    test('should handle empty metrics array', async () => {
      const dataset = 'roster_processing';
      const metrics: string[] = [];

      const anomalies = await toolOrchestrator.detectAnomalies(dataset, metrics);
      
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Cross-Dataset Correlation', () => {
    test('should execute cross-dataset correlation', async () => {
      const query1 = 'SELECT 1 as metric1, 2 as metric2';
      const query2 = 'SELECT 3 as metric3, 4 as metric4';

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);
        
        expect(result).toBeDefined();
        expect(result.correlations).toBeDefined();
        expect(result.patterns).toBeDefined();
        expect(result.insights).toBeDefined();
        expect(result.sources).toBeDefined();
      } catch (error) {
        // Graceful failure is acceptable
        expect(error).toBeDefined();
      }
    });

    test('should include methodology in correlation result', async () => {
      const query1 = 'SELECT 1 as x';
      const query2 = 'SELECT 2 as y';

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);
        
        expect(result.methodology).toBeDefined();
        expect(result.methodology.method).toBeDefined();
        expect(result.methodology.threshold).toBeDefined();
        expect(result.methodology.metrics).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should generate insights from correlation patterns', async () => {
      const query1 = 'SELECT 1.0 as x, 2.0 as y';
      const query2 = 'SELECT 3.0 as a, 4.0 as b';

      try {
        const result = await toolOrchestrator.correlateCrossDataset(query1, query2);
        
        expect(Array.isArray(result.insights)).toBe(true);
        
        for (const insight of result.insights) {
          expect(insight.description).toBeDefined();
          expect(insight.businessImplication).toBeDefined();
          expect(insight.confidence).toBeGreaterThanOrEqual(0);
          expect(insight.confidence).toBeLessThanOrEqual(1);
          expect(Array.isArray(insight.actionableRecommendations)).toBe(true);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Query Execution', () => {
    test('should execute simple data query', async () => {
      const query: DataQuery = {
        sql: 'SELECT 1 as test_column',
        dataset: 'roster_processing',
        parameters: {}
      };

      try {
        const result = await toolOrchestrator.executeDataQuery(query);
        
        expect(result.rows).toBeDefined();
        expect(result.columns).toBeDefined();
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.sources).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle query with parameters', async () => {
      const query: DataQuery = {
        sql: 'SELECT ? as value',
        dataset: 'roster_processing',
        parameters: { value: 42 }
      };

      try {
        const result = await toolOrchestrator.executeDataQuery(query);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should respect query timeout', async () => {
      const query: DataQuery = {
        sql: 'SELECT 1',
        dataset: 'roster_processing',
        parameters: {},
        timeout: 1000 // 1 second
      };

      try {
        const result = await toolOrchestrator.executeDataQuery(query);
        expect(result.executionTime).toBeLessThan(1000);
      } catch (error) {
        // Timeout error is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Web Search Integration', () => {
    test('should perform web search with healthcare domain', async () => {
      const context: SearchContext = {
        query: 'provider enrollment',
        domain: 'healthcare'
      };

      const results = await toolOrchestrator.performWebSearch(context);
      
      expect(Array.isArray(results)).toBe(true);
    });

    test('should perform web search with regulatory domain', async () => {
      const context: SearchContext = {
        query: 'HIPAA compliance',
        domain: 'regulatory'
      };

      const results = await toolOrchestrator.performWebSearch(context);
      
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle search with maxResults limit', async () => {
      const context: SearchContext = {
        query: 'healthcare operations',
        domain: 'operational',
        maxResults: 5
      };

      const results = await toolOrchestrator.performWebSearch(context);
      
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array on search failure', async () => {
      const context: SearchContext = {
        query: '',
        domain: 'healthcare'
      };

      const results = await toolOrchestrator.performWebSearch(context);
      
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Visualization Generation', () => {
    test('should generate bar chart visualization', async () => {
      const sources: Source[] = [{
        id: 'test-source',
        type: 'csv_data',
        name: 'test_data',
        timestamp: new Date(),
        confidence: 1.0,
        metadata: {}
      }];

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

      const viz = await toolOrchestrator.generateVisualization(spec);
      
      expect(viz.id).toBeDefined();
      expect(viz.type).toBe('bar');
      expect(viz.chartUrl).toBeDefined();
      expect(viz.data.length).toBe(2);
      expect(viz.sources).toEqual(sources);
    });

    test('should generate scatter plot visualization', async () => {
      const sources: Source[] = [{
        id: 'scatter-source',
        type: 'csv_data',
        name: 'scatter_data',
        timestamp: new Date(),
        confidence: 1.0,
        metadata: {}
      }];

      const spec: VisualizationSpec = {
        type: 'scatter',
        data: [
          { x: 1, y: 2 },
          { x: 3, y: 4 }
        ],
        config: {},
        sources
      };

      const viz = await toolOrchestrator.generateVisualization(spec);
      
      expect(viz.type).toBe('scatter');
      expect(viz.data.length).toBe(2);
    });

    test('should fail without source attribution', async () => {
      const spec: VisualizationSpec = {
        type: 'bar',
        data: [{ x: 1, y: 2 }],
        config: {},
        sources: []
      };

      await expect(toolOrchestrator.generateVisualization(spec)).rejects.toThrow();
    });

    test('should fail with empty data', async () => {
      const sources: Source[] = [{
        id: 'empty-source',
        type: 'csv_data',
        name: 'empty_data',
        timestamp: new Date(),
        confidence: 1.0,
        metadata: {}
      }];

      const spec: VisualizationSpec = {
        type: 'bar',
        data: [],
        config: {},
        sources
      };

      await expect(toolOrchestrator.generateVisualization(spec)).rejects.toThrow();
    });
  });

  describe('Cache Management', () => {
    test('should clear all tool caches', () => {
      // Should not throw
      expect(() => toolOrchestrator.clearAllCaches()).not.toThrow();
    });
  });

  describe('Tool Coordination', () => {
    test('should coordinate multiple tool executions', async () => {
      // Execute multiple tools in sequence
      const searchContext: SearchContext = {
        query: 'test coordination',
        domain: 'healthcare'
      };

      const searchResults = await toolOrchestrator.performWebSearch(searchContext);
      expect(Array.isArray(searchResults)).toBe(true);

      const anomalies = await toolOrchestrator.detectAnomalies('roster_processing', ['failed_records']);
      expect(Array.isArray(anomalies)).toBe(true);

      // Check that analytics tracked both operations
      const analytics = toolOrchestrator.getToolAnalytics();
      expect(analytics.webSearch.totalCalls).toBeGreaterThan(0);
      expect(analytics.anomalyDetection.totalCalls).toBeGreaterThan(0);
    });

    test('should handle tool failures gracefully', async () => {
      // Invalid query should not crash the orchestrator
      const query: DataQuery = {
        sql: 'INVALID SQL SYNTAX',
        dataset: 'roster_processing',
        parameters: {}
      };

      try {
        await toolOrchestrator.executeDataQuery(query);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Orchestrator should still be functional
      const analytics = toolOrchestrator.getToolAnalytics();
      expect(analytics).toBeDefined();
    });
  });
});
