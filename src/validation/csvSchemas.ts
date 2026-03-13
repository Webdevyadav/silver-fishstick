/**
 * CSV Schema Validation
 * Validates roster processing and operational metrics data
 */

import { RosterProcessingRecord, OperationalMetrics } from '@/types/domain';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a roster processing record
 */
export function validateRosterProcessingRecord(record: RosterProcessingRecord): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!record.file_id || record.file_id.trim() === '') {
    errors.push('file_id is required');
  }

  // Numeric validations
  if (record.total_records < 0) {
    errors.push('total_records must be non-negative');
  }

  if (record.processed_records < 0) {
    errors.push('processed_records must be non-negative');
  }

  if (record.failed_records < 0) {
    errors.push('failed_records must be non-negative');
  }

  if (record.rejected_records < 0) {
    errors.push('rejected_records must be non-negative');
  }

  // Business rule: failed + rejected cannot exceed total
  if (record.failed_records + record.rejected_records > record.total_records) {
    errors.push('failed_records + rejected_records cannot exceed total_records');
  }

  // Processing time must be positive
  if (record.processing_time_minutes < 0) {
    errors.push('processing_time_minutes must be positive');
  }

  // Retry count must be non-negative
  if (record.retry_count < 0) {
    errors.push('retry_count must be non-negative');
  }

  // Valid processing stages
  const validStages = ['intake', 'validation', 'transformation', 'loading', 'complete'];
  if (!validStages.includes(record.processing_stage)) {
    errors.push(`processing_stage must be one of: ${validStages.join(', ')}`);
  }

  // Valid final statuses
  const validStatuses = ['success', 'failed', 'partial'];
  if (!validStatuses.includes(record.final_status)) {
    errors.push(`final_status must be one of: ${validStatuses.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate operational metrics
 */
export function validateOperationalMetrics(metrics: OperationalMetrics): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!metrics.market_id || metrics.market_id.trim() === '') {
    errors.push('market_id is required');
  }

  // Month format validation (YYYY-MM)
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthRegex.test(metrics.month)) {
    errors.push('month must be in YYYY-MM format');
  }

  // Numeric validations
  if (metrics.total_files_received < 0) {
    errors.push('total_files_received must be non-negative');
  }

  if (metrics.files_processed_successfully < 0) {
    errors.push('files_processed_successfully must be non-negative');
  }

  if (metrics.files_processed_successfully > metrics.total_files_received) {
    errors.push('files_processed_successfully cannot exceed total_files_received');
  }

  if (metrics.average_processing_time < 0) {
    errors.push('average_processing_time must be non-negative');
  }

  // Percentage validations (0-100)
  if (metrics.error_rate_percentage < 0 || metrics.error_rate_percentage > 100) {
    errors.push('error_rate_percentage must be between 0 and 100');
  }

  if (metrics.provider_onboarding_rate < 0 || metrics.provider_onboarding_rate > 100) {
    errors.push('provider_onboarding_rate must be between 0 and 100');
  }

  if (metrics.data_quality_score < 0 || metrics.data_quality_score > 100) {
    errors.push('data_quality_score must be between 0 and 100');
  }

  if (metrics.sla_compliance_percentage < 0 || metrics.sla_compliance_percentage > 100) {
    errors.push('sla_compliance_percentage must be between 0 and 100');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
