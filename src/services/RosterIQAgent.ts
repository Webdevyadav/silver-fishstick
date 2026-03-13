import { MemoryManager } from './MemoryManager';
import { logger } from '@/utils/logger';
import { 
  RosterIQAgent as IRosterIQAgent,
  AgentResponse,
  ReasoningStep,
  StepResult,
  QueryIntent,
  AgentConfig,
  ReasoningContext
} from '@/types/agent';
import { 
  StateChange, 
  Alert, 
  Evidence,
  Source,
  Flag
} from '@/types/domain';
import { EpisodicEntry } from '@/types/memory';
import crypto from 'crypto';

/**
 * RosterIQ Agent Core - Central autonomous reasoning engine
 * 
 * This class implements the main reasoning loop for the RosterIQ AI agent system.
 * It orchestrates query processing, tool selection, evidence collection, and
 * response generation with persistent memory integration.
 */
export class RosterIQAgent implements IRosterIQAgent {
  private memoryManager: MemoryManager;
  private config: AgentConfig;
  private initialized = false;
  private activeReasoningLoops = new Map<string, boolean>();

  constructor(config?: Partial<AgentConfig>) {
    this.memoryManager = MemoryManager.getInstance();
    this.config = {
      maxReasoningSteps: 10,
      confidenceThreshold: 0.7,
      timeoutMs: 30000,
      enableProactiveMonitoring: true,
      memoryRetentionDays: 90,
      maxConcurrentQueries: 5,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.memoryManager.initialize();
      this.initialized = true;
      
      if (this.config.enableProactiveMonitoring) {
        await this.startReasoningLoop();
      }
      
      logger.info('RosterIQ Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RosterIQ Agent:', error);
      throw error;
    }
  }

  /**
   * Process a natural language query with autonomous reasoning
   */
  public async processQuery(query: string, sessionId: string): Promise<AgentResponse> {
    this.ensureInitialized();
    
    if (this.activeReasoningLoops.size >= this.config.maxConcurrentQueries) {
      throw new Error('Maximum concurrent queries exceeded. Please try again later.');
    }

    const startTime = Date.now();
    const reasoningId = crypto.randomUUID();
    
    try {
      this.activeReasoningLoops.set(reasoningId, true);
      
      // Step 1: Load session context and detect changes
      const sessionHistory = await this.memoryManager.getSessionHistory(sessionId);
      const stateChanges = await this.memoryManager.detectStateChanges(sessionId);
      
      // Step 2: Enrich query with context if state changes detected
      let enrichedQuery = query;
      if (stateChanges.length > 0) {
        const contextInfo = this.generateStateChangeContext(stateChanges);
        enrichedQuery = this.enrichQueryWithContext(query, contextInfo);
      }
      
      // Step 3: Analyze query and determine reasoning path
      const queryIntent = await this.classifyIntent(enrichedQuery);
      const reasoningContext: ReasoningContext = {
        sessionId,
        userId: sessionHistory.sessionId, // Using sessionId as userId for now
        query: enrichedQuery,
        intent: queryIntent,
        sessionHistory: sessionHistory.entries,
        stateChanges,
        availableTools: this.getAvailableTools(),
        constraints: {}
      };
      
      // Step 4: Execute reasoning loop with evidence collection
      const reasoningSteps = await this.planReasoningSequence(queryIntent, reasoningContext);
      const evidence: Evidence[] = [];
      const executedSteps: ReasoningStep[] = [];
      
      for (const step of reasoningSteps) {
        if (executedSteps.length >= this.config.maxReasoningSteps) {
          logger.warn(`Reached maximum reasoning steps (${this.config.maxReasoningSteps})`);
          break;
        }
        
        const stepResult = await this.executeStep(step);
        evidence.push(...stepResult.evidence);
        executedSteps.push(step);
        
        // Update confidence and potentially add clarification steps
        if (stepResult.confidence < this.config.confidenceThreshold) {
          const additionalSteps = await this.generateClarificationSteps(step, evidence);
          reasoningSteps.push(...additionalSteps);
        }
      }
      
      // Step 5: Synthesize response with source attribution
      const response = await this.synthesizeResponse(evidence, enrichedQuery, reasoningContext);
      const overallConfidence = this.calculateOverallConfidence(evidence);
      const sources = this.extractSources(evidence);
      const newFlags = await this.detectNewFlags(response, evidence, reasoningContext);
      
      // Step 6: Create agent response
      const agentResponse: AgentResponse = {
        response,
        sources,
        confidence: overallConfidence,
        reasoning: executedSteps,
        flags: newFlags,
        visualizations: [], // TODO: Implement in Task 6.5
        executionTime: Date.now() - startTime,
        sessionId
      };
      
      // Step 7: Update episodic memory
      const episodicEntry: EpisodicEntry = {
        sessionId,
        timestamp: new Date(),
        query: enrichedQuery,
        response,
        flags: newFlags,
        dataState: await this.getCurrentDataState(),
        toolsUsed: this.extractToolsUsed(executedSteps),
        confidence: overallConfidence,
        reasoning: executedSteps
      };
      
      await this.memoryManager.updateEpisodicMemory(episodicEntry);
      
      logger.info(`Query processed successfully in ${agentResponse.executionTime}ms`);
      return agentResponse;
      
    } catch (error) {
      logger.error('Failed to process query:', error);
      throw error;
    } finally {
      this.activeReasoningLoops.delete(reasoningId);
    }
  }

