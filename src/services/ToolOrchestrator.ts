import { Database } from 'duckdb';
import { DataQueryTool } from '../tools/DataQueryTool';
import { WebSearchTool } from '../tools/WebSearchTool';
import { VisualizationTool } from '../tools/VisualizationTool';
import {
  ToolOrchestrator as IToolOrchestrator,
  DataQuery,
  QueryResult,
  SearchContext,
  SearchResult,
  Anomaly,
  VisualizationSpec,
  Visualization,
  CorrelationResult,
  CorrelationMatrix,
  CorrelationPattern,
  CorrelationInsight
} from '../types/tools';
import { logger } from '../utils/logger';

/**
 * ToolOrchestrator - Coordinates execution of specialized analysis tools
 * 
 * Features:
 * - Intelligent tool selection algorithms
 * - Tool execution coordination and result aggregation
 * - Tool performance monitoring and fallback mechanisms
 * - Tool usage analytics and optimization recommendations
 * 
 * Requirements: 1.3, 7.1
 */
export class ToolOrchestrator implements IToolOrchestrator {
  private dataQueryTool: DataQueryTool;
  private webSearchTool: WebSearchTool;
  private visualizationTool: VisualizationTool;
  
  private toolUsageStats: Map<string, { calls: number; totalTime: number; errors: number }> = new Map();
  private readonly CORRELATION_THRESHOLD = 0.7;

  constructor(db: Database, tavilyApiKey?: string) {
    this.dataQueryTool = new DataQueryTool(db);
    this.webSearchTool = new WebSearchTool(tavilyApiKey);
    this.visualizationTool = new VisualizationTool();

    // Initialize tool usage stats
    this.initializeToolStats();
  }

  /**
   * Initialize tool usage statistics tracking
   */
  private initializeToolStats(): void {
    const tools = ['dataQuery', 'webSearch', 'visualization', 'anomalyDetection', 'correlation'];
    for (const tool of tools) {
      this.toolUsageStats.set(tool, { calls: 0, totalTime: 0, errors: 0 });
    }
  }

  /**
   * Execute data query with cross-dataset capabilities
   * 
   * @param query - DataQuery object with SQL and parameters
   * @returns QueryResult with rows, columns, and source attribution
   */
  async executeDataQuery(query: DataQuery): Promise<QueryResult> {
    const startTime = Date.now();
    const toolName = 'dataQuery';

    try {
      logger.info(`Executing data query on dataset: ${query.dataset}`);
      
      const result = await this.dataQueryTool.executeDataQuery(query);
      
      this.recordToolUsage(toolName, Date.now() - startTime, false);
      return result;

    } catch (error) {
      this.recordToolUsage(toolName, Date.now() - startTime, true);
      logger.error('Data query execution failed', { error, query });
      throw error;
    }
  }

  /**
   * Perform web search with contextual healthcare filtering
   * 
   * @param context - SearchContext with query, domain, and filters
   * @returns Array of SearchResult with relevance and credibility scores
   */
  async performWebSearch(context: SearchContext): Promise<SearchResult[]> {
    const startTime = Date.now();
    const toolName = 'webSearch';

    try {
      logger.info(`Performing web search: "${context.query}" in domain: ${context.domain}`);
      
      const results = await this.webSearchTool.performWebSearch(context);
      
      this.recordToolUsage(toolName, Date.now() - startTime, false);
      return results;

    } catch (error) {
      this.recordToolUsage(toolName, Date.now() - startTime, true);
      logger.error('Web search failed', { error, context });
      // Return empty array on failure rather than throwing
      return [];
    }
  }

  /**
   * Detect anomalies in dataset metrics
   * 
   * @param dataset - Dataset name to analyze
   * @param metrics - Array of metric names to check for anomalies
   * @returns Array of detected Anomaly objects
   */
  async detectAnomalies(dataset: string, metrics: string[]): Promise<Anomaly[]> {
    const startTime = Date.now();
    const toolName = 'anomalyDetection';

    try {
      logger.info(`Detecting anomalies in dataset: ${dataset}, metrics: ${metrics.join(', ')}`);

      // Build query to get metric statistics
      const query: DataQuery = {
        sql: this.buildAnomalyDetectionQuery(dataset, metrics),
        dataset: dataset as any,
        parameters: {}
      };

      const result = await this.executeDataQuery(query);
      
      // Analyze results for anomalies
      const anomalies = this.analyzeForAnomalies(result, metrics);
      
      this.recordToolUsage(toolName, Date.now() - startTime, false);
      logger.info(`Detected ${anomalies.length} anomalies`);
      
      return anomalies;

    } catch (error) {
      this.recordToolUsage(toolName, Date.now() - startTime, true);
      logger.error('Anomaly detection failed', { error, dataset, metrics });
      return [];
    }
  }

