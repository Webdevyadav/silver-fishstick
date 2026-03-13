import { Database } from 'duckdb';
import { ToolOrchestrator } from './ToolOrchestrator';
import { DiagnosticResult, DiagnosticFinding, DataQuery } from '../types/tools';
import { Evidence, Source } from '../types/domain';
import { logger } from '../utils/logger';

/**
 * DiagnosticProcedures - Implements four named diagnostic procedures
 * 
 * Procedures:
 * 1. triage_stuck_ros - Analyzes roster files stuck in processing stages
 * 2. record_quality_audit - Examines data quality patterns and validation failures
 * 3. market_health_report - Comprehensive market-level operational health assessment
 * 4. retry_effectiveness_analysis - Analyzes retry operation success rates
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 4.2, 4.4
 */
export class DiagnosticProcedures {
  private toolOrchestrator: ToolOrchestrator;
  private db: Database;
  private readonly VERSION = '1.0.0';

  constructor(db: Database, toolOrchestrator: ToolOrchestrator) {
    this.db = db;
    this.toolOrchestrator = toolOrchestrator;
  }

  /**
   * Execute a diagnostic procedure by name
   */
  async executeProcedure(
    procedureName: string,
    parameters: Record<string, any>
  ): Promise<DiagnosticResult> {
    const startTime = Date.now();
    logger.info(`Executing diagnostic procedure: ${procedureName}`, { parameters });

    try {
      let result: DiagnosticResult;

      switch (procedureName) {
        case 'triage_stuck_ros':
          result = await this.triageStuckRos(parameters);
          break;
        case 'record_quality_audit':
          result = await this.recordQualityAudit(parameters);
          break;
        case 'market_health_report':
          result = await this.marketHealthReport(parameters);
          break;
        case 'retry_effectiveness_analysis':
          result = await this.retryEffectivenessAnalysis(parameters);
          break;
        default:
          throw new Error(`Unknown diagnostic procedure: ${procedureName}`);
      }

      result.executionTime = Date.now() - startTime;
      logger.info(`Diagnostic procedure completed: ${procedureName}`, {
        executionTime: result.executionTime,
        success: result.success
      });

      return result;
    } catch (error) {
      logger.error(`Diagnostic procedure failed: ${procedureName}`, { error });
      return {
        procedureName,
        version: this.VERSION,
        findings: [],
        recommendations: [],
        confidence: 0,
        executionTime: Date.now() - startTime,
        evidence: [],
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Procedure 1: Triage Stuck ROs
   * Analyzes roster files stuck in processing stages
   * Requirements: 13.1, 4.2, 4.4
   */
  private async triageStuckRos(parameters: Record<string, any>): Promise<DiagnosticResult> {
    const findings: DiagnosticFinding[] = [];
    const evidence: Evidence[] = [];
    const recommendations: string[] = [];

    // Step 1: Identify stuck files (files in non-complete stages for extended periods)
    const stuckFilesQuery: DataQuery = {
      sql: `
        SELECT 
          file_id,
          processing_stage,
          processing_time_minutes,
          retry_count,
          error_codes,
          final_status,
          submission_date
        FROM roster_processing_details
        WHERE processing_stage != 'complete'
          AND processing_time_minutes > 60
        ORDER BY processing_time_minutes DESC
        LIMIT 100
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const stuckFiles = await this.toolOrchestrator.executeDataQuery(stuckFilesQuery);

    // Step 2: Analyze bottlenecks by processing stage
    const bottleneckQuery: DataQuery = {
      sql: `
        SELECT 
          processing_stage,
          COUNT(*) as stuck_count,
          AVG(processing_time_minutes) as avg_time,
          MAX(processing_time_minutes) as max_time,
          AVG(retry_count) as avg_retries
        FROM roster_processing_details
        WHERE processing_stage != 'complete'
          AND processing_time_minutes > 60
        GROUP BY processing_stage
        ORDER BY stuck_count DESC
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const bottlenecks = await this.toolOrchestrator.executeDataQuery(bottleneckQuery);

    // Step 3: Analyze retry patterns
    const retryPatternQuery: DataQuery = {
      sql: `
        SELECT 
          retry_count,
          COUNT(*) as file_count,
          AVG(processing_time_minutes) as avg_time,
          SUM(CASE WHEN final_status = 'success' THEN 1 ELSE 0 END) as success_count
        FROM roster_processing_details
        WHERE processing_stage != 'complete'
          AND processing_time_minutes > 60
        GROUP BY retry_count
        ORDER BY retry_count
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const retryPatterns = await this.toolOrchestrator.executeDataQuery(retryPatternQuery);

    // Generate findings
    if (stuckFiles.rowCount > 0) {
      const totalStuck = stuckFiles.rowCount;
      const avgProcessingTime = stuckFiles.rows.reduce((sum, row) => 
        sum + (row.processing_time_minutes || 0), 0) / totalStuck;

      findings.push({
        id: `stuck_files_${Date.now()}`,
        category: 'processing_bottleneck',
        description: `Found ${totalStuck} roster files stuck in processing with average processing time of ${avgProcessingTime.toFixed(1)} minutes`,
        severity: totalStuck > 50 ? 5 : totalStuck > 20 ? 4 : 3,
        confidence: 0.95,
        evidence: [{
          id: `evidence_stuck_${Date.now()}`,
          content: `${totalStuck} files identified as stuck in non-complete stages`,
          sources: stuckFiles.sources.map(s => this.convertDataSourceToSource(s)),
          confidence: 0.95,
          timestamp: new Date(),
          type: 'data_point'
        }],
        recommendations: [
          'Review files with highest processing times for common error patterns',
          'Consider increasing timeout thresholds for complex validations',
          'Implement parallel processing for bottleneck stages'
        ],
        affectedSystems: ['roster_processing_pipeline']
      });

      recommendations.push(
        `Prioritize investigation of ${totalStuck} stuck files`,
        'Implement automated alerts for files exceeding 60-minute processing time'
      );
    }

    // Analyze bottlenecks
    if (bottlenecks.rowCount > 0) {
      for (const bottleneck of bottlenecks.rows) {
        const stage = bottleneck.processing_stage;
        const count = bottleneck.stuck_count;
        
        findings.push({
          id: `bottleneck_${stage}_${Date.now()}`,
          category: 'stage_bottleneck',
          description: `${count} files stuck in ${stage} stage with average time ${bottleneck.avg_time?.toFixed(1)} minutes`,
          severity: count > 30 ? 5 : count > 15 ? 4 : 3,
          confidence: 0.90,
          evidence: [{
            id: `evidence_bottleneck_${Date.now()}`,
            content: `Stage analysis shows ${count} files in ${stage}`,
            sources: bottlenecks.sources.map(s => this.convertDataSourceToSource(s)),
            confidence: 0.90,
            timestamp: new Date(),
            type: 'pattern'
          }],
          recommendations: [
            `Optimize ${stage} stage processing logic`,
            `Increase resources allocated to ${stage} processing`
          ],
          affectedSystems: [`${stage}_processor`]
        });
      }
    }

    // Calculate success rate for retries
    if (retryPatterns.rowCount > 0) {
      for (const pattern of retryPatterns.rows) {
        const retryCount = pattern.retry_count;
        const fileCount = pattern.file_count;
        const successCount = pattern.success_count || 0;
        const successRate = fileCount > 0 ? (successCount / fileCount) * 100 : 0;

        if (successRate < 50 && retryCount > 2) {
          recommendations.push(
            `Retry strategy for ${retryCount} retries shows ${successRate.toFixed(1)}% success rate - consider manual intervention threshold`
          );
        }
      }
    }

    return {
      procedureName: 'triage_stuck_ros',
      version: this.VERSION,
      findings,
      recommendations,
      confidence: findings.length > 0 ? 0.90 : 0.5,
      executionTime: 0,
      evidence,
      success: true
    };
  }

  /**
   * Procedure 2: Record Quality Audit
   * Examines data quality patterns and validation failures
   * Requirements: 13.2, 12.3, 12.4
   */
  private async recordQualityAudit(parameters: Record<string, any>): Promise<DiagnosticResult> {
    const findings: DiagnosticFinding[] = [];
    const evidence: Evidence[] = [];
    const recommendations: string[] = [];

    // Step 1: Analyze REJ_REC_CNT (data quality issues) vs FAIL_REC_CNT (pipeline errors)
    const qualityVsPipelineQuery: DataQuery = {
      sql: `
        SELECT 
          market_segment,
          provider_type,
          COUNT(*) as total_files,
          SUM(rejected_records) as total_rejected,
          SUM(failed_records) as total_failed,
          AVG(rejected_records * 100.0 / NULLIF(total_records, 0)) as avg_rejection_rate,
          AVG(failed_records * 100.0 / NULLIF(total_records, 0)) as avg_failure_rate
        FROM roster_processing_details
        GROUP BY market_segment, provider_type
        HAVING SUM(rejected_records) > 0
        ORDER BY total_rejected DESC
        LIMIT 50
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const qualityAnalysis = await this.toolOrchestrator.executeDataQuery(qualityVsPipelineQuery);

    // Step 2: Identify validation rule failure patterns
    const validationPatternQuery: DataQuery = {
      sql: `
        SELECT 
          error_codes,
          COUNT(*) as occurrence_count,
          SUM(rejected_records) as total_rejected_records,
          AVG(rejected_records * 100.0 / NULLIF(total_records, 0)) as avg_rejection_rate
        FROM roster_processing_details
        WHERE rejected_records > 0
        GROUP BY error_codes
        ORDER BY occurrence_count DESC
        LIMIT 20
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const validationPatterns = await this.toolOrchestrator.executeDataQuery(validationPatternQuery);

    // Step 3: Trend analysis over time
    const trendQuery: DataQuery = {
      sql: `
        SELECT 
          DATE_TRUNC('week', submission_date) as week,
          COUNT(*) as file_count,
          SUM(rejected_records) as rejected_count,
          AVG(rejected_records * 100.0 / NULLIF(total_records, 0)) as rejection_rate
        FROM roster_processing_details
        WHERE rejected_records > 0
        GROUP BY DATE_TRUNC('week', submission_date)
        ORDER BY week DESC
        LIMIT 12
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const trends = await this.toolOrchestrator.executeDataQuery(trendQuery);

    // Generate findings for data quality vs pipeline errors
    if (qualityAnalysis.rowCount > 0) {
      for (const row of qualityAnalysis.rows.slice(0, 10)) {
        const rejectionRate = row.avg_rejection_rate || 0;
        const failureRate = row.avg_failure_rate || 0;
        
        if (rejectionRate > 5) {
          findings.push({
            id: `quality_issue_${row.market_segment}_${row.provider_type}_${Date.now()}`,
            category: 'data_quality',
            description: `${row.market_segment} - ${row.provider_type}: ${rejectionRate.toFixed(1)}% rejection rate (data quality) vs ${failureRate.toFixed(1)}% failure rate (pipeline)`,
            severity: rejectionRate > 15 ? 5 : rejectionRate > 10 ? 4 : 3,
            confidence: 0.92,
            evidence: [{
              id: `evidence_quality_${Date.now()}`,
              content: `Analysis shows ${row.total_rejected} rejected records due to data quality issues`,
              sources: qualityAnalysis.sources.map(s => this.convertDataSourceToSource(s)),
              confidence: 0.92,
              timestamp: new Date(),
              type: 'data_point'
            }],
            recommendations: [
              `Review data submission guidelines for ${row.market_segment} providers`,
              'Implement pre-submission validation tools for providers',
              'Provide targeted training on common validation failures'
            ],
            affectedSystems: ['data_validation', 'provider_submission']
          });
        }
      }
    }

    // Analyze validation patterns
    if (validationPatterns.rowCount > 0) {
      const topPattern = validationPatterns.rows[0];
      if (topPattern) {
        findings.push({
          id: `validation_pattern_${Date.now()}`,
          category: 'validation_failure',
          description: `Most common validation failure: ${topPattern.error_codes} (${topPattern.occurrence_count} occurrences)`,
          severity: 4,
          confidence: 0.88,
          evidence: [{
            id: `evidence_validation_${Date.now()}`,
            content: `Validation pattern analysis identified ${topPattern.occurrence_count} files with error: ${topPattern.error_codes}`,
            sources: validationPatterns.sources.map(s => this.convertDataSourceToSource(s)),
            confidence: 0.88,
            timestamp: new Date(),
            type: 'pattern'
          }],
          recommendations: [
            'Create targeted documentation for this validation rule',
            'Implement automated pre-checks for this specific error',
            'Consider if validation rule needs adjustment'
          ],
          affectedSystems: ['validation_engine']
        });
      }
    }

    // Analyze trends
    if (trends.rowCount > 1) {
      const recentWeek = trends.rows[0];
      const previousWeek = trends.rows[1];
      
      if (recentWeek && previousWeek) {
        const recentRate = recentWeek.rejection_rate || 0;
        const previousRate = previousWeek.rejection_rate || 0;
        const change = recentRate - previousRate;

        if (Math.abs(change) > 2) {
          const direction = change > 0 ? 'increased' : 'decreased';
          recommendations.push(
            `Data quality rejection rate ${direction} by ${Math.abs(change).toFixed(1)}% this week - ${change > 0 ? 'investigate cause' : 'document improvement'}`
          );
        }
      }
    }

    recommendations.push(
      'Distinguish between data quality issues (REJ_REC_CNT) and pipeline errors (FAIL_REC_CNT) in reporting',
      'Implement provider-facing data quality dashboard',
      'Schedule quarterly data quality training sessions'
    );

    return {
      procedureName: 'record_quality_audit',
      version: this.VERSION,
      findings,
      recommendations,
      confidence: findings.length > 0 ? 0.88 : 0.5,
      executionTime: 0,
      evidence,
      success: true
    };
  }

  /**
   * Procedure 3: Market Health Report
   * Comprehensive market-level operational health assessment
   * Requirements: 13.3, 3.2, 3.5
   */
  private async marketHealthReport(parameters: Record<string, any>): Promise<DiagnosticResult> {
    const findings: DiagnosticFinding[] = [];
    const evidence: Evidence[] = [];
    const recommendations: string[] = [];

    // Step 1: Get market-level metrics
    const marketMetricsQuery: DataQuery = {
      sql: `
        SELECT 
          market_id,
          month,
          total_files_received,
          files_processed_successfully,
          average_processing_time,
          error_rate_percentage,
          data_quality_score,
          sla_compliance_percentage,
          provider_onboarding_rate
        FROM aggregated_operational_metrics
        ORDER BY month DESC
        LIMIT 100
      `,
      dataset: 'operational_metrics',
      parameters: {}
    };

    const marketMetrics = await this.toolOrchestrator.executeDataQuery(marketMetricsQuery);

    // Step 2: Correlate with file-level data
    const fileCorrelationQuery: DataQuery = {
      sql: `
        SELECT 
          market_segment as market_id,
          COUNT(*) as file_count,
          AVG(processing_time_minutes) as avg_processing_time,
          SUM(CASE WHEN final_status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
          AVG((failed_records + rejected_records) * 100.0 / NULLIF(total_records, 0)) as error_rate
        FROM roster_processing_details
        GROUP BY market_segment
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const fileData = await this.toolOrchestrator.executeDataQuery(fileCorrelationQuery);

    // Step 3: Identify top and bottom performers
    const performanceRanking = this.rankMarketPerformance(marketMetrics.rows);

    // Generate findings for each market
    if (marketMetrics.rowCount > 0) {
      // Analyze top performers
      const topPerformers = performanceRanking.slice(0, 3);
      if (topPerformers.length > 0) {
        const topMarket = topPerformers[0];
        if (topMarket) {
          findings.push({
            id: `top_performer_${topMarket.market_id}_${Date.now()}`,
            category: 'market_excellence',
            description: `${topMarket.market_id} is top performer with ${topMarket.score.toFixed(1)} health score (${topMarket.sla_compliance}% SLA compliance, ${topMarket.quality_score.toFixed(1)} quality score)`,
            severity: 1,
            confidence: 0.90,
            evidence: [{
              id: `evidence_top_${Date.now()}`,
              content: `Market analysis identifies ${topMarket.market_id} as top performer`,
              sources: marketMetrics.sources.map(s => this.convertDataSourceToSource(s)),
              confidence: 0.90,
              timestamp: new Date(),
              type: 'data_point'
            }],
            recommendations: [
              `Document best practices from ${topMarket.market_id}`,
              'Share operational strategies with other markets'
            ],
            affectedSystems: [topMarket.market_id]
          });
        }
      }

      // Analyze bottom performers
      const bottomPerformers = performanceRanking.slice(-3);
      for (const market of bottomPerformers) {
        if (market.score < 60) {
          findings.push({
            id: `underperformer_${market.market_id}_${Date.now()}`,
            category: 'market_concern',
            description: `${market.market_id} needs attention with ${market.score.toFixed(1)} health score (${market.error_rate.toFixed(1)}% error rate, ${market.sla_compliance}% SLA compliance)`,
            severity: market.score < 40 ? 5 : 4,
            confidence: 0.88,
            evidence: [{
              id: `evidence_bottom_${Date.now()}`,
              content: `Market ${market.market_id} shows concerning performance metrics`,
              sources: marketMetrics.sources.map(s => this.convertDataSourceToSource(s)),
              confidence: 0.88,
              timestamp: new Date(),
              type: 'anomaly'
            }],
            recommendations: [
              `Conduct deep-dive analysis of ${market.market_id} operations`,
              'Allocate additional resources or training',
              'Implement targeted improvement plan'
            ],
            affectedSystems: [market.market_id]
          });
        }
      }
    }

    // Cross-dataset correlation insights
    if (fileData.rowCount > 0 && marketMetrics.rowCount > 0) {
      recommendations.push(
        'Continue monitoring market-level trends for early warning signs',
        'Implement automated market health dashboards',
        'Schedule quarterly market performance reviews'
      );
    }

    return {
      procedureName: 'market_health_report',
      version: this.VERSION,
      findings,
      recommendations,
      confidence: findings.length > 0 ? 0.87 : 0.5,
      executionTime: 0,
      evidence,
      success: true
    };
  }

  /**
   * Procedure 4: Retry Effectiveness Analysis
   * Analyzes retry operation success rates and patterns
   * Requirements: 13.4, 4.4
   */
  private async retryEffectivenessAnalysis(parameters: Record<string, any>): Promise<DiagnosticResult> {
    const findings: DiagnosticFinding[] = [];
    const evidence: Evidence[] = [];
    const recommendations: string[] = [];

    // Step 1: Analyze retry success rates by retry count
    const retrySuccessQuery: DataQuery = {
      sql: `
        SELECT 
          retry_count,
          COUNT(*) as total_files,
          SUM(CASE WHEN final_status = 'success' THEN 1 ELSE 0 END) as successful_files,
          SUM(CASE WHEN final_status = 'failed' THEN 1 ELSE 0 END) as failed_files,
          AVG(processing_time_minutes) as avg_processing_time,
          AVG(CASE WHEN final_status = 'success' THEN processing_time_minutes END) as avg_success_time,
          AVG(CASE WHEN final_status = 'failed' THEN processing_time_minutes END) as avg_failure_time
        FROM roster_processing_details
        WHERE retry_count > 0
        GROUP BY retry_count
        ORDER BY retry_count
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const retrySuccess = await this.toolOrchestrator.executeDataQuery(retrySuccessQuery);

    // Step 2: Analyze retry patterns by error type
    const retryByErrorQuery: DataQuery = {
      sql: `
        SELECT 
          error_codes,
          AVG(retry_count) as avg_retries,
          COUNT(*) as file_count,
          SUM(CASE WHEN final_status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
          AVG(processing_time_minutes) as avg_time
        FROM roster_processing_details
        WHERE retry_count > 0
        GROUP BY error_codes
        ORDER BY file_count DESC
        LIMIT 20
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const retryByError = await this.toolOrchestrator.executeDataQuery(retryByErrorQuery);

    // Step 3: Cost-benefit analysis
    const costBenefitQuery: DataQuery = {
      sql: `
        SELECT 
          SUM(CASE WHEN retry_count = 0 THEN processing_time_minutes ELSE 0 END) as no_retry_time,
          SUM(CASE WHEN retry_count > 0 THEN processing_time_minutes ELSE 0 END) as retry_time,
          COUNT(CASE WHEN retry_count = 0 THEN 1 END) as no_retry_count,
          COUNT(CASE WHEN retry_count > 0 THEN 1 END) as retry_count_total,
          SUM(CASE WHEN retry_count > 0 AND final_status = 'success' THEN 1 ELSE 0 END) as retry_success_count
        FROM roster_processing_details
      `,
      dataset: 'roster_processing',
      parameters: {}
    };

    const costBenefit = await this.toolOrchestrator.executeDataQuery(costBenefitQuery);

    // Analyze retry effectiveness by retry count
    if (retrySuccess.rowCount > 0) {
      for (const row of retrySuccess.rows) {
        const retryCount = row.retry_count;
        const totalFiles = row.total_files;
        const successfulFiles = row.successful_files || 0;
        const successRate = totalFiles > 0 ? (successfulFiles / totalFiles) * 100 : 0;

        findings.push({
          id: `retry_effectiveness_${retryCount}_${Date.now()}`,
          category: 'retry_analysis',
          description: `Retry attempt ${retryCount}: ${successRate.toFixed(1)}% success rate (${successfulFiles}/${totalFiles} files)`,
          severity: successRate < 30 ? 4 : successRate < 50 ? 3 : 2,
          confidence: 0.93,
          evidence: [{
            id: `evidence_retry_${Date.now()}`,
            content: `Analysis of ${totalFiles} files with ${retryCount} retries shows ${successRate.toFixed(1)}% success rate`,
            sources: retrySuccess.sources.map(s => this.convertDataSourceToSource(s)),
            confidence: 0.93,
            timestamp: new Date(),
            type: 'data_point'
          }],
          recommendations: 
            successRate < 30 
              ? [`Consider manual intervention threshold at retry ${retryCount}`, 'Investigate root causes for low success rate']
              : successRate > 70
              ? [`Retry strategy at attempt ${retryCount} is effective`, 'Continue current approach']
              : ['Monitor retry effectiveness', 'Consider optimization opportunities'],
          affectedSystems: ['retry_processor']
        });

        if (successRate < 30 && retryCount > 2) {
          recommendations.push(
            `Retry attempt ${retryCount} shows diminishing returns (${successRate.toFixed(1)}% success) - consider manual intervention`
          );
        }
      }
    }

    // Analyze retry patterns by error type
    if (retryByError.rowCount > 0) {
      for (const row of retryByError.rows.slice(0, 5)) {
        const successRate = row.success_rate || 0;
        const errorCode = row.error_codes;

        if (successRate < 40) {
          recommendations.push(
            `Error "${errorCode}" has low retry success rate (${successRate.toFixed(1)}%) - consider alternative handling strategy`
          );
        }
      }
    }

    // Cost-benefit analysis
    if (costBenefit.rowCount > 0) {
      const data = costBenefit.rows[0];
      if (data) {
        const retrySuccessCount = data.retry_success_count || 0;
        const retryCountTotal = data.retry_count_total || 0;
        const retryTime = data.retry_time || 0;
        const overallRetrySuccessRate = retryCountTotal > 0 ? (retrySuccessCount / retryCountTotal) * 100 : 0;

        findings.push({
          id: `cost_benefit_${Date.now()}`,
          category: 'cost_analysis',
          description: `Overall retry strategy: ${overallRetrySuccessRate.toFixed(1)}% success rate, ${retryTime.toFixed(0)} total minutes invested in retries`,
          severity: 2,
          confidence: 0.90,
          evidence: [{
            id: `evidence_cost_${Date.now()}`,
            content: `Cost-benefit analysis shows ${retrySuccessCount} successful recoveries from ${retryCountTotal} retry attempts`,
            sources: costBenefit.sources.map(s => this.convertDataSourceToSource(s)),
            confidence: 0.90,
            timestamp: new Date(),
            type: 'data_point'
          }],
          recommendations: [
            overallRetrySuccessRate > 60 
              ? 'Retry strategy is cost-effective, continue current approach'
              : 'Consider optimizing retry strategy or implementing earlier manual intervention',
            'Track retry costs vs manual intervention costs for ROI analysis'
          ],
          affectedSystems: ['retry_processor', 'manual_intervention']
        });
      }
    }

    recommendations.push(
      'Implement adaptive retry strategies based on error type',
      'Set up automated alerts for retry patterns indicating systemic issues',
      'Document retry effectiveness metrics for continuous improvement'
    );

    return {
      procedureName: 'retry_effectiveness_analysis',
      version: this.VERSION,
      findings,
      recommendations,
      confidence: findings.length > 0 ? 0.91 : 0.5,
      executionTime: 0,
      evidence,
      success: true
    };
  }

  /**
   * Helper: Rank market performance
   */
  private rankMarketPerformance(markets: Record<string, any>[]): Array<{
    market_id: string;
    score: number;
    sla_compliance: number;
    error_rate: number;
    quality_score: number;
  }> {
    return markets.map(m => ({
      market_id: m.market_id,
      score: this.calculateMarketHealthScore(m),
      sla_compliance: m.sla_compliance_percentage || 0,
      error_rate: m.error_rate_percentage || 0,
      quality_score: m.data_quality_score || 0
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Helper: Calculate market health score
   */
  private calculateMarketHealthScore(market: Record<string, any>): number {
    const slaWeight = 0.4;
    const qualityWeight = 0.3;
    const errorWeight = 0.3;

    const slaScore = (market.sla_compliance_percentage || 0);
    const qualityScore = (market.data_quality_score || 0) * 100;
    const errorScore = 100 - (market.error_rate_percentage || 0);

    return (slaScore * slaWeight) + (qualityScore * qualityWeight) + (errorScore * errorWeight);
  }

  /**
   * Helper: Convert DataSource to Source
   */
  private convertDataSourceToSource(dataSource: any): Source {
    return {
      id: dataSource.name,
      type: 'csv_data',
      name: dataSource.name,
      timestamp: new Date(dataSource.lastModified),
      confidence: 1.0,
      metadata: {
        path: dataSource.path,
        checksum: dataSource.checksum
      }
    };
  }
}
