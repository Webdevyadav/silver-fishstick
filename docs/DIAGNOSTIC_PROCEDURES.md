# RosterIQ AI Agent - Diagnostic Procedures Guide

## Table of Contents

1. [Overview](#overview)
2. [Triage Stuck ROS](#triage-stuck-ros)
3. [Record Quality Audit](#record-quality-audit)
4. [Market Health Report](#market-health-report)
5. [Retry Effectiveness Analysis](#retry-effectiveness-analysis)
6. [Best Practices](#best-practices)
7. [Interpreting Results](#interpreting-results)

## Overview

RosterIQ provides four standardized diagnostic procedures for common operational investigations. These procedures follow proven analytical workflows and provide consistent, reproducible results.

### When to Use Diagnostic Procedures

**Use diagnostic procedures when**:
- You need standardized analysis for reporting
- You want consistent methodology across team members
- You're investigating recurring operational issues
- You need comprehensive analysis with minimal setup

**Use natural language queries when**:
- You have specific, one-off questions
- You need exploratory analysis
- You want to investigate unique situations
- You're following up on diagnostic findings

### Common Parameters

All diagnostic procedures accept these common parameters:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| timeWindow | string | Analysis period (1d, 7d, 30d, 90d) | 30d |
| marketSegment | string | Specific market segment to analyze | all |
| providerType | string | Provider type filter | all |
| confidenceThreshold | number | Minimum confidence for findings (0-1) | 0.7 |

## Triage Stuck ROS

### Purpose

Analyzes roster files stuck in processing stages and identifies bottlenecks causing delays.

### When to Use

- Files are not progressing through pipeline stages
- Processing times are increasing
- Backlog is growing
- SLA compliance is at risk

### Parameters

```json
{
  "timeWindow": "7d",
  "marketSegment": "commercial",
  "stuckThresholdHours": 24,
  "includeRetryAnalysis": true
}
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| stuckThresholdHours | number | Hours before file considered stuck | 24 |
| includeRetryAnalysis | boolean | Analyze retry patterns | true |
| processingStages | array | Stages to analyze | all |

### Example Usage

**Via API**:
```typescript
const result = await client.runDiagnostic('triage_stuck_ros', {
  timeWindow: '7d',
  marketSegment: 'commercial',
  stuckThresholdHours: 24
}, sessionId, userId);
```

**Via Natural Language**:
```
"Run triage stuck ROS for commercial market in the past 7 days"
```

### Expected Output

```json
{
  "procedureName": "triage_stuck_ros",
  "version": "1.0.0",
  "findings": [
    {
      "category": "bottleneck",
      "severity": 4,
      "description": "Validation stage showing 40% increase in processing time",
      "affectedFiles": 125,
      "averageDelayHours": 36,
      "confidence": 0.85
    },
    {
      "category": "stuck_files",
      "severity": 5,
      "description": "15 files stuck in transformation stage for >48 hours",
      "fileIds": ["file-123", "file-456"],
      "commonPatterns": ["Large file size", "Complex provider hierarchies"],
      "confidence": 0.92
    }
  ],
  "recommendations": [
    "Increase validation stage resources during peak hours",
    "Implement file size limits or chunking for large submissions",
    "Review transformation logic for provider hierarchy handling"
  ],
  "confidence": 0.88,
  "executionTime": 3500
}
```

### Interpreting Results

**Severity Levels**:
- **5 (Critical)**: Immediate action required, SLA breach imminent
- **4 (High)**: Significant impact, address within 24 hours
- **3 (Medium)**: Moderate impact, address within week
- **2 (Low)**: Minor issue, monitor and plan fix
- **1 (Info)**: Informational, no action needed

**Confidence Scores**:
- **0.9-1.0**: Very high confidence, act on findings
- **0.7-0.89**: High confidence, verify and act
- **0.5-0.69**: Moderate confidence, investigate further
- **<0.5**: Low confidence, gather more data


## Record Quality Audit

### Purpose

Examines data quality patterns and validation failures across roster submissions to identify systematic quality issues.

### When to Use

- Rejection rates are increasing
- Data quality scores are declining
- Validation failures are frequent
- Need to identify quality improvement opportunities

### Parameters

```json
{
  "timeWindow": "30d",
  "marketSegment": "all",
  "providerType": "all",
  "minRejectionRate": 0.05,
  "includeValidationRules": true
}
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| minRejectionRate | number | Minimum rejection rate to flag (0-1) | 0.05 |
| includeValidationRules | boolean | Include validation rule analysis | true |
| groupBy | string | Group results by (market, provider, rule) | market |

### Example Usage

**Via API**:
```typescript
const result = await client.runDiagnostic('record_quality_audit', {
  timeWindow: '30d',
  marketSegment: 'all',
  minRejectionRate: 0.05
}, sessionId, userId);
```

**Via Natural Language**:
```
"Run record quality audit for all markets in the past 30 days"
"Audit data quality for commercial market"
```

### Expected Output

```json
{
  "procedureName": "record_quality_audit",
  "version": "1.0.0",
  "findings": [
    {
      "category": "validation_failure",
      "severity": 4,
      "description": "Provider NPI validation failing at 15% rate",
      "affectedRecords": 450,
      "validationRule": "NPI_FORMAT_CHECK",
      "commonPatterns": ["Missing check digit", "Invalid format"],
      "confidence": 0.90
    },
    {
      "category": "data_completeness",
      "severity": 3,
      "description": "30% of records missing required address fields",
      "affectedRecords": 900,
      "missingFields": ["address_line2", "zip_extension"],
      "confidence": 0.85
    }
  ],
  "recommendations": [
    "Implement NPI validation at submission source",
    "Add address completeness checks before submission",
    "Provide data quality feedback to submitters"
  ],
  "qualityMetrics": {
    "overallQualityScore": 0.72,
    "rejectionRate": 0.12,
    "topFailureReasons": ["NPI_FORMAT", "MISSING_ADDRESS", "INVALID_DATE"]
  },
  "confidence": 0.87,
  "executionTime": 4000
}
```

### Interpreting Results

**Quality Score Ranges**:
- **0.9-1.0**: Excellent quality, minimal issues
- **0.7-0.89**: Good quality, some improvement needed
- **0.5-0.69**: Fair quality, significant issues present
- **<0.5**: Poor quality, immediate action required

**Common Findings**:
- **Validation Failures**: Specific rules failing frequently
- **Data Completeness**: Missing required or optional fields
- **Format Issues**: Incorrect data formats or patterns
- **Consistency Problems**: Data inconsistencies across fields

## Market Health Report

### Purpose

Generates comprehensive market-level operational health assessments with comparative analysis across markets.

### When to Use

- Need executive-level overview
- Comparing market performance
- Identifying underperforming markets
- Strategic planning and resource allocation

### Parameters

```json
{
  "timeWindow": "30d",
  "markets": ["commercial", "medicare", "medicaid"],
  "metrics": ["error_rate", "processing_time", "quality_score", "sla_compliance"],
  "includeComparison": true,
  "includeTrends": true
}
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| markets | array | Specific markets to analyze | all |
| metrics | array | Metrics to include in report | all |
| includeComparison | boolean | Compare markets against each other | true |
| includeTrends | boolean | Include trend analysis | true |
| benchmarkPeriod | string | Period for comparison (30d, 90d, 1y) | 90d |

### Example Usage

**Via API**:
```typescript
const result = await client.runDiagnostic('market_health_report', {
  timeWindow: '30d',
  markets: ['commercial', 'medicare'],
  includeComparison: true
}, sessionId, userId);
```

**Via Natural Language**:
```
"Generate market health report for all markets"
"Compare commercial and medicare market performance"
```

### Expected Output

```json
{
  "procedureName": "market_health_report",
  "version": "1.0.0",
  "findings": [
    {
      "market": "commercial",
      "healthScore": 0.82,
      "status": "healthy",
      "metrics": {
        "errorRate": 0.06,
        "avgProcessingTime": 42,
        "qualityScore": 0.85,
        "slaCompliance": 0.94
      },
      "trends": {
        "errorRate": "increasing",
        "processingTime": "stable",
        "qualityScore": "improving"
      },
      "alerts": ["Error rate trending up 15% vs last period"]
    },
    {
      "market": "medicare",
      "healthScore": 0.91,
      "status": "excellent",
      "metrics": {
        "errorRate": 0.03,
        "avgProcessingTime": 38,
        "qualityScore": 0.92,
        "slaCompliance": 0.98
      },
      "trends": {
        "errorRate": "stable",
        "processingTime": "improving",
        "qualityScore": "stable"
      },
      "alerts": []
    }
  ],
  "comparison": {
    "bestPerforming": "medicare",
    "needsAttention": ["commercial"],
    "keyDifferences": [
      "Medicare has 50% lower error rate",
      "Commercial processing time 10% higher"
    ]
  },
  "recommendations": [
    "Investigate commercial market error rate increase",
    "Apply medicare best practices to commercial market",
    "Allocate additional resources to commercial validation"
  ],
  "confidence": 0.89,
  "executionTime": 5500
}
```

### Interpreting Results

**Health Score Ranges**:
- **0.9-1.0**: Excellent - market performing optimally
- **0.7-0.89**: Good - minor issues, generally healthy
- **0.5-0.69**: Fair - significant issues requiring attention
- **<0.5**: Poor - critical issues, immediate action needed

**Status Indicators**:
- **Excellent**: All metrics within target ranges
- **Healthy**: Most metrics good, minor concerns
- **Needs Attention**: Multiple metrics below targets
- **Critical**: Severe issues affecting operations

## Retry Effectiveness Analysis

### Purpose

Evaluates the success rates and patterns of retry operations to optimize retry strategies.

### When to Use

- High retry counts observed
- Evaluating retry strategy effectiveness
- Optimizing retry policies
- Cost-benefit analysis of retries vs manual intervention

### Parameters

```json
{
  "timeWindow": "30d",
  "marketSegment": "all",
  "minRetryCount": 1,
  "includeSuccessPatterns": true,
  "includeCostAnalysis": true
}
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| minRetryCount | integer | Minimum retries to analyze | 1 |
| includeSuccessPatterns | boolean | Analyze successful retry patterns | true |
| includeCostAnalysis | boolean | Include cost-benefit analysis | true |
| maxRetryCount | integer | Maximum retries to consider | 10 |

### Example Usage

**Via API**:
```typescript
const result = await client.runDiagnostic('retry_effectiveness_analysis', {
  timeWindow: '30d',
  includeSuccessPatterns: true,
  includeCostAnalysis: true
}, sessionId, userId);
```

**Via Natural Language**:
```
"Analyze retry effectiveness for the past 30 days"
"How effective are our retry operations?"
```

### Expected Output

```json
{
  "procedureName": "retry_effectiveness_analysis",
  "version": "1.0.0",
  "findings": [
    {
      "category": "retry_success",
      "description": "65% of retries succeed on first attempt",
      "successRate": 0.65,
      "avgRetriesUntilSuccess": 1.8,
      "confidence": 0.88
    },
    {
      "category": "retry_patterns",
      "description": "Validation errors have 85% retry success rate",
      "errorType": "validation",
      "successRate": 0.85,
      "optimalRetryDelay": 300,
      "confidence": 0.82
    },
    {
      "category": "diminishing_returns",
      "description": "Success rate drops below 10% after 3 retries",
      "retryThreshold": 3,
      "successRateAfterThreshold": 0.08,
      "confidence": 0.90
    }
  ],
  "recommendations": [
    "Limit automatic retries to 3 attempts",
    "Implement 5-minute delay for validation errors",
    "Route files to manual review after 3 failed retries",
    "Estimated cost savings: $15,000/month"
  ],
  "costAnalysis": {
    "currentRetryCost": 45000,
    "manualInterventionCost": 60000,
    "optimizedRetryCost": 30000,
    "potentialSavings": 15000,
    "currency": "USD",
    "period": "monthly"
  },
  "confidence": 0.86,
  "executionTime": 4200
}
```

### Interpreting Results

**Success Rate Benchmarks**:
- **>80%**: Excellent retry effectiveness
- **60-80%**: Good effectiveness, some optimization possible
- **40-60%**: Fair effectiveness, review strategy
- **<40%**: Poor effectiveness, major strategy revision needed

**Key Metrics**:
- **Success Rate**: Percentage of retries that eventually succeed
- **Avg Retries Until Success**: How many attempts typically needed
- **Optimal Retry Delay**: Best wait time between retries
- **Cost Analysis**: Financial impact of retry strategy

## Best Practices

### Choosing the Right Procedure

| Situation | Recommended Procedure |
|-----------|----------------------|
| Files not moving through pipeline | Triage Stuck ROS |
| High rejection rates | Record Quality Audit |
| Need executive overview | Market Health Report |
| Evaluating retry strategy | Retry Effectiveness Analysis |
| Multiple issues | Run multiple procedures |

### Scheduling Regular Diagnostics

**Recommended Frequency**:
- **Triage Stuck ROS**: Daily during high-volume periods
- **Record Quality Audit**: Weekly
- **Market Health Report**: Monthly for executives
- **Retry Effectiveness**: Quarterly for strategy review

### Interpreting Confidence Scores

All diagnostic procedures include confidence scores:
- **High confidence (>0.8)**: Act on recommendations
- **Moderate confidence (0.6-0.8)**: Verify findings
- **Low confidence (<0.6)**: Gather more data

### Acting on Recommendations

1. **Prioritize by severity**: Address critical (5) and high (4) findings first
2. **Verify findings**: Check source data and evidence
3. **Implement changes**: Follow recommendations systematically
4. **Monitor impact**: Re-run procedure to measure improvement
5. **Document results**: Track what worked and what didn't

### Combining Procedures

For comprehensive analysis:
1. Start with **Market Health Report** for overview
2. Use **Triage Stuck ROS** for processing issues
3. Run **Record Quality Audit** for data quality
4. Finish with **Retry Effectiveness** for optimization

## Troubleshooting Diagnostic Procedures

### Procedure Takes Too Long

**Causes**:
- Large time window
- Complex parameters
- High system load

**Solutions**:
- Reduce time window
- Narrow market segment
- Run during off-peak hours

### Low Confidence Results

**Causes**:
- Insufficient data
- Conflicting patterns
- Ambiguous parameters

**Solutions**:
- Increase time window
- Simplify parameters
- Check data availability

### Unexpected Findings

**Causes**:
- Data quality issues
- Recent system changes
- Incorrect parameters

**Solutions**:
- Verify source data
- Check for recent changes
- Review parameter settings
- Contact support if persistent

---

**Last Updated**: January 2024
