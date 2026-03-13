/**
 * Unit Tests for CSV Schema Validation
 * Tests validation logic for roster processing and operational metrics CSV data
 */

import { validateRosterProcessingRecord, validateOperationalMetrics } from '@/validation/csvSchemas';
import { RosterProcessingRecord, OperationalMetrics } from '@/types/domain';

describe('CSV Schema Validation', () => {
  describe('validateRosterProcessingRecord', () => {
    const validRecord: RosterProcessingRecord = {
      file_id: 'FILE-2024-001',
      submission_date: new Date('2024-01-15'),
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

    it('should validate a correct roster processing record', () => {
      const result = validateRosterProcessingRecord(validRecord);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject record with failed + rejected > total', () => {
      const invalidRecord = {
        ...validRecord,
        failed_records: 600,
        rejected_records: 500
      };
      const result = validateRosterProcessingRecord(invalidRecord);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('failed_records + rejected_records cannot exceed total_records');
    });

    it('should reject record with negative processing time', () => {
      const invalidRecord = {
        ...validRecord,
        processing_time_minutes: -10
      };
      const result = validateRosterProcessingRecord(invalidRecord);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('processing_time_minutes must be positive');
    });

    it('should reject record with invalid processing stage', () => {
      const invalidRecord = {
        ...validRecord,
        processing_stage: 'invalid_stage' as any
      };
      const result = validateRosterProcessingRecord(invalidRecord);
      expect(result.isValid).toBe(false);
    });

    it('should reject record with missing required fields', () => {
      const invalidRecord = {
        ...validRecord,
        file_id: ''
      };
      const result = validateRosterProcessingRecord(invalidRecord);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('file_id is required');
    });
  });

  describe('validateOperationalMetrics', () => {
    const validMetrics: OperationalMetrics = {
      market_id: 'MKT-001',
      month: '2024-01',
      total_files_received: 500,
      files_processed_successfully: 475,
      average_processing_time: 42.5,
      error_rate_percentage: 5.0,
      top_error_categories: ['validation', 'timeout'],
      provider_onboarding_rate: 95.0,
      data_quality_score: 92.5,
      sla_compliance_percentage: 98.0
    };

    it('should validate correct operational metrics', () => {
      const result = validateOperationalMetrics(validMetrics);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject metrics with error rate > 100', () => {
      const invalidMetrics = {
        ...validMetrics,
        error_rate_percentage: 150
      };
      const result = validateOperationalMetrics(invalidMetrics);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('error_rate_percentage must be between 0 and 100');
    });

    it('should reject metrics with negative values', () => {
      const invalidMetrics = {
        ...validMetrics,
        total_files_received: -10
      };
      const result = validateOperationalMetrics(invalidMetrics);
      expect(result.isValid).toBe(false);
    });

    it('should reject metrics with invalid month format', () => {
      const invalidMetrics = {
        ...validMetrics,
        month: '2024-13' // Invalid month
      };
      const result = validateOperationalMetrics(invalidMetrics);
      expect(result.isValid).toBe(false);
    });
  });
});