  /**
   * Start the autonomous reasoning loop for proactive monitoring
   */
  public async startReasoningLoop(): Promise<void> {
    this.ensureInitialized();
    
    if (!this.config.enableProactiveMonitoring) {
      logger.info('Proactive monitoring disabled');
      return;
    }
    
    logger.info('Starting autonomous reasoning loop for proactive monitoring');
    
    // TODO: Implement proactive monitoring loop in Task 5.3
    // This would periodically check for anomalies and generate alerts
  }

  /**
   * Execute a single reasoning step
   */
  public async executeStep(step: ReasoningStep): Promise<StepResult> {
    const startTime = Date.now();
    
    try {
      let evidence: Evidence[] = [];
      let success = true;
      let errorMessage: string | undefined;
      
      switch (step.type) {
        case 'analyze':
          evidence = await this.executeAnalysisStep(step);
          break;
          
        case 'query':
          evidence = await this.executeQueryStep(step);
          break;
          
        case 'search':
          evidence = await this.executeSearchStep(step);
          break;
          
        case 'correlate':
          evidence = await this.executeCorrelationStep(step);
          break;
          
        case 'conclude':
          evidence = await this.executeConclusionStep(step);
          break;
          
        default:
          success = false;
          errorMessage = `Unknown step type: ${step.type}`;
      }
      
      const confidence = this.calculateStepConfidence(evidence, step);
      
      return {
        stepId: step.id,
        success,
        evidence,
        confidence,
        duration: Date.now() - startTime,
        ...(errorMessage && { errorMessage })
      };
      
    } catch (error) {
      logger.error(`Failed to execute reasoning step ${step.id}:`, error);
      return {
        stepId: step.id,
        success: false,
        evidence: [],
        confidence: 0,
        duration: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate proactive alert based on state changes
   */
  public async generateProactiveAlert(changes: StateChange[]): Promise<Alert> {
    this.ensureInitialized();
    
    if (changes.length === 0) {
      throw new Error('Cannot generate alert for empty state changes');
    }
    
    // Calculate overall severity (max of individual severities)
    const maxSeverity = Math.max(...changes.map(c => c.severity)) as 1 | 2 | 3 | 4 | 5;
    
    // Generate alert title and message
    const title = this.generateAlertTitle(changes);
    const message = this.generateAlertMessage(changes);
    const recommendations = await this.generateAlertRecommendations(changes);
    const affectedSystems = this.extractAffectedSystems(changes);
    
    const alert: Alert = {
      id: crypto.randomUUID(),
      type: 'proactive',
      severity: maxSeverity,
      title,
      message,
      recommendations,
      affectedSystems,
      timestamp: new Date(),
      resolved: false,
      stateChanges: changes
    };
    
    logger.info(`Generated proactive alert: ${title} (severity: ${maxSeverity})`);
    return alert;
  }

  /**
   * Improve workflow based on feedback (placeholder for Task 3.3)
   */
  public async improveWorkflow(procedureName: string, feedback: string): Promise<void> {
    this.ensureInitialized();
    
    // TODO: Implement in Task 3.3 when procedural memory is available
    logger.info(`Workflow improvement requested for ${procedureName}: ${feedback}`);
    throw new Error('Workflow improvement not yet implemented. Will be completed in Task 3.3');
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RosterIQ Agent not initialized. Call initialize() first.');
    }
  }

  /**
   * Classify query intent using Gemini 2.0 Flash
   */
  private async classifyIntent(query: string): Promise<QueryIntent> {
    // TODO: Integrate with Gemini 2.0 Flash API in Task 11.2
    // For now, use rule-based classification
    
    const lowerQuery = query.toLowerCase();
    
    // Diagnostic procedure patterns
    if (lowerQuery.includes('triage') || lowerQuery.includes('stuck') || lowerQuery.includes('diagnostic')) {
      return {
        type: 'diagnostic_procedure',
        confidence: 0.8,
        parameters: { procedureName: this.extractProcedureName(query) },
        requiredTools: ['procedural_memory', 'data_query'],
        complexity: 'moderate'
      };
    }
    
    // Correlation analysis patterns
    if (lowerQuery.includes('correlat') || lowerQuery.includes('relationship') || lowerQuery.includes('between')) {
      return {
        type: 'correlation',
        confidence: 0.9,
        parameters: { analysisType: 'cross_dataset' },
        requiredTools: ['data_query', 'correlation_analysis'],
        complexity: 'complex'
      };
    }
    
    // Data analysis patterns
    if (lowerQuery.includes('show') || lowerQuery.includes('analyze') || lowerQuery.includes('what')) {
      return {
        type: 'data_analysis',
        confidence: 0.7,
        parameters: { queryType: 'exploratory' },
        requiredTools: ['data_query'],
        complexity: 'simple'
      };
    }
    
    // Monitoring patterns
    if (lowerQuery.includes('changed') || lowerQuery.includes('alert') || lowerQuery.includes('monitor')) {
      return {
        type: 'monitoring',
        confidence: 0.8,
        parameters: { monitoringType: 'state_change' },
        requiredTools: ['episodic_memory', 'anomaly_detection'],
        complexity: 'moderate'
      };
    }
    
    // Default to general query
    return {
      type: 'general',
      confidence: 0.5,
      parameters: {},
      requiredTools: ['data_query'],
      complexity: 'simple'
    };
  }

  private extractProcedureName(query: string): string {
    const procedures = ['triage_stuck_ros', 'record_quality_audit', 'market_health_report', 'retry_effectiveness_analysis'];
    const lowerQuery = query.toLowerCase();
    
    for (const procedure of procedures) {
      if (lowerQuery.includes(procedure.replace('_', ' '))) {
        return procedure;
      }
    }
    
    return 'triage_stuck_ros'; // Default procedure
  }

  private generateStateChangeContext(changes: StateChange[]): string {
    const summaries = changes.map(change => 
      `${change.type}: ${change.description} (severity: ${change.severity})`
    );
    
    return `Recent changes detected: ${summaries.join('; ')}`;
  }

  private enrichQueryWithContext(query: string, context: string): string {
    return `${query}\n\nContext: ${context}`;
  }

  private getAvailableTools(): string[] {
    return [
      'data_query',
      'web_search',
      'correlation_analysis',
      'anomaly_detection',
      'visualization',
      'episodic_memory',
      'procedural_memory', // TODO: Available in Task 3.3
      'semantic_memory'    // TODO: Available in Task 3.5
    ];
  }

  private async planReasoningSequence(intent: QueryIntent, _context: ReasoningContext): Promise<ReasoningStep[]> {
    const steps: ReasoningStep[] = [];
    
    // Always start with analysis
    steps.push({
      id: crypto.randomUUID(),
      type: 'analyze',
      description: `Analyze query intent: ${intent.type}`,
      toolsUsed: [],
      evidence: [],
      timestamp: new Date(),
      duration: 0,
      confidence: intent.confidence
    });
    
    // Add steps based on intent type
    switch (intent.type) {
      case 'data_analysis':
        steps.push({
          id: crypto.randomUUID(),
          type: 'query',
          description: 'Execute data query to gather relevant information',
          toolsUsed: ['data_query'],
          evidence: [],
          timestamp: new Date(),
          duration: 0,
          confidence: 0.8
        });
        break;
        
      case 'correlation':
        steps.push({
          id: crypto.randomUUID(),
          type: 'query',
          description: 'Query both datasets for correlation analysis',
          toolsUsed: ['data_query'],
          evidence: [],
          timestamp: new Date(),
          duration: 0,
          confidence: 0.8
        });
        
        steps.push({
          id: crypto.randomUUID(),
          type: 'correlate',
          description: 'Perform cross-dataset correlation analysis',
          toolsUsed: ['correlation_analysis'],
          evidence: [],
          timestamp: new Date(),
          duration: 0,
          confidence: 0.7
        });
        break;
        
      case 'diagnostic_procedure':
        steps.push({
          id: crypto.randomUUID(),
          type: 'query',
          description: 'Load and execute diagnostic procedure',
          toolsUsed: ['procedural_memory', 'data_query'],
          evidence: [],
          timestamp: new Date(),
          duration: 0,
          confidence: 0.9
        });
        break;
        
      case 'monitoring':
        // State changes already detected, just analyze them
        break;
    }
    
    // Always conclude with synthesis
    steps.push({
      id: crypto.randomUUID(),
      type: 'conclude',
      description: 'Synthesize findings and generate response',
      toolsUsed: [],
      evidence: [],
      timestamp: new Date(),
      duration: 0,
      confidence: 0.8
    });
    
    return steps;
  }

  // Placeholder step execution methods (to be implemented with actual tools)
  
  private async executeAnalysisStep(_step: ReasoningStep): Promise<Evidence[]> {
    // TODO: Implement actual analysis logic
    return [{
      id: crypto.randomUUID(),
      content: `Analysis completed for step: ${_step.description}`,
      sources: [],
      confidence: 0.8,
      timestamp: new Date(),
      type: 'pattern'
    }];
  }

  private async executeQueryStep(_step: ReasoningStep): Promise<Evidence[]> {
    // TODO: Implement actual data query execution in Task 6.1
    return [{
      id: crypto.randomUUID(),
      content: `Query executed for step: ${_step.description}`,
      sources: [],
      confidence: 0.7,
      timestamp: new Date(),
      type: 'data_point'
    }];
  }

  private async executeSearchStep(_step: ReasoningStep): Promise<Evidence[]> {
    // TODO: Implement web search in Task 6.3
    return [{
      id: crypto.randomUUID(),
      content: `Search completed for step: ${_step.description}`,
      sources: [],
      confidence: 0.6,
      timestamp: new Date(),
      type: 'pattern'
    }];
  }

  private async executeCorrelationStep(_step: ReasoningStep): Promise<Evidence[]> {
    // TODO: Implement correlation analysis in Task 6.2
    return [{
      id: crypto.randomUUID(),
      content: `Correlation analysis completed for step: ${_step.description}`,
      sources: [],
      confidence: 0.8,
      timestamp: new Date(),
      type: 'correlation'
    }];
  }

  private async executeConclusionStep(_step: ReasoningStep): Promise<Evidence[]> {
    // For conclusion step, we need to access the current evidence from the reasoning context
    // Since we don't have it as a parameter anymore, we'll create a simple conclusion
    return [{
      id: crypto.randomUUID(),
      content: `Conclusion synthesized from available evidence`,
      sources: [],
      confidence: 0.8,
      timestamp: new Date(),
      type: 'pattern'
    }];
  }

  private calculateStepConfidence(evidence: Evidence[], step: ReasoningStep): number {
    if (evidence.length === 0) {
      return 0;
    }
    
    const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    return Math.min(avgConfidence, step.confidence);
  }

  private async generateClarificationSteps(step: ReasoningStep, evidence: Evidence[]): Promise<ReasoningStep[]> {
    // Generate additional steps when confidence is low
    if (evidence.length === 0) {
      return [{
        id: crypto.randomUUID(),
        type: 'search',
        description: `Search for additional context for: ${step.description}`,
        toolsUsed: ['web_search'],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.6
      }];
    }
    
    return [];
  }

  private async synthesizeResponse(evidence: Evidence[], _query: string, context: ReasoningContext): Promise<string> {
    // TODO: Use Gemini 2.0 Flash for response synthesis in Task 11.2
    
    if (evidence.length === 0) {
      return "I don't have sufficient evidence to provide a comprehensive answer to your query. Please try rephrasing your question or providing more specific details.";
    }
    
    const evidenceSummary = evidence.map(e => e.content).join(' ');
    const confidenceLevel = this.calculateOverallConfidence(evidence);
    
    let response = `Based on my analysis of the available data, here's what I found:\n\n${evidenceSummary}`;
    
    if (context.stateChanges.length > 0) {
      const changesSummary = context.stateChanges.map(c => c.description).join('; ');
      response += `\n\nRecent changes detected: ${changesSummary}`;
    }
    
    response += `\n\nConfidence level: ${Math.round(confidenceLevel * 100)}%`;
    
    return response;
  }

  private calculateOverallConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }
    
    // Weighted average with more weight on higher confidence evidence
    const weightedSum = evidence.reduce((sum, e) => sum + (e.confidence * e.confidence), 0);
    const weightSum = evidence.reduce((sum, e) => sum + e.confidence, 0);
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  private extractSources(evidence: Evidence[]): Source[] {
    const sources: Source[] = [];
    const seenSources = new Set<string>();
    
    for (const e of evidence) {
      for (const source of e.sources) {
        if (!seenSources.has(source.id)) {
          sources.push(source);
          seenSources.add(source.id);
        }
      }
    }
    
    return sources;
  }

  private async detectNewFlags(_response: string, evidence: Evidence[], context: ReasoningContext): Promise<Flag[]> {
    const flags: Flag[] = [];
    
    // Detect low confidence flag
    const overallConfidence = this.calculateOverallConfidence(evidence);
    if (overallConfidence < this.config.confidenceThreshold) {
      flags.push({
        id: crypto.randomUUID(),
        type: 'warning',
        category: 'performance',
        message: `Low confidence response (${Math.round(overallConfidence * 100)}%)`,
        severity: 3,
        timestamp: new Date(),
        resolved: false,
        source: 'agent_core'
      });
    }
    
    // Detect state change flags
    for (const change of context.stateChanges) {
      if (change.severity >= 4) {
        flags.push({
          id: crypto.randomUUID(),
          type: 'alert',
          category: 'anomaly',
          message: `Critical state change detected: ${change.description}`,
          severity: change.severity,
          timestamp: new Date(),
          resolved: false,
          source: 'state_monitor'
        });
      }
    }
    
    return flags;
  }

  private extractToolsUsed(steps: ReasoningStep[]): string[] {
    const tools = new Set<string>();
    
    for (const step of steps) {
      for (const tool of step.toolsUsed) {
        tools.add(tool);
      }
    }
    
    return Array.from(tools);
  }

  private async getCurrentDataState() {
    // TODO: Implement actual data state generation
    // For now, return a placeholder
    return {
      timestamp: new Date(),
      rosterProcessingChecksum: `roster_${Date.now()}`,
      operationalMetricsChecksum: `metrics_${Date.now()}`,
      totalRecords: 0,
      lastModified: new Date(),
      keyMetrics: {}
    };
  }

  // Alert generation helper methods

  private generateAlertTitle(changes: StateChange[]): string {
    if (changes.length === 1) {
      const change = changes[0];
      return change ? `${change.type.replace('_', ' ').toUpperCase()}: ${change.description}` : 'Unknown change';
    }
    
    const types = [...new Set(changes.map(c => c.type))];
    return `Multiple Changes Detected: ${types.join(', ')}`;
  }

  private generateAlertMessage(changes: StateChange[]): string {
    const messages = changes.map(change => 
      `• ${change.description} (severity: ${change.severity})`
    );
    
    return `The following changes have been detected in your roster processing system:\n\n${messages.join('\n')}`;
  }

  private async generateAlertRecommendations(changes: StateChange[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    for (const change of changes) {
      switch (change.type) {
        case 'data_update':
          recommendations.push('Review updated data for quality and completeness');
          break;
        case 'metric_change':
          recommendations.push('Investigate root cause of metric changes');
          break;
        case 'new_anomaly':
          recommendations.push('Analyze anomaly patterns and implement corrective measures');
          break;
        case 'error_pattern':
          recommendations.push('Review error logs and update processing procedures');
          break;
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private extractAffectedSystems(changes: StateChange[]): string[] {
    const systems = new Set<string>();
    
    for (const change of changes) {
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
}