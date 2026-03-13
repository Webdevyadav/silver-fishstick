# Diagnostic Procedures

This directory contains YAML definitions for the four named diagnostic procedures in the RosterIQ AI Agent system. These procedures are stored in procedural memory with Git versioning support for continuous improvement.

## Overview

Diagnostic procedures follow a standardized analytical workflow with defined steps, preconditions, postconditions, and expected outputs. Each procedure is designed to address specific operational investigations in healthcare roster processing.

## Procedures

### 1. Triage Stuck ROs (`triage_stuck_ros.yaml`)

**Purpose**: Analyzes roster files stuck in processing stages

**Key Features**:
- Identifies files with extended processing times
- Analyzes bottlenecks by processing stage
- Examines retry patterns and success rates
- Generates actionable recommendations for resolution

**Requirements**: 13.1, 4.2, 4.4

**Parameters**:
- `time_threshold_minutes` (optional): Minimum processing time to consider stuck (default: 60)
- `market_segment` (optional): Filter to specific market
- `processing_stage` (optional): Filter to specific stage

**Expected Outputs**:
- Stuck files count
- Bottleneck stages
- Retry effectiveness analysis
- Actionable recommendations

---

### 2. Record Quality Audit (`record_quality_audit.yaml`)

**Purpose**: Examines data quality patterns and validation failures

**Key Features**:
- Distinguishes REJ_REC_CNT (data quality) from FAIL_REC_CNT (pipeline errors)
- Identifies common validation rule failures
- Analyzes data quality trends over time
- Generates targeted improvement recommendations

**Requirements**: 13.2, 12.3, 12.4

**Parameters**:
- `market_segment` (optional): Filter to specific market
- `provider_type` (optional): Filter to specific provider type
- `rejection_threshold` (optional): Minimum rejection rate to flag (default: 5.0%)

**Expected Outputs**:
- Quality issues by market and provider
- Validation failure patterns
- Trend analysis
- Quality improvement recommendations

---

### 3. Market Health Report (`market_health_report.yaml`)

**Purpose**: Comprehensive market-level operational health assessment

**Key Features**:
- Cross-dataset correlation analysis
- Market performance ranking
- Identifies top and bottom performers
- Generates executive-level summaries

**Requirements**: 13.3, 3.2, 3.5

**Parameters**:
- `markets` (optional): Specific markets to analyze
- `time_period` (optional): Analysis time window (default: 90days)
- `health_threshold` (optional): Minimum health score threshold (default: 60)

**Expected Outputs**:
- Market rankings by health score
- Top performer best practices
- Underperformer improvement areas
- Executive summary
- Strategic recommendations

---

### 4. Retry Effectiveness Analysis (`retry_effectiveness_analysis.yaml`)

**Purpose**: Analyzes retry operation success rates and patterns

**Key Features**:
- Calculates success rates by retry count
- Analyzes retry effectiveness by error type
- Performs cost-benefit analysis
- Identifies diminishing returns thresholds

**Requirements**: 13.4, 4.4

**Parameters**:
- `max_retry_count` (optional): Maximum retry count to analyze (default: 5)
- `success_threshold` (optional): Minimum success rate for effectiveness (default: 50%)
- `time_period` (optional): Analysis time window (default: 30days)

**Expected Outputs**:
- Retry effectiveness metrics
- Error-specific patterns
- Cost-benefit analysis
- Optimization recommendations
- Manual intervention threshold

---

## Procedure Structure

Each YAML file follows this structure:

```yaml
name: procedure_name
version: 1.0.0
description: Detailed description of the procedure
author: RosterIQ System
lastModified: 2024-01-20T00:00:00Z

parameters:
  - name: parameter_name
    type: string|number|boolean|array|object
    required: true|false
    description: Parameter description
    defaultValue: default_value

steps:
  - id: step_1
    name: Step Name
    description: Step description
    type: query|analysis|correlation|validation
    preconditions:
      - Precondition 1
      - Precondition 2
    postconditions:
      - Postcondition 1
      - Postcondition 2
    parameters:
      sql: SQL query or other parameters
    expectedDuration: milliseconds

expectedOutputs:
  - name: output_name
    type: data_type
    description: Output description
    format: json|csv|chart|text
```

## Usage

Procedures are executed through the `DiagnosticProcedures` service:

```typescript
import { DiagnosticProcedures } from './services/DiagnosticProcedures';

const diagnostics = new DiagnosticProcedures(db, toolOrchestrator);

const result = await diagnostics.executeProcedure('triage_stuck_ros', {
  time_threshold_minutes: 90,
  market_segment: 'commercial'
});

console.log(result.findings);
console.log(result.recommendations);
console.log(result.confidence);
```

## Versioning

Procedures are versioned using Git to track improvements over time. When a procedure is improved based on feedback or execution results:

1. The version number is incremented
2. Changes are documented in the `lastModified` field
3. Git commit captures the improvement history
4. Previous versions remain accessible for rollback

## Continuous Improvement

The system supports live procedure improvement through:

- Execution history tracking
- Performance metrics collection
- Feedback integration
- Automated optimization suggestions

See the `ProcedureImprovement` interface in `src/types/memory.ts` for the improvement tracking structure.