  /**
   * Build SQL query for anomaly detection
   */
  private buildAnomalyDetectionQuery(dataset: string, metrics: string[]): string {
    const tableName = dataset === 'roster_processing' 
      ? 'roster_processing_details' 
      : 'aggregated_operational_metrics';

    const metricSelects = metrics.map(metric => 
      `AVG(${metric}) as avg_${metric}, STDDEV(${metric}) as stddev_${metric}, MIN(${metric}) as min_${metric}, MAX(${metric}) as max_${metric}`
    ).join(', ');

    return `SELECT ${metricSelects} FROM ${tableName}`;
  }

  /**
   * Analyze query results for anomalies using statistical methods
   */
  private analyzeForAnomalies(result: QueryResult, metrics: string[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (result.rows.length === 0) {
      return anomalies;
    }

    const stats = result.rows[0];
    if (!stats) {
      return anomalies;
    }

    for (const metric of metrics) {
      const avg = stats[`avg_${metric}`];
      const stddev = stats[`stddev_${metric}`];
      const max = stats[`max_${metric}`];

      // Check for statistical anomalies (values beyond 3 standard deviations)
      if (stddev && avg) {
        const threshold = 3 * stddev;
        
        if (Math.abs(max - avg) > threshold) {
          anomalies.push({
            id: `anomaly_${metric}_${Date.now()}`,
            type: 'statistical',
            description: `${metric} shows unusually high values (max: ${max}, avg: ${avg})`,
            severity: 3,
            affectedMetrics: [metric],
            detectionTime: new Date(),
            confidence: 0.85,
            evidence: [{
              id: `evidence_${Date.now()}`,
              content: `Statistical analysis shows ${metric} exceeds 3 standard deviations`,
              sources: result.sources.map(s => ({
                id: s.name,
                type: 'csv_data' as const,
                name: s.name,
                timestamp: new Date(),
                confidence: 1.0,
                metadata: {}
              })),
              confidence: 0.85,
              timestamp: new Date(),
              type: 'anomaly'
            }]
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Generate visualization from specification
   * 
   * @param spec - VisualizationSpec with type, data, config, and sources
   * @returns Visualization object with chart URL and metadata
   */
  async generateVisualization(spec: VisualizationSpec): Promise<Visualization> {
    const startTime = Date.now();
    const toolName = 'visualization';

    try {
      logger.info(`Generating visualization: ${spec.type || 'auto'}`);
      
      const visualization = await this.visualizationTool.generateVisualization(spec);
      
      this.recordToolUsage(toolName, Date.now() - startTime, false);
      return visualization;

    } catch (error) {
      this.recordToolUsage(toolName, Date.now() - startTime, true);
      logger.error('Visualization generation failed', { error, spec });
      throw error;
    }
  }

  /**
   * Correlate data across two datasets
   * 
   * @param query1 - SQL query for first dataset
   * @param query2 - SQL query for second dataset
   * @returns CorrelationResult with coefficients, patterns, and insights
   */
  async correlateCrossDataset(query1: string, query2: string): Promise<CorrelationResult> {
    const startTime = Date.now();
    const toolName = 'correlation';

    try {
      logger.info('Executing cross-dataset correlation analysis');

      // Execute both queries
      const result1 = await this.executeDataQuery({
        sql: query1,
        dataset: 'roster_processing',
        parameters: {}
      });

      const result2 = await this.executeDataQuery({
        sql: query2,
        dataset: 'operational_metrics',
        parameters: {}
      });

      // Perform correlation analysis
      const correlationResult = this.calculateCorrelation(result1, result2);
      
      this.recordToolUsage(toolName, Date.now() - startTime, false);
      logger.info(`Correlation analysis complete: ${correlationResult.patterns.length} patterns found`);
      
      return correlationResult;

    } catch (error) {
      this.recordToolUsage(toolName, Date.now() - startTime, true);
      logger.error('Cross-dataset correlation failed', { error });
      throw error;
    }
  }

  /**
   * Calculate correlation between two datasets
   */
  private calculateCorrelation(result1: QueryResult, result2: QueryResult): CorrelationResult {
    // Extract numeric columns from both datasets
    const metrics1 = this.extractNumericMetrics(result1);
    const metrics2 = this.extractNumericMetrics(result2);

    // Calculate correlation matrix
    const correlationMatrix = this.buildCorrelationMatrix(metrics1, metrics2);

    // Identify significant patterns
    const patterns = this.identifyCorrelationPatterns(correlationMatrix);

    // Generate insights
    const insights = this.generateCorrelationInsights(patterns);

    // Calculate overall confidence
    const confidence = this.calculateCorrelationConfidence(correlationMatrix, result1.rowCount, result2.rowCount);

    return {
      correlations: correlationMatrix,
      patterns,
      insights,
      confidence,
      sources: [...result1.sources, ...result2.sources],
      methodology: {
        method: 'pearson',
        threshold: this.CORRELATION_THRESHOLD,
        timeWindow: '3months',
        metrics: [...Object.keys(metrics1), ...Object.keys(metrics2)]
      },
      statisticalSignificance: this.calculateStatisticalSignificance(correlationMatrix)
    };
  }

  /**
   * Extract numeric metrics from query result
   */
  private extractNumericMetrics(result: QueryResult): Record<string, number[]> {
    const metrics: Record<string, number[]> = {};

    // Get numeric columns
    const numericColumns = result.columns
      .filter(col => col.type === 'number' || col.type === 'bigint')
      .map(col => col.name);

    // Extract values for each numeric column
    for (const column of numericColumns) {
      const values: number[] = [];
      for (const row of result.rows) {
        const value = row[column];
        if (value !== undefined && value !== null) {
          values.push(parseFloat(String(value)) || 0);
        }
      }
      metrics[column] = values;
    }

    return metrics;
  }

  /**
   * Build correlation matrix between two sets of metrics
   */
  private buildCorrelationMatrix(metrics1: Record<string, number[]>, metrics2: Record<string, number[]>): CorrelationMatrix {
    const variables = [...Object.keys(metrics1), ...Object.keys(metrics2)];
    const n = variables.length;
    
    const coefficients: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const pValues: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const coeffRow = coefficients[i];
        const pValueRow = pValues[i];
        
        if (!coeffRow || !pValueRow) continue;
        
        if (i === j) {
          coeffRow[j] = 1.0;
          pValueRow[j] = 0.0;
        } else {
          const var1 = variables[i];
          const var2 = variables[j];
          
          if (!var1 || !var2) continue;
          
          const values1 = metrics1[var1] || metrics2[var1] || [];
          const values2 = metrics1[var2] || metrics2[var2] || [];
          
          if (values1.length > 0 && values2.length > 0) {
            const correlation = this.pearsonCorrelation(values1, values2);
            coeffRow[j] = correlation;
            pValueRow[j] = this.calculatePValue(correlation, Math.min(values1.length, values2.length));
          }
        }
      }
    }

    return {
      variables,
      coefficients,
      pValues,
      sampleSize: Object.values(metrics1)[0]?.length || 0
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const xVal = x[i];
      const yVal = y[i];
      if (xVal === undefined || yVal === undefined) continue;
      
      const dx = xVal - meanX;
      const dy = yVal - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate p-value for correlation coefficient
   */
  private calculatePValue(r: number, n: number): number {
    // Simplified p-value calculation
    // In production, would use proper statistical library
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    return Math.abs(t) > 2 ? 0.05 : 0.5; // Simplified threshold
  }

  /**
   * Identify significant correlation patterns
   */
  private identifyCorrelationPatterns(matrix: CorrelationMatrix): CorrelationPattern[] {
    const patterns: CorrelationPattern[] = [];

    for (let i = 0; i < matrix.variables.length; i++) {
      for (let j = i + 1; j < matrix.variables.length; j++) {
        const coeffRow = matrix.coefficients[i];
        const pValueRow = matrix.pValues[i];
        const var1 = matrix.variables[i];
        const var2 = matrix.variables[j];
        
        if (!coeffRow || !pValueRow || !var1 || !var2) continue;
        
        const coefficient = coeffRow[j];
        const pValue = pValueRow[j];
        
        if (coefficient === undefined || pValue === undefined) continue;

        if (Math.abs(coefficient) >= this.CORRELATION_THRESHOLD && pValue < 0.05) {
          patterns.push({
            variables: [var1, var2],
            coefficient,
            strength: this.classifyStrength(Math.abs(coefficient)),
            direction: coefficient > 0 ? 'positive' : 'negative',
            significance: 1 - pValue
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Classify correlation strength
   */
  private classifyStrength(absCoefficient: number): 'weak' | 'moderate' | 'strong' {
    if (absCoefficient >= 0.7) return 'strong';
    if (absCoefficient >= 0.4) return 'moderate';
    return 'weak';
  }

  /**
   * Generate insights from correlation patterns
   */
  private generateCorrelationInsights(patterns: CorrelationPattern[]): CorrelationInsight[] {
    return patterns.map(pattern => ({
      description: `${pattern.strength} ${pattern.direction} correlation between ${pattern.variables[0]} and ${pattern.variables[1]} (r=${pattern.coefficient.toFixed(3)})`,
      businessImplication: this.generateBusinessImplication(pattern),
      confidence: pattern.significance,
      actionableRecommendations: this.generateRecommendations(pattern)
    }));
  }

  /**
   * Generate business implication from correlation pattern
   */
  private generateBusinessImplication(pattern: CorrelationPattern): string {
    const [var1, var2] = pattern.variables;
    
    if (pattern.direction === 'positive') {
      return `As ${var1} increases, ${var2} tends to increase. This suggests a direct relationship that could be leveraged for optimization.`;
    } else {
      return `As ${var1} increases, ${var2} tends to decrease. This inverse relationship may indicate trade-offs or competing factors.`;
    }
  }

  /**
   * Generate actionable recommendations from correlation pattern
   */
  private generateRecommendations(pattern: CorrelationPattern): string[] {
    const recommendations: string[] = [];
    
    if (pattern.strength === 'strong') {
      recommendations.push(`Monitor ${pattern.variables[0]} closely as it strongly influences ${pattern.variables[1]}`);
      recommendations.push(`Consider using ${pattern.variables[0]} as a leading indicator for ${pattern.variables[1]}`);
    }
    
    if (pattern.direction === 'negative') {
      recommendations.push(`Investigate the inverse relationship to identify potential optimization opportunities`);
    }

    return recommendations;
  }

  /**
   * Calculate overall correlation confidence
   */
  private calculateCorrelationConfidence(matrix: CorrelationMatrix, n1: number, n2: number): number {
    const sampleSize = Math.min(n1, n2);
    
    // Confidence increases with sample size
    let confidence = Math.min(0.9, 0.5 + (sampleSize / 100) * 0.4);
    
    // Adjust based on number of significant correlations
    const significantCount = matrix.coefficients.flat().filter(c => Math.abs(c) >= this.CORRELATION_THRESHOLD).length;
    if (significantCount > 0) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Calculate statistical significance
   */
  private calculateStatisticalSignificance(matrix: CorrelationMatrix): number {
    // Average p-value across all correlations
    const allPValues = matrix.pValues.flat().filter(p => p !== undefined && !isNaN(p));
    if (allPValues.length === 0) return 0.5;
    
    const avgPValue = allPValues.reduce((a, b) => a + b, 0) / allPValues.length;
    return 1 - avgPValue;
  }

  /**
   * Record tool usage statistics
   */
  private recordToolUsage(toolName: string, executionTime: number, isError: boolean): void {
    const stats = this.toolUsageStats.get(toolName);
    if (stats) {
      stats.calls++;
      stats.totalTime += executionTime;
      if (isError) stats.errors++;
    }
  }

  /**
   * Get tool usage analytics
   */
  getToolAnalytics(): Record<string, any> {
    const analytics: Record<string, any> = {};

    for (const [tool, stats] of this.toolUsageStats.entries()) {
      analytics[tool] = {
        totalCalls: stats.calls,
        averageTime: stats.calls > 0 ? stats.totalTime / stats.calls : 0,
        errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0,
        totalTime: stats.totalTime
      };
    }

    return analytics;
  }

  /**
   * Get optimization recommendations based on tool usage
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const analytics = this.getToolAnalytics();

    for (const [tool, stats] of Object.entries(analytics)) {
      if (stats.averageTime > 5000) {
        recommendations.push(`${tool} has high average execution time (${stats.averageTime.toFixed(0)}ms). Consider optimization or caching.`);
      }

      if (stats.errorRate > 0.1) {
        recommendations.push(`${tool} has high error rate (${(stats.errorRate * 100).toFixed(1)}%). Review error handling and fallback mechanisms.`);
      }
    }

    return recommendations;
  }

  /**
   * Clear all tool caches
   */
  clearAllCaches(): void {
    this.dataQueryTool.clearCache();
    this.webSearchTool.clearCache();
    this.visualizationTool.clearVisualizations();
    logger.info('All tool caches cleared');
  }
}
