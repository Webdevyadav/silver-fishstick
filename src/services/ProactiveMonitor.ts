import { MemoryManager } from './MemoryManager';
import { logger } from '@/utils/logger';
import { 
  StateChange, 
  Alert, 
  DataStateSnapshot
} from '@/types/domain';
import { Anomaly } from '@/types/tools';
import crypto from 'crypto';

export interface MonitoringConfig {
  checkIntervalMs: number;
  anomalyThreshold: number;
  alertSeverityThreshold: number;
  maxAlertsPerHour: number;
  enablePatternLearning: boolean;
}

export interface AnomalyPattern {
  id: string;
  type: string;
  description: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
  associatedMetrics: string[];
}

export interface AlertResolution {
  alertId: string;
  resolvedAt: Date;
  resolutionMethod: string;
  effectiveness: number;
  notes: string;
}

/**
 * ProactiveMonitor - Implements anomaly detection and alert generation
 * 
 * This class continuously monitors roster processing patterns and generates
 * proactive alerts when anomalies or concerning trends are detected.
 */
export class ProactiveMonitor {
  private memoryManager: MemoryManager;
  private config: MonitoringConfig;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout | undefined;
  private alertHistory: Alert[] = [];
  private anomalyPatterns: Map<string, AnomalyPattern> = new Map();
  private alertResolutions: Map<string, AlertResolution> = new Map();
  private lastDataState?: DataStateSnapshot;

  constructor(config?: Partial<MonitoringConfig>) {
    this.memoryManager = MemoryManager.getInstance();
    this.config = {
      checkIntervalMs: 60000, // Check every minute
      anomalyThreshold: 0.7,
      alertSeverityThreshold: 3,
      maxAlertsPerHour: 10,
      enablePatternLearning: true,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    try {
      await this.memoryManager.initialize();
      await this.loadHistoricalPatterns();
      logger.info('ProactiveMonitor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ProactiveMonitor:', error);
      throw error;
    }
  }

  /**
   * Start proactive monitoring loop
   */
  public async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      logger.warn('ProactiveMonitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting proactive monitoring');

    // Initial data state capture
    this.lastDataState = await this.captureCurrentDataState();

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        logger.error('Error in monitoring cycle:', error);
      }
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop proactive monitoring
   */
  public stopMonitoring(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Proactive monitoring stopped');
  }

  /**
   * Detect anomalies in roster processing patterns
   */
  public async detectAnomalies(dataset: string, metrics: string[]): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Get current data state
      const currentState = await this.captureCurrentDataState();
      
      if (!this.lastDataState) {
        this.lastDataState = currentState;
        return anomalies; // No baseline for comparison
      }

      // Detect statistical anomalies in key metrics
      for (const metric of metrics) {
        const currentValue = currentState.keyMetrics[metric];
        const previousValue = this.lastDataState.keyMetrics[metric];

        if (currentValue !== undefined && previousValue !== undefined) {
          const anomaly = await this.detectMetricAnomaly(metric, currentValue, previousValue, dataset);
          if (anomaly) {
            anomalies.push(anomaly);
          }
        }
      }

      // Detect pattern-based anomalies
      const patternAnomalies = await this.detectPatternAnomalies(currentState, this.lastDataState);
      anomalies.push(...patternAnomalies);

      // Update last data state
      this.lastDataState = currentState;

      // Learn from detected anomalies if enabled
      if (this.config.enablePatternLearning) {
        await this.learnFromAnomalies(anomalies);
      }

