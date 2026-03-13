// Domain models for RosterIQ system

export interface RosterProcessingRecord {
  file_id: string;
  submission_date: Date;
  market_segment: string;
  provider_type: string;
  total_records: number;
  processed_records: number;
  failed_records: number;  // FAIL_REC_CNT - pipeline errors
  rejected_records: number;  // REJ_REC_CNT - data quality issues
  processing_stage: 'intake' | 'validation' | 'transformation' | 'loading' | 'complete';
  error_codes: string[];
  processing_time_minutes: number;
  retry_count: number;
  final_status: 'success' | 'failed' | 'partial';
}

export interface OperationalMetrics {
  market_id: string;
  month: string;
  total_files_received: number;
  files_processed_successfully: number;
  average_processing_time: number;
  error_rate_percentage: number;
  top_error_categories: string[];
  provider_onboarding_rate: number;
  data_quality_score: number;
  sla_compliance_percentage: number;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  queryCount: number;
  flags: Flag[];
  dataStateSnapshot: DataStateSnapshot;
  activeContext: string[];
}

export interface Flag {
  id: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  category: 'data_quality' | 'performance' | 'anomaly' | 'regulatory';
  message: string;
  severity: 1 | 2 | 3 | 4 | 5;
  timestamp: Date;
  resolved: boolean;
  source: string;
}
export interface DataStateSnapshot {
  timestamp: Date;
  rosterProcessingChecksum: string;
  operationalMetricsChecksum: string;
  totalRecords: number;
  lastModified: Date;
  keyMetrics: Record<string, number>;
}

export interface Source {
  id: string;
  type: 'csv_data' | 'web_search' | 'knowledge_base' | 'diagnostic_procedure';
  name: string;
  url?: string;
  timestamp: Date;
  confidence: number;
  metadata: Record<string, any>;
}

export interface Evidence {
  id: string;
  content: string;
  sources: Source[];
  confidence: number;
  timestamp: Date;
  type: 'data_point' | 'correlation' | 'pattern' | 'anomaly';
}

export interface StateChange {
  id: string;
  type: 'data_update' | 'new_anomaly' | 'metric_change' | 'error_pattern';
  description: string;
  affectedData: string[];
  timestamp: Date;
  severity: 1 | 2 | 3 | 4 | 5;
  previousValue?: any;
  currentValue?: any;
}

export interface Alert {
  id: string;
  type: 'proactive' | 'reactive' | 'scheduled';
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  message: string;
  recommendations: string[];
  affectedSystems: string[];
  timestamp: Date;
  resolved: boolean;
  stateChanges: StateChange[];
}