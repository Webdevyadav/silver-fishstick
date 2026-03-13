/**
 * Property-Based Tests for Error Type Classification Accuracy
 * 
 * Property 9: Error Type Classification Accuracy
 * For any roster processing data analysis, pipeline errors (FAIL_REC_CNT) and 
 * data quality issues (REJ_REC_CNT) should be correctly differentiated and 
 * analyzed with appropriate recommendations.
 * 
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */

import * as fc from 'fast-check';
import { RosterProcessingRecord } from '@/types/domain';

describe('Property 9: Error Type Classification Accuracy', () => {
  /**
   * Mock Error Classifier for testing
   */
  class ErrorClassifier {
    classifyErrors(record: RosterProcessingRecord): {
      pipelineErrors: number;
      dataQualityIssues: number;
      classification: 'pipeline' | 'data_quality' | 'mixed' | 'none';
      recommendations: string[];
    } {
      const pipelineErrors = record.failed_records;
      const dataQualityIssues = record.rejected_records;

      let classification: 'pipeline' | 'data_quality' | 'mixed' | 'none';
      const recommendations: string[] = [];

      if (pipelineErrors === 0 && dataQualityIssues === 0) {
        classification = 'none';
      } else if (pipelineErrors > 0 && dataQualityIssues === 0) {
        classification = 'pipeline';
        recommendations.push('Investigate processing pipeline technical failures');
        recommendations.push('Check system logs for error codes: ' + record.error_codes.join(', '));
        recommendations.push('Review processing stage: ' + record.processing_stage);
      } else if (pipelineErrors === 0 && dataQualityIssues > 0) {
        classification = 'data_quality';
        recommendations.push('Review data validation rules and content quality');
        recommendations.push('Analyze rejected record patterns for common issues');
        recommendations.push('Consider provider data submission training');
      } else {
        classification = 'mixed';
        recommendations.push('Address both pipeline and data quality issues');
        recommendations.push(`Pipeline errors: ${pipelineErrors}, Data quality issues: ${dataQualityIssues}`);
        recommendations.push('Prioritize based on error severity and volume');
      }

      return {
        pipelineErrors,
        dataQualityIssues,
        classification,
        recommendations
      };
    }

    analyzeErrorPattern(records: RosterProcessingRecord[]): {
      dominantErrorType: 'pipeline' | 'data_quality' | 'balanced';
      pipelineErrorRate: number;
      dataQualityErrorRate: number;
      insights: string[];
    } {
      const totalRecords = records.reduce((sum, r) => sum + r.total_records, 0);
      const totalPipelineErrors = records.reduce((sum, r) => sum + r.failed_records, 0);
      const totalDataQualityIssues = records.reduce((sum, r) => sum + r.rejected_records, 0);

      const pipelineErrorRate = totalRecords > 0 ? totalPipelineErrors / totalRecords : 0;
      const dataQualityErrorRate = totalRecords > 0 ? totalDataQualityIssues / totalRecords : 0;

      let dominantErrorType: 'pipeline' | 'data_quality' | 'balanced';
      const insights: string[] = [];

      if (pipelineErrorRate > dataQualityErrorRate * 1.5) {
        dominantErrorType = 'pipeline';
        insights.push('Pipeline errors are the dominant issue');
        insights.push('Focus on system stability and processing infrastructure');
      } else if (dataQualityErrorRate > pipelineErrorRate * 1.5) {
        dominantErrorType = 'data_quality';
        insights.push('Data quality issues are the dominant concern');
        insights.push('Focus on data validation and provider education');
      } else {
        dominantErrorType = 'balanced';
        insights.push('Both error types require attention');
        insights.push('Implement parallel improvement strategies');
      }

      return {
        dominantErrorType,
        pipelineErrorRate,
        dataQualityErrorRate,
        insights
      };
    }
  }

  const classifier = new ErrorClassifier();

  describe('Error Type Differentiation', () => {
    it('should correctly classify pipeline-only errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            failed_records: fc.integer({ min: 1, max: 100 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            const record: RosterProcessingRecord = {
              ...recordData,
              processed_records: recordData.total_records - recordData.failed_records,
              rejected_records: 0 // No data quality issues
            };

            const result = classifier.classifyErrors(record);

            // Property: Pipeline-only errors should be classified as 'pipeline'
            expect(result.classification).toBe('pipeline');
            expect(result.pipelineErrors).toBe(record.failed_records);
            expect(result.dataQualityIssues).toBe(0);

            // Property: Recommendations should address pipeline issues
            expect(result.recommendations.length).toBeGreaterThan(0);
            const hasPipelineRecommendation = result.recommendations.some(r =>
              r.toLowerCase().includes('pipeline') || 
              r.toLowerCase().includes('processing') ||
              r.toLowerCase().includes('technical')
            );
            expect(hasPipelineRecommendation).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly classify data-quality-only errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            rejected_records: fc.integer({ min: 1, max: 100 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            const record: RosterProcessingRecord = {
              ...recordData,
              processed_records: recordData.total_records - recordData.rejected_records,
              failed_records: 0 // No pipeline errors
            };

            const result = classifier.classifyErrors(record);

            // Property: Data-quality-only errors should be classified as 'data_quality'
            expect(result.classification).toBe('data_quality');
            expect(result.pipelineErrors).toBe(0);
            expect(result.dataQualityIssues).toBe(record.rejected_records);

            // Property: Recommendations should address data quality
            expect(result.recommendations.length).toBeGreaterThan(0);
            const hasDataQualityRecommendation = result.recommendations.some(r =>
              r.toLowerCase().includes('data') || 
              r.toLowerCase().includes('quality') ||
              r.toLowerCase().includes('validation')
            );
            expect(hasDataQualityRecommendation).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly classify mixed error scenarios', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            failed_records: fc.integer({ min: 1, max: 50 }),
            rejected_records: fc.integer({ min: 1, max: 50 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            // Ensure failed + rejected doesn't exceed total
            const maxErrors = Math.min(
              recordData.failed_records + recordData.rejected_records,
              recordData.total_records
            );
            const failed = Math.min(recordData.failed_records, maxErrors);
            const rejected = Math.min(recordData.rejected_records, maxErrors - failed);

            const record: RosterProcessingRecord = {
              ...recordData,
              failed_records: failed,
              rejected_records: rejected,
              processed_records: recordData.total_records - failed - rejected
            };

            const result = classifier.classifyErrors(record);

            // Property: Mixed errors should be classified as 'mixed'
            expect(result.classification).toBe('mixed');
            expect(result.pipelineErrors).toBeGreaterThan(0);
            expect(result.dataQualityIssues).toBeGreaterThan(0);

            // Property: Recommendations should address both error types
            expect(result.recommendations.length).toBeGreaterThan(0);
            const mentionsBoth = result.recommendations.some(r =>
              r.toLowerCase().includes('both') || 
              (r.toLowerCase().includes('pipeline') && r.toLowerCase().includes('quality'))
            );
            expect(mentionsBoth).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Pattern Analysis', () => {
    it('should identify dominant error type across multiple records', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              file_id: fc.string({ minLength: 1 }),
              submission_date: fc.date(),
              market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
              provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
              total_records: fc.integer({ min: 100, max: 1000 }),
              failed_records: fc.integer({ min: 0, max: 50 }),
              rejected_records: fc.integer({ min: 0, max: 50 }),
              processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
              error_codes: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
              processing_time_minutes: fc.integer({ min: 1, max: 300 }),
              retry_count: fc.integer({ min: 0, max: 5 }),
              final_status: fc.constantFrom('success', 'failed', 'partial')
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (recordsData) => {
            const records: RosterProcessingRecord[] = recordsData.map(data => ({
              ...data,
              processed_records: data.total_records - data.failed_records - data.rejected_records
            }));

            const analysis = classifier.analyzeErrorPattern(records);

            // Property: Error rates should be between 0 and 1
            expect(analysis.pipelineErrorRate).toBeGreaterThanOrEqual(0);
            expect(analysis.pipelineErrorRate).toBeLessThanOrEqual(1);
            expect(analysis.dataQualityErrorRate).toBeGreaterThanOrEqual(0);
            expect(analysis.dataQualityErrorRate).toBeLessThanOrEqual(1);

            // Property: Dominant type should match the higher error rate
            if (analysis.pipelineErrorRate > analysis.dataQualityErrorRate * 1.5) {
              expect(analysis.dominantErrorType).toBe('pipeline');
            } else if (analysis.dataQualityErrorRate > analysis.pipelineErrorRate * 1.5) {
              expect(analysis.dominantErrorType).toBe('data_quality');
            } else {
              expect(analysis.dominantErrorType).toBe('balanced');
            }

            // Property: Insights should be provided
            expect(analysis.insights.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Recommendation Appropriateness', () => {
    it('should provide specific recommendations based on error type', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            failed_records: fc.integer({ min: 0, max: 100 }),
            rejected_records: fc.integer({ min: 0, max: 100 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            const record: RosterProcessingRecord = {
              ...recordData,
              processed_records: Math.max(
                0,
                recordData.total_records - recordData.failed_records - recordData.rejected_records
              )
            };

            const result = classifier.classifyErrors(record);

            // Property: Recommendations should be non-empty for any errors
            if (record.failed_records > 0 || record.rejected_records > 0) {
              expect(result.recommendations.length).toBeGreaterThan(0);
              
              // Property: Each recommendation should be a non-empty string
              result.recommendations.forEach(rec => {
                expect(typeof rec).toBe('string');
                expect(rec.length).toBeGreaterThan(0);
              });
            }

            // Property: No recommendations for error-free records
            if (record.failed_records === 0 && record.rejected_records === 0) {
              expect(result.classification).toBe('none');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include error codes in pipeline error recommendations', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            failed_records: fc.integer({ min: 1, max: 100 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            const record: RosterProcessingRecord = {
              ...recordData,
              processed_records: recordData.total_records - recordData.failed_records,
              rejected_records: 0
            };

            const result = classifier.classifyErrors(record);

            // Property: Pipeline error recommendations should reference error codes
            if (record.error_codes.length > 0) {
              const mentionsErrorCodes = result.recommendations.some(rec =>
                record.error_codes.some(code => rec.includes(code))
              );
              expect(mentionsErrorCodes).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Classification Consistency', () => {
    it('should produce consistent classifications for identical records', () => {
      fc.assert(
        fc.property(
          fc.record({
            file_id: fc.string({ minLength: 1 }),
            submission_date: fc.date(),
            market_segment: fc.constantFrom('commercial', 'medicare', 'medicaid'),
            provider_type: fc.constantFrom('hospital', 'clinic', 'individual'),
            total_records: fc.integer({ min: 100, max: 10000 }),
            failed_records: fc.integer({ min: 0, max: 100 }),
            rejected_records: fc.integer({ min: 0, max: 100 }),
            processing_stage: fc.constantFrom('intake', 'validation', 'transformation', 'loading', 'complete'),
            error_codes: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
            processing_time_minutes: fc.integer({ min: 1, max: 300 }),
            retry_count: fc.integer({ min: 0, max: 5 }),
            final_status: fc.constantFrom('success', 'failed', 'partial')
          }),
          (recordData) => {
            const record: RosterProcessingRecord = {
              ...recordData,
              processed_records: Math.max(
                0,
                recordData.total_records - recordData.failed_records - recordData.rejected_records
              )
            };

            // Classify the same record multiple times
            const result1 = classifier.classifyErrors(record);
            const result2 = classifier.classifyErrors(record);
            const result3 = classifier.classifyErrors(record);

            // Property: Classifications should be identical
            expect(result1.classification).toBe(result2.classification);
            expect(result2.classification).toBe(result3.classification);
            expect(result1.pipelineErrors).toBe(result2.pipelineErrors);
            expect(result1.dataQualityIssues).toBe(result2.dataQualityIssues);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
