/**
 * Confidence Scoring Utilities
 * Provides functions for calculating and validating confidence scores
 */

import { Evidence, Source } from '@/types/domain';

/**
 * Source type weights for confidence calculation
 * Higher weight = more reliable source
 */
const SOURCE_WEIGHTS = {
  csv_data: 1.0,
  diagnostic_procedure: 0.95,
  knowledge_base: 0.85,
  web_search: 0.7
};

/**
 * Calculate overall confidence based on evidence quality
 * @param evidence Array of evidence objects
 * @returns Confidence score between 0 and 1
 */
export function calculateConfidence(evidence: Evidence[]): number {
  if (evidence.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ev of evidence) {
    // Get maximum source weight for this evidence
    const maxSourceWeight = Math.max(
      ...ev.sources.map(s => SOURCE_WEIGHTS[s.type] || 0.5)
    );

    const weight = maxSourceWeight;
    weightedSum += ev.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Aggregate multiple confidence scores using harmonic mean
 * This penalizes low scores more heavily than arithmetic mean
 * @param scores Array of confidence scores
 * @returns Aggregated confidence score
 */
export function aggregateConfidenceScores(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  if (scores.length === 1) {
    return scores[0];
  }

  // Filter out zero scores to avoid division by zero
  const nonZeroScores = scores.filter(s => s > 0);
  
  if (nonZeroScores.length === 0) {
    return 0;
  }

  // Harmonic mean: n / (1/x1 + 1/x2 + ... + 1/xn)
  const sumOfReciprocals = nonZeroScores.reduce((sum, score) => sum + (1 / score), 0);
  return nonZeroScores.length / sumOfReciprocals;
}

/**
 * Validate that a confidence score is within valid range [0, 1]
 * @param score Confidence score to validate
 * @returns True if valid, false otherwise
 */
export function validateConfidenceScore(score: number): boolean {
  return !isNaN(score) && isFinite(score) && score >= 0 && score <= 1;
}

/**
 * Calculate confidence penalty based on evidence age
 * Older evidence gets lower confidence
 * @param timestamp Evidence timestamp
 * @param maxAgeDays Maximum age in days before full penalty
 * @returns Confidence multiplier between 0 and 1
 */
export function calculateAgePenalty(timestamp: Date, maxAgeDays: number = 90): number {
  const ageMs = Date.now() - timestamp.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays <= 0) {
    return 1.0;
  }
  
  if (ageDays >= maxAgeDays) {
    return 0.5; // Minimum 50% confidence for old evidence
  }
  
  // Linear decay from 1.0 to 0.5
  return 1.0 - (0.5 * (ageDays / maxAgeDays));
}
