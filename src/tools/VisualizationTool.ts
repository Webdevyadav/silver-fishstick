import { v4 as uuidv4 } from 'uuid';
import { VisualizationSpec, Visualization, ChartConfig, Source } from '../types/tools';
import { logger } from '../utils/logger';

/**
 * VisualizationTool - Generates visualizations with source attribution
 * 
 * Features:
 * - Multiple chart types (trend, correlation, sankey, etc.)
 * - Automatic chart type selection
 * - Comprehensive source attribution
 * - Interactive drill-down capabilities
 * - Export functionality
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */
export class VisualizationTool {
  private visualizationRegistry: Map<string, Visualization> = new Map();

  /**
   * Generate visualization from specification
   * 
   * @param spec - VisualizationSpec with type, data, config, and sources
   * @returns Visualization object with chart URL and metadata
   */
  async generateVisualization(spec: VisualizationSpec): Promise<Visualization> {
    try {
      // Validate specification
      this.validateSpec(spec);

      // Auto-select chart type if not specified or validate specified type
      const chartType = spec.type || this.selectChartType(spec.data);

      // Validate source attribution
      this.validateSourceAttribution(spec);

      // Generate visualization
      const visualization = await this.createVisualization(spec, chartType);

      // Register visualization for tracking
      this.visualizationRegistry.set(visualization.id, visualization);

      logger.info(`Visualization generated: ${visualization.id} (${chartType})`);
      return visualization;

    } catch (error) {
      logger.error('Visualization generation failed', { error, spec });
      throw new Error(`Visualization generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create visualization object
   */
  private async createVisualization(spec: VisualizationSpec, chartType: string): Promise<Visualization> {
    const id = uuidv4();
    
    // Generate chart URL (in production, this would call a charting service)
    const chartUrl = this.generateChartUrl(id, chartType, spec);

    // Ensure all data points have source attribution
    const attributedData = this.ensureSourceAttribution(spec.data, spec.sources);

    const visualization: Visualization = {
      id,
      type: chartType,
      title: spec.title || this.generateTitle(chartType, spec.data),
      description: spec.description || this.generateDescription(chartType, spec.data),
      chartUrl,
      data: attributedData,
      config: this.normalizeConfig(spec.config),
      sources: spec.sources,
      createdAt: new Date(),
      interactive: spec.config.interactive !== false
    };

    return visualization;
  }

  /**
   * Automatically select appropriate chart type based on data characteristics
   */
  private selectChartType(data: any[]): string {
    if (!data || data.length === 0) {
      return 'bar';
    }

    const firstRow = data[0];
    const keys = Object.keys(firstRow);

    // Check for time series data
    if (this.hasTimeColumn(keys, data)) {
      return 'timeline';
    }

    // Check for correlation data (two numeric columns)
    const numericColumns = this.getNumericColumns(keys, data);
    if (numericColumns.length === 2) {
      return 'scatter';
    }

    // Check for distribution data
    if (numericColumns.length === 1 && data.length > 20) {
      return 'distribution';
    }

    // Check for flow/sankey data (has source, target, value)
    if (keys.includes('source') && keys.includes('target') && keys.includes('value')) {
      return 'sankey';
    }

    // Check for categorical data with values
    if (keys.length === 2 && numericColumns.length === 1) {
      return 'bar';
    }

    // Default to bar chart
    return 'bar';
  }

  /**
   * Check if data has time-based column
   */
  private hasTimeColumn(keys: string[], data: any[]): boolean {
    const timeKeywords = ['date', 'time', 'timestamp', 'month', 'year', 'day'];
    
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if (timeKeywords.some(keyword => lowerKey.includes(keyword))) {
        // Verify it's actually a date
        const value = data[0][key];
        if (value instanceof Date || !isNaN(Date.parse(value))) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get numeric columns from data
   */
  private getNumericColumns(keys: string[], data: any[]): string[] {
    return keys.filter(key => {
      const value = data[0][key];
      return typeof value === 'number' || !isNaN(parseFloat(value));
    });
  }

  /**
   * Validate visualization specification
   */
  private validateSpec(spec: VisualizationSpec): void {
    if (!spec.data || !Array.isArray(spec.data)) {
      throw new Error('Visualization spec must include data array');
    }

    if (spec.data.length === 0) {
      throw new Error('Visualization data cannot be empty');
    }

    if (!spec.sources || spec.sources.length === 0) {
      throw new Error('Visualization must include source attribution');
    }

    if (!spec.config) {
      throw new Error('Visualization must include config');
    }
  }

  /**
   * Validate that all data points have source attribution
   */
  private validateSourceAttribution(spec: VisualizationSpec): void {
    // Ensure sources are provided
    if (!spec.sources || spec.sources.length === 0) {
      throw new Error('Visualization must include at least one source');
    }

    // Verify each source has required fields
    for (const source of spec.sources) {
      if (!source.id || !source.type || !source.name) {
        throw new Error('Each source must have id, type, and name');
      }
    }
  }

  /**
   * Ensure all data points maintain source attribution
   */
  private ensureSourceAttribution(data: any[], sources: Source[]): any[] {
    // Add source IDs to each data point for traceability
    return data.map(row => ({
      ...row,
      _sourceIds: sources.map(s => s.id),
      _sourceTimestamp: new Date()
    }));
  }

  /**
   * Generate chart URL (placeholder for actual charting service)
   */
  private generateChartUrl(id: string, chartType: string, spec: VisualizationSpec): string {
    // In production, this would generate a URL to a charting service
    // For now, return a placeholder URL
    const baseUrl = process.env.CHART_SERVICE_URL || 'https://charts.rosteriq.com';
    return `${baseUrl}/chart/${id}?type=${chartType}`;
  }

  /**
   * Generate title based on chart type and data
   */
  private generateTitle(chartType: string, data: any[]): string {
    const titles: Record<string, string> = {
      trend: 'Trend Analysis',
      correlation: 'Correlation Analysis',
      distribution: 'Distribution Analysis',
      heatmap: 'Heatmap Visualization',
      sankey: 'Flow Diagram',
      scatter: 'Scatter Plot Analysis',
      bar: 'Bar Chart',
      timeline: 'Timeline View'
    };

    return titles[chartType] || 'Data Visualization';
  }

  /**
   * Generate description based on chart type and data
   */
  private generateDescription(chartType: string, data: any[]): string {
    const rowCount = data.length;
    const columnCount = Object.keys(data[0] || {}).length;

    return `${chartType} visualization with ${rowCount} data points across ${columnCount} dimensions`;
  }

  /**
   * Normalize chart configuration with defaults
   */
  private normalizeConfig(config: ChartConfig): ChartConfig {
    return {
      width: config.width || 800,
      height: config.height || 600,
      theme: config.theme || 'light',
      colors: config.colors || this.getDefaultColors(),
      axes: config.axes || [],
      legend: config.legend || { show: true, position: 'right' },
      interactive: config.interactive !== false
    };
  }

  /**
   * Get default color palette
   */
  private getDefaultColors(): string[] {
    return [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16'  // lime
    ];
  }

  /**
   * Export visualization data with source attribution
   */
  async exportVisualization(visualizationId: string, format: 'json' | 'csv' | 'png'): Promise<Buffer | string> {
    const visualization = this.visualizationRegistry.get(visualizationId);
    
    if (!visualization) {
      throw new Error(`Visualization not found: ${visualizationId}`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(visualization, null, 2);
      
      case 'csv':
        return this.exportToCsv(visualization);
      
      case 'png':
        // In production, would generate PNG from chart service
        throw new Error('PNG export not yet implemented');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export visualization data to CSV format
   */
  private exportToCsv(visualization: Visualization): string {
    const data = visualization.data;
    if (data.length === 0) return '';

    // Get headers (excluding internal fields)
    const headers = Object.keys(data[0]).filter(key => !key.startsWith('_'));
    
    // Build CSV
    const rows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      rows.push(values.join(','));
    }

    // Add source attribution as comments
    rows.push('');
    rows.push('# Source Attribution:');
    for (const source of visualization.sources) {
      rows.push(`# ${source.name} (${source.type}): ${source.url || 'N/A'}`);
    }

    return rows.join('\n');
  }

  /**
   * Get visualization by ID
   */
  getVisualization(id: string): Visualization | undefined {
    return this.visualizationRegistry.get(id);
  }

  /**
   * List all visualizations
   */
  listVisualizations(): Visualization[] {
    return Array.from(this.visualizationRegistry.values());
  }

  /**
   * Delete visualization
   */
  deleteVisualization(id: string): boolean {
    return this.visualizationRegistry.delete(id);
  }

  /**
   * Clear all visualizations
   */
  clearVisualizations(): void {
    this.visualizationRegistry.clear();
    logger.info('All visualizations cleared');
  }

  /**
   * Get visualization statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const visualizations = Array.from(this.visualizationRegistry.values());
    
    const byType: Record<string, number> = {};
    for (const viz of visualizations) {
      byType[viz.type] = (byType[viz.type] || 0) + 1;
    }

    return {
      total: visualizations.length,
      byType
    };
  }
}