      logger.debug(`Detected ${anomalies.length} anomalies in ${dataset}`);
      return anomalies;

    } catch (error) {
      logger.error('Failed to detect anomalies:', error);
      return anomalies;
    }
  }

  /**
   * Generate alert with severity levels and recommendations
   */
  public async generateAlert(
    anomalies: Anomaly[], 
    stateChanges: StateChange[]
  ): Promise<Alert | null> {
    if (anomalies.length === 0 && stateChanges.length === 0) {
      return null;
    }

    // Check alert rate limiting
    if (!this.shouldGenerateAlert()) {
      logger.debug('Alert generation rate limited');
      return null;
    }

    // Calculate overall severity
    const anomalySeverity = anomalies.length > 0 ? 
      Math.max(...anomalies.map(a => a.severity)) : 0;
    const changeSeverity = stateChanges.length > 0 ? 
      Math.max(...stateChanges.map(c => c.severity)) : 0;
    const overallSeverity = Math.max(anomalySeverity, changeSeverity) as 1 | 2 | 3 | 4 | 5;

    // Only generate alerts at or above threshold
    if (overallSeverity < this.config.alertSeverityThreshold) {
      return null;
    }

    // Generate alert content
    const title = this.generateAlertTitle(anomalies, stateChanges);
    const message = this.generateAlertMessage(anomalies, stateChanges);
    const recommendations = await this.generateRecommendations(anomalies, stateChanges);
    const affectedSystems = this.extractAffectedSystems(anomalies, stateChanges);

    const alert: Alert = {
      id: crypto.randomUUID(),
      type: 'proactive',
      severity: overallSeverity,
      title,
      message,
      recommendations,
      affectedSystems,
      timestamp: new Date(),
      resolved: false,
      stateChanges
    };

    // Store alert in history
    this.alertHistory.push(alert);

    logger.info(`Generated proactive alert: ${title} (severity: ${overallSeverity})`);
    return alert;
  }

  /**
   * Analyze state changes and generate proactive notifications
   */
  public async analyzeStateChanges(sessionId: string): Promise<StateChange[]> {
    try {
      const stateChanges = await this.memoryManager.detectStateChanges(sessionId);
      
      if (stateChanges.length === 0) {
        return [];
      }

      // Enhance state changes with additional analysis
      const enhancedChanges: StateChange[] = [];

      for (const change of stateChanges) {
        const enhancedChange = await this.enhanceStateChange(change);
        enhancedChanges.push(enhancedChange);
      }

      // Look for patterns in state changes
      await this.analyzeChangePatterns(enhancedChanges);

      return enhancedChanges;

    } catch (error) {
      logger.error('Failed to analyze state changes:', error);
      return [];
    }
  }

  /**
   * Track alert resolution and learn from patterns
   */
  public async trackAlertResolution(
    alertId: string, 
    resolutionMethod: string, 
    effectiveness: number,
    notes: string = ''
  ): Promise<void> {
    const resolution: AlertResolution = {
      alertId,
      resolvedAt: new Date(),
      resolutionMethod,
      effectiveness,
      notes
    };

    this.alertResolutions.set(alertId, resolution);

    // Mark alert as resolved
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }

    // Learn from resolution patterns
    if (this.config.enablePatternLearning) {
      await this.learnFromResolution(resolution);
    }

    logger.info(`Alert ${alertId} resolved using ${resolutionMethod} (effectiveness: ${effectiveness})`);
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): {
    isRunning: boolean;
    totalAlerts: number;
    resolvedAlerts: number;
    averageResolutionTime: number;
    knownPatterns: number;
    lastMonitoringCycle: Date | null;
  } {
    const resolvedAlerts = this.alertHistory.filter(a => a.resolved).length;
    const resolutionTimes = Array.from(this.alertResolutions.values())
      .map(r => {
        const alertTimestamp = this.alertHistory.find(a => a.id === r.alertId)?.timestamp.getTime();
        return alertTimestamp ? r.resolvedAt.getTime() - alertTimestamp : 0;
      })
      .filter(t => t > 0);
    
    const averageResolutionTime = resolutionTimes.length > 0 ? 
      resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

    return {
      isRunning: this.isRunning,
      totalAlerts: this.alertHistory.length,
      resolvedAlerts,
      averageResolutionTime,
      knownPatterns: this.anomalyPatterns.size,
      lastMonitoringCycle: this.lastDataState?.timestamp || null
    };
  }

  // Private helper methods

  private async performMonitoringCycle(): Promise<void> {
    logger.debug('Performing monitoring cycle');

    try {
      // Detect anomalies in key datasets
      const rosterAnomalies = await this.detectAnomalies('roster_processing', [
        'totalFiles', 'errorRate', 'avgProcessingTime', 'qualityScore'
      ]);

      const metricsAnomalies = await this.detectAnomalies('operational_metrics', [
        'errorRate', 'processingTime', 'qualityScore'
      ]);

      const allAnomalies = [...rosterAnomalies, ...metricsAnomalies];

      // Analyze state changes across all active sessions
      // For now, we'll use a placeholder session ID
      const stateChanges = await this.analyzeStateChanges('monitoring-session');

      // Generate alert if necessary
      if (allAnomalies.length > 0 || stateChanges.length > 0) {
        const alert = await this.generateAlert(allAnomalies, stateChanges);
        if (alert) {
          // TODO: Send alert to notification system
          logger.info(`Proactive alert generated: ${alert.title}`);
        }
      }

    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
    }
  }

  private async captureCurrentDataState(): Promise<DataStateSnapshot> {
    // TODO: In a real implementation, this would query actual data sources
    // For now, return a simulated state with some variation
    
    const timestamp = new Date();
    const baseMetrics = {
      totalFiles: 1000 + Math.floor(Math.random() * 200),
      errorRate: 0.05 + (Math.random() - 0.5) * 0.02,
      avgProcessingTime: 120 + Math.floor(Math.random() * 60),
      qualityScore: 0.85 + (Math.random() - 0.5) * 0.1
    };

    return {
      timestamp,
      rosterProcessingChecksum: `roster_${timestamp.getTime()}`,
      operationalMetricsChecksum: `metrics_${timestamp.getTime()}`,
      totalRecords: baseMetrics.totalFiles,
      lastModified: timestamp,
      keyMetrics: baseMetrics
    };
  }

  private async detectMetricAnomaly(
    metric: string, 
    currentValue: number, 
    previousValue: number,
    dataset: string
  ): Promise<Anomaly | null> {
    // Calculate percentage change
    const percentChange = Math.abs((currentValue - previousValue) / previousValue);
    
    // Define thresholds for different metrics
    const thresholds: Record<string, number> = {
      errorRate: 0.5,      // 50% change in error rate
      totalFiles: 0.3,     // 30% change in file count
      avgProcessingTime: 0.4, // 40% change in processing time
      qualityScore: 0.2    // 20% change in quality score
    };

    const threshold = thresholds[metric] || 0.3;

    if (percentChange > threshold) {
      const severity = this.calculateAnomalySeverity(percentChange, threshold);
      
      return {
        id: crypto.randomUUID(),
        type: 'statistical',
        description: `Significant change in ${metric}: ${previousValue} → ${currentValue} (${Math.round(percentChange * 100)}% change)`,
        severity,
        affectedMetrics: [metric],
        detectionTime: new Date(),
        confidence: Math.min(percentChange / threshold, 1.0),
        evidence: [{
          id: crypto.randomUUID(),
          content: `Metric ${metric} changed from ${previousValue} to ${currentValue}`,
          sources: [{
            id: crypto.randomUUID(),
            type: 'csv_data',
            name: dataset,
            timestamp: new Date(),
            confidence: 0.9,
            metadata: { metric, previousValue, currentValue }
          }],
          confidence: 0.9,
          timestamp: new Date(),
          type: 'data_point'
        }]
      };
    }

    return null;
  }

  private async detectPatternAnomalies(
    currentState: DataStateSnapshot,
    previousState: DataStateSnapshot
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Check for known patterns
    for (const pattern of this.anomalyPatterns.values()) {
      const matches = await this.checkPatternMatch(pattern, currentState, previousState);
      
      if (matches && pattern.confidence > this.config.anomalyThreshold) {
        anomalies.push({
          id: crypto.randomUUID(),
          type: 'pattern',
          description: `Known pattern detected: ${pattern.description}`,
          severity: Math.min(Math.ceil(pattern.confidence * 5), 5) as 1 | 2 | 3 | 4 | 5,
          affectedMetrics: pattern.associatedMetrics,
          detectionTime: new Date(),
          confidence: pattern.confidence,
          evidence: [{
            id: crypto.randomUUID(),
            content: `Pattern ${pattern.type} detected with confidence ${pattern.confidence}`,
            sources: [],
            confidence: pattern.confidence,
            timestamp: new Date(),
            type: 'pattern'
          }]
        });

        // Update pattern frequency
        pattern.frequency++;
        pattern.lastSeen = new Date();
      }
    }

    return anomalies;
  }

  private calculateAnomalySeverity(percentChange: number, threshold: number): 1 | 2 | 3 | 4 | 5 {
    const ratio = percentChange / threshold;
    
    if (ratio > 3) return 5;      // Critical
    if (ratio > 2) return 4;      // High
    if (ratio > 1.5) return 3;    // Medium
    if (ratio > 1) return 2;      // Low
    return 1;                     // Info
  }

  private async checkPatternMatch(
    pattern: AnomalyPattern,
    currentState: DataStateSnapshot,
    previousState: DataStateSnapshot
  ): Promise<boolean> {
    // Simple pattern matching based on metric changes
    // In a real implementation, this would use more sophisticated ML techniques
    
    for (const metric of pattern.associatedMetrics) {
      const currentValue = currentState.keyMetrics[metric];
      const previousValue = previousState.keyMetrics[metric];
      
      if (currentValue !== undefined && previousValue !== undefined) {
        const change = Math.abs((currentValue - previousValue) / previousValue);
        if (change > 0.1) { // 10% change threshold
          return true;
        }
      }
    }
    
    return false;
  }

  private shouldGenerateAlert(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = this.alertHistory.filter(a => a.timestamp > oneHourAgo);
    
    return recentAlerts.length < this.config.maxAlertsPerHour;
  }

  private generateAlertTitle(anomalies: Anomaly[], stateChanges: StateChange[]): string {
    if (anomalies.length > 0 && stateChanges.length > 0) {
      return `Multiple Issues Detected: ${anomalies.length} anomalies, ${stateChanges.length} state changes`;
    } else if (anomalies.length > 0) {
      return anomalies.length === 1 ? 
        `Anomaly Detected: ${anomalies[0]?.description}` :
        `Multiple Anomalies Detected (${anomalies.length})`;
    } else {
      return stateChanges.length === 1 ?
        `State Change: ${stateChanges[0]?.description}` :
        `Multiple State Changes (${stateChanges.length})`;
    }
  }

  private generateAlertMessage(anomalies: Anomaly[], stateChanges: StateChange[]): string {
    let message = 'Proactive monitoring has detected the following issues:\n\n';

    if (anomalies.length > 0) {
      message += 'ANOMALIES:\n';
      anomalies.forEach((anomaly, index) => {
        message += `${index + 1}. ${anomaly.description} (confidence: ${Math.round(anomaly.confidence * 100)}%)\n`;
      });
      message += '\n';
    }

    if (stateChanges.length > 0) {
      message += 'STATE CHANGES:\n';
      stateChanges.forEach((change, index) => {
        message += `${index + 1}. ${change.description} (severity: ${change.severity})\n`;
      });
    }

    return message;
  }

  private async generateRecommendations(anomalies: Anomaly[], stateChanges: StateChange[]): Promise<string[]> {
    const recommendations = new Set<string>();

    // Recommendations based on anomalies
    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case 'statistical':
          recommendations.add('Investigate root cause of metric changes');
          recommendations.add('Review recent system changes or data updates');
          break;
        case 'pattern':
          recommendations.add('Apply known resolution patterns for this anomaly type');
          recommendations.add('Monitor for escalation of pattern frequency');
          break;
        case 'threshold':
          recommendations.add('Adjust processing capacity or resource allocation');
          break;
        case 'trend':
          recommendations.add('Analyze trend patterns and forecast potential impacts');
          recommendations.add('Implement preventive measures based on trend direction');
          break;
        default:
          recommendations.add('Review anomaly details and implement appropriate monitoring');
          break;
      }
    }

    // Recommendations based on state changes
    for (const change of stateChanges) {
      switch (change.type) {
        case 'data_update':
          recommendations.add('Validate data quality and completeness');
          break;
        case 'metric_change':
          recommendations.add('Analyze impact on downstream processes');
          break;
        case 'new_anomaly':
          recommendations.add('Implement immediate monitoring and containment measures');
          break;
      }
    }

    return Array.from(recommendations);
  }

  private extractAffectedSystems(anomalies: Anomaly[], stateChanges: StateChange[]): string[] {
    const systems = new Set<string>();

    // Systems from anomalies
    for (const anomaly of anomalies) {
      for (const metric of anomaly.affectedMetrics) {
        if (metric.includes('roster') || metric.includes('file')) {
          systems.add('roster_processing');
        }
        if (metric.includes('metric') || metric.includes('operational')) {
          systems.add('operational_metrics');
        }
      }
    }

    // Systems from state changes
    for (const change of stateChanges) {
      for (const data of change.affectedData) {
        if (data.includes('roster')) {
          systems.add('roster_processing');
        }
        if (data.includes('metrics') || data.includes('operational')) {
          systems.add('operational_metrics');
        }
      }
    }

    return Array.from(systems);
  }

  private async enhanceStateChange(change: StateChange): Promise<StateChange> {
    // Add additional context and analysis to state changes
    // For now, just return the original change
    return change;
  }

  private async analyzeChangePatterns(changes: StateChange[]): Promise<void> {
    // Analyze patterns in state changes for learning
    // This would implement pattern recognition algorithms
    logger.debug(`Analyzing patterns in ${changes.length} state changes`);
  }

  private async learnFromAnomalies(anomalies: Anomaly[]): Promise<void> {
    // Learn new patterns from detected anomalies
    for (const anomaly of anomalies) {
      const patternId = `${anomaly.type}_${anomaly.affectedMetrics.join('_')}`;
      
      if (this.anomalyPatterns.has(patternId)) {
        const pattern = this.anomalyPatterns.get(patternId)!;
        pattern.frequency++;
        pattern.lastSeen = new Date();
        pattern.confidence = Math.min(pattern.confidence + 0.1, 1.0);
      } else {
        const newPattern: AnomalyPattern = {
          id: patternId,
          type: anomaly.type,
          description: anomaly.description,
          frequency: 1,
          lastSeen: new Date(),
          confidence: anomaly.confidence,
          associatedMetrics: anomaly.affectedMetrics
        };
        
        this.anomalyPatterns.set(patternId, newPattern);
      }
    }
  }

  private async learnFromResolution(resolution: AlertResolution): Promise<void> {
    // Learn from successful alert resolutions
    logger.debug(`Learning from resolution: ${resolution.resolutionMethod} (effectiveness: ${resolution.effectiveness})`);
    
    // TODO: Implement machine learning from resolution patterns
    // This would update recommendation algorithms based on what works
  }

  private async loadHistoricalPatterns(): Promise<void> {
    // TODO: Load historical anomaly patterns from persistent storage
    // For now, initialize with some basic patterns
    
    const basicPatterns: AnomalyPattern[] = [
      {
        id: 'high_error_rate',
        type: 'statistical',
        description: 'Elevated error rate pattern',
        frequency: 0,
        lastSeen: new Date(),
        confidence: 0.8,
        associatedMetrics: ['errorRate']
      },
      {
        id: 'processing_slowdown',
        type: 'statistical', 
        description: 'Processing time increase pattern',
        frequency: 0,
        lastSeen: new Date(),
        confidence: 0.7,
        associatedMetrics: ['avgProcessingTime']
      }
    ];

    for (const pattern of basicPatterns) {
      this.anomalyPatterns.set(pattern.id, pattern);
    }

    logger.debug(`Loaded ${basicPatterns.length} historical patterns`);
  }
}