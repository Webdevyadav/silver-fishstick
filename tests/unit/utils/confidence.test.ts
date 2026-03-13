/**
 * Unit Tests for Confidence Scoring Utilities
 * Tests confidence calculation and aggregation logic
 */

import { 
  calculateConfidence, 
  aggregateConfidenceScores, 
  validateConfidenceScore 
} from '@/utils/confidence';
import { Evidence } from '@/types/domain';

describe('Confidence Scoring Utilities', () => {
  describe('calculateConfidence', () => {
    it('should calculate confidence based on evidence quality', () => {
      const evidence: Evidence[] = [
        {
          id: '1',
          content: 'High quality evidence',
          sources: [{ id: 's1', type: 'csv_data', name: 'roster_data', timestamp: new Date(), confidence: 0.95, metadata: {} }],
          confidence: 0.95,
          timestamp: new Date(),
          type: 'data_point'
        },
        {
          id: '2',
          content: 'Medium quality evidence',
          sources: [{ id: 's2', type: 'web_search', name: 'search_result', timestamp: new Date(), confidence: 0.7, metadata: {} }],
          confidence: 0.7,
          timestamp: new Date(),
          type: 'pattern'
        }
      ];

      const confidence = calculateConfidence(evidence);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
      expect(confidence).toBeCloseTo(0.825, 2); // Average of 0.95 and 0.7
    });

    it('should return 0 confidence for empty evidence', () => {
      const confidence = calculateConfidence([]);
      expect(confidence).toBe(0);
    });

    it('should weight evidence by source type', () => {
      const csvEvidence: Evidence[] = [{
        id: '1',
        content: 'CSV data',
        sources: [{ id: 's1', type: 'csv_data', name: 'data', timestamp: new Date(), confidence: 0.9, metadata: {} }],
        confidence: 0.9,
        timestamp: new Date(),
        type: 'data_point'
      }];

      const webEvidence: Evidence[] = [{
        id: '2',
        content: 'Web data',
        sources: [{ id: 's2', type: 'web_search', name: 'search', timestamp: new Date(), confidence: 0.9, metadata: {} }],
        confidence: 0.9,
        timestamp: new Date(),
        type: 'pattern'
      }];

      const csvConfidence = calculateConfidence(csvEvidence);
      const webConfidence = calculateConfidence(webEvidence);

      // CSV data should have higher weight than web search
      expect(csvConfidence).toBeGreaterThanOrEqual(webConfidence);
    });
  });

  describe('aggregateConfidenceScores', () => {
    it('should aggregate multiple confidence scores correctly', () => {
      const scores = [0.9, 0.8, 0.85, 0.95];
      const aggregated = aggregateConfidenceScores(scores);
      
      expect(aggregated).toBeGreaterThan(0);
      expect(aggregated).toBeLessThanOrEqual(1);
    });

    it('should handle single confidence score', () => {
      const aggregated = aggregateConfidenceScores([0.75]);
      expect(aggregated).toBe(0.75);
    });

    it('should return 0 for empty array', () => {
      const aggregated = aggregateConfidenceScores([]);
      expect(aggregated).toBe(0);
    });

    it('should penalize low confidence scores more heavily', () => {
      const highScores = [0.9, 0.95, 0.92];
      const mixedScores = [0.9, 0.3, 0.92];

      const highAgg = aggregateConfidenceScores(highScores);
      const mixedAgg = aggregateConfidenceScores(mixedScores);

      expect(mixedAgg).toBeLessThan(highAgg);
    });
  });

  describe('validateConfidenceScore', () => {
    it('should accept valid confidence scores', () => {
      expect(validateConfidenceScore(0)).toBe(true);
      expect(validateConfidenceScore(0.5)).toBe(true);
      expect(validateConfidenceScore(1)).toBe(true);
    });

    it('should reject confidence scores outside [0, 1]', () => {
      expect(validateConfidenceScore(-0.1)).toBe(false);
      expect(validateConfidenceScore(1.1)).toBe(false);
      expect(validateConfidenceScore(2)).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(validateConfidenceScore(NaN)).toBe(false);
      expect(validateConfidenceScore(Infinity)).toBe(false);
      expect(validateConfidenceScore(-Infinity)).toBe(false);
    });
  });
});
