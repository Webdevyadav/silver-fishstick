/**
 * Test Data Fixtures and Generators
 * Provides realistic test data for unit and integration tests
 */

import { RosterProcessingRecord, OperationalMetrics, Flag, SessionState } from '@/types/domain';
import { EpisodicEntry } from '@/types/memory';

/**
 * Generate a sample roster processing record
 */
export function generateRosterProcessingRecord(overrides?: Partial<RosterProcessingRecord>): RosterProcessingRecord {
  const defaults: RosterProcessingRecord = {
    file_id: `FILE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    submission_date: new Date(),
    market_segment: 'commercial',
    provider_type: 'hospital',
    total_records: 1000,
    processed_records: 950,
    failed_records: 30,
    rejected_records: 20,
    processing_stage: 'complete',
    error_codes: ['ERR_001', 'ERR_002'],
    processing_time_minutes: 45,
    retry_count: 2,
    final_status: 'success'
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate multiple roster processing records
 */
export function generateRosterProcessingRecords(count: number): RosterProcessingRecord[] {
  return Array.from({ length: count }, (_, i) => 
    generateRosterProcessingRecord({
      file_id: `FILE-2024-${String(i + 1).padStart(4, '0')}`,
      submission_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Each day earlier
    })
  );
}

/**
 * Generate sample operational metrics
 */
export function generateOperationalMetrics(overrides?: Partial<OperationalMetrics>): OperationalMetrics {
  const defaults: OperationalMetrics = {
    market_id: `MKT-${Math.floor(Math.random() * 100)}`,
    month: '2024-01',
    total_files_received: 500,
    files_processed_successfully: 475,
    average_processing_time: 42.5,
    error_rate_percentage: 5.0,
    top_error_categories: ['validation', 'timeout', 'format'],
    provider_onboarding_rate: 95.0,
    data_quality_score: 92.5,
    sla_compliance_percentage: 98.0
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate multiple operational metrics
 */
export function generateOperationalMetricsRecords(count: number): OperationalMetrics[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    return generateOperationalMetrics({
      market_id: `MKT-${String(i + 1).padStart(3, '0')}`,
      month
    });
  });
}

/**
 * Generate a sample flag
 */
export function generateFlag(overrides?: Partial<Flag>): Flag {
  const defaults: Flag = {
    id: `flag-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'warning',
    category: 'data_quality',
    message: 'Data quality issue detected',
    severity: 3,
    timestamp: new Date(),
    resolved: false,
    source: 'automated_monitoring'
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate sample session state
 */
export function generateSessionState(overrides?: Partial<SessionState>): SessionState {
  const defaults: SessionState = {
    sessionId: `session-${Date.now()}`,
    userId: `user-${Math.floor(Math.random() * 1000)}`,
    startTime: new Date(),
    lastActivity: new Date(),
    queryCount: 0,
    flags: [],
    dataStateSnapshot: {
      timestamp: new Date(),
      rosterProcessingChecksum: 'checksum-roster',
      operationalMetricsChecksum: 'checksum-metrics',
      totalRecords: 10000,
      lastModified: new Date(),
      keyMetrics: {
        error_rate: 5.0,
        processing_time: 42.5
      }
    },
    activeContext: []
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate sample episodic entry
 */
export function generateEpisodicEntry(overrides?: Partial<EpisodicEntry>): EpisodicEntry {
  const defaults: EpisodicEntry = {
    sessionId: `session-${Date.now()}`,
    timestamp: new Date(),
    query: 'What are the main roster processing issues?',
    response: 'Based on the analysis, the main issues are...',
    flags: [],
    dataState: {
      timestamp: new Date(),
      rosterProcessingChecksum: 'checksum-roster',
      operationalMetricsChecksum: 'checksum-metrics',
      totalRecords: 10000,
      lastModified: new Date(),
      keyMetrics: {}
    },
    toolsUsed: ['data_query', 'correlation_analysis'],
    confidence: 0.85,
    reasoning: []
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate realistic error scenarios
 */
export const errorScenarios = {
  pipelineOnly: (): RosterProcessingRecord => generateRosterProcessingRecord({
    failed_records: 50,
    rejected_records: 0,
    error_codes: ['ERR_TIMEOUT', 'ERR_CONNECTION'],
    processing_stage: 'loading',
    final_status: 'failed'
  }),

  dataQualityOnly: (): RosterProcessingRecord => generateRosterProcessingRecord({
    failed_records: 0,
    rejected_records: 75,
    error_codes: [],
    processing_stage: 'validation',
    final_status: 'partial'
  }),

  mixed: (): RosterProcessingRecord => generateRosterProcessingRecord({
    failed_records: 30,
    rejected_records: 45,
    error_codes: ['ERR_VALIDATION', 'ERR_FORMAT'],
    processing_stage: 'transformation',
    final_status: 'partial'
  }),

  highVolume: (): RosterProcessingRecord => generateRosterProcessingRecord({
    total_records: 50000,
    processed_records: 48500,
    failed_records: 1000,
    rejected_records: 500,
    processing_time_minutes: 240,
    retry_count: 5
  }),

  stuckInProcessing: (): RosterProcessingRecord => generateRosterProcessingRecord({
    processing_stage: 'transformation',
    processing_time_minutes: 480, // 8 hours
    retry_count: 10,
    final_status: 'failed'
  })
};

/**
 * Generate market health scenarios
 */
export const marketScenarios = {
  healthy: (): OperationalMetrics => generateOperationalMetrics({
    error_rate_percentage: 2.0,
    data_quality_score: 98.0,
    sla_compliance_percentage: 99.5,
    provider_onboarding_rate: 97.0
  }),

  degraded: (): OperationalMetrics => generateOperationalMetrics({
    error_rate_percentage: 8.5,
    data_quality_score: 85.0,
    sla_compliance_percentage: 92.0,
    provider_onboarding_rate: 88.0
  }),

  critical: (): OperationalMetrics => generateOperationalMetrics({
    error_rate_percentage: 15.0,
    data_quality_score: 70.0,
    sla_compliance_percentage: 80.0,
    provider_onboarding_rate: 75.0,
    top_error_categories: ['validation', 'timeout', 'format', 'missing_data', 'duplicate']
  })
};

/**
 * Generate time series data for trend analysis
 */
export function generateTimeSeriesData(
  months: number,
  baseValue: number,
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
): OperationalMetrics[] {
  return Array.from({ length: months }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - i - 1));
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let errorRate = baseValue;
    switch (trend) {
      case 'increasing':
        errorRate = baseValue + (i * 0.5);
        break;
      case 'decreasing':
        errorRate = baseValue - (i * 0.3);
        break;
      case 'volatile':
        errorRate = baseValue + (Math.random() - 0.5) * 5;
        break;
      case 'stable':
      default:
        errorRate = baseValue + (Math.random() - 0.5) * 0.5;
    }

    return generateOperationalMetrics({
      month,
      error_rate_percentage: Math.max(0, Math.min(100, errorRate))
    });
  });
}

/**
 * Generate correlation test data
 */
export function generateCorrelationData(correlation: 'positive' | 'negative' | 'none'): {
  rosterRecords: RosterProcessingRecord[];
  operationalMetrics: OperationalMetrics[];
} {
  const count = 12; // 12 months of data
  const rosterRecords: RosterProcessingRecord[] = [];
  const operationalMetrics: OperationalMetrics[] = [];

  for (let i = 0; i < count; i++) {
    const baseErrorRate = 5.0;
    const baseProcessingTime = 45;

    let errorRate: number;
    let processingTime: number;

    switch (correlation) {
      case 'positive':
        // Higher processing time = higher error rate
        processingTime = baseProcessingTime + i * 5;
        errorRate = baseErrorRate + i * 0.5;
        break;
      case 'negative':
        // Higher processing time = lower error rate
        processingTime = baseProcessingTime + i * 5;
        errorRate = baseErrorRate - i * 0.3;
        break;
      case 'none':
      default:
        // No correlation
        processingTime = baseProcessingTime + (Math.random() - 0.5) * 20;
        errorRate = baseErrorRate + (Math.random() - 0.5) * 3;
    }

    const date = new Date();
    date.setMonth(date.getMonth() - (count - i - 1));
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    rosterRecords.push(generateRosterProcessingRecord({
      processing_time_minutes: Math.max(1, processingTime),
      failed_records: Math.floor((errorRate / 100) * 1000),
      submission_date: date
    }));

    operationalMetrics.push(generateOperationalMetrics({
      month,
      error_rate_percentage: Math.max(0, Math.min(100, errorRate)),
      average_processing_time: Math.max(1, processingTime)
    }));
  }

  return { rosterRecords, operationalMetrics };
}
