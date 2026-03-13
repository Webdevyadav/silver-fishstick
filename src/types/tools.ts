// Tool orchestrator and tool interfaces

export interface ToolOrchestrator {
  executeDataQuery(query: DataQuery): Promise<QueryResult>;
  performWebSearch(context: SearchContext): Promise<SearchResult[]>;
  detectAnomalies(dataset: string, metrics: string[]): Promise<Anomaly[]>;
  generateVisualization(spec: VisualizationSpec): Promise<Visualization>;
  correlateCrossDataset(query1: string, query2: string): Promise<CorrelationResult>;
}

export interface DataQuery {
  sql: string;
  dataset: 'roster_processing' | 'operational_metrics' | 'cross_dataset';
  parameters: Record<string, any>;
  cacheKey?: string;
  timeout?: number;
}

export interface QueryResult {
  rows: Record<string, any>[];
  columns: ColumnInfo[];
  executionTime: number;
  rowCount: number;
  sources: DataSource[];
  cached: boolean;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface DataSource {
  name: string;
  type: 'csv' | 'database' | 'api';
  path: string;
  lastModified: Date;
  checksum: string;
}

export interface SearchContext {
  query: string;
  domain: 'healthcare' | 'regulatory' | 'operational';
  timeframe?: DateRange;
  sources?: string[];
  maxResults?: number;
}
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  credibilityScore: number;
  timestamp: Date;
  source: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Anomaly {
  id: string;
  type: 'statistical' | 'pattern' | 'threshold' | 'trend';
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  affectedMetrics: string[];
  detectionTime: Date;
  confidence: number;
  evidence: Evidence[];
}

export interface VisualizationSpec {
  type: 'trend' | 'correlation' | 'distribution' | 'heatmap' | 'sankey' | 'scatter' | 'bar' | 'timeline';
  data: any[];
  config: ChartConfig;
  sources: Source[];
  title?: string;
  description?: string;
}

export interface ChartConfig {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  colors?: string[];
  axes?: AxisConfig[];
  legend?: LegendConfig;
  interactive?: boolean;
}

export interface AxisConfig {
  name: string;
  label: string;
  type: 'linear' | 'logarithmic' | 'categorical' | 'time';
  domain?: [number, number];
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}
export interface Visualization {
  id: string;
  type: string;
  title: string;
  description: string;
  chartUrl: string;
  data: any[];
  config: ChartConfig;
  sources: Source[];
  createdAt: Date;
  interactive: boolean;
}

export interface CorrelationResult {
  correlations: CorrelationMatrix;
  patterns: CorrelationPattern[];
  insights: CorrelationInsight[];
  confidence: number;
  sources: DataSource[];
  methodology: CorrelationConfig;
  statisticalSignificance: number;
}

export interface CorrelationMatrix {
  variables: string[];
  coefficients: number[][];
  pValues: number[][];
  sampleSize: number;
}

export interface CorrelationPattern {
  variables: [string, string];
  coefficient: number;
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative';
  significance: number;
}

export interface CorrelationInsight {
  description: string;
  businessImplication: string;
  confidence: number;
  actionableRecommendations: string[];
}

export interface CorrelationConfig {
  method: 'pearson' | 'spearman' | 'kendall';
  threshold: number;
  timeWindow: string;
  metrics: string[];
}

export interface DiagnosticResult {
  procedureName: string;
  version: string;
  findings: DiagnosticFinding[];
  recommendations: string[];
  confidence: number;
  executionTime: number;
  evidence: Evidence[];
  success: boolean;
  errorMessage?: string;
}
export interface DiagnosticFinding {
  id: string;
  category: string;
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  evidence: Evidence[];
  recommendations: string[];
  affectedSystems: string[];
}

// Import types from other modules
import { Evidence, Source } from './domain';