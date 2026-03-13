// Agent core interfaces

export interface RosterIQAgent {
  processQuery(query: string, sessionId: string): Promise<AgentResponse>;
  startReasoningLoop(): Promise<void>;
  executeStep(step: ReasoningStep): Promise<StepResult>;
  generateProactiveAlert(changes: StateChange[]): Promise<Alert>;
  improveWorkflow(procedureName: string, feedback: string): Promise<void>;
}

export interface AgentResponse {
  response: string;
  sources: Source[];
  confidence: number;
  reasoning: ReasoningStep[];
  flags: Flag[];
  visualizations?: Visualization[];
  executionTime: number;
  sessionId: string;
}

export interface ReasoningStep {
  id: string;
  type: 'analyze' | 'query' | 'search' | 'correlate' | 'conclude';
  description: string;
  toolsUsed: string[];
  evidence: Evidence[];
  timestamp: Date;
  duration: number;
  confidence: number;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  evidence: Evidence[];
  confidence: number;
  duration: number;
  errorMessage?: string;
  partialResults?: any;
}

export interface QueryIntent {
  type: 'data_analysis' | 'diagnostic_procedure' | 'correlation' | 'monitoring' | 'general';
  confidence: number;
  parameters: Record<string, any>;
  requiredTools: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}
export interface AgentConfig {
  maxReasoningSteps: number;
  confidenceThreshold: number;
  timeoutMs: number;
  enableProactiveMonitoring: boolean;
  memoryRetentionDays: number;
  maxConcurrentQueries: number;
}

export interface ReasoningContext {
  sessionId: string;
  userId: string;
  query: string;
  intent: QueryIntent;
  sessionHistory: EpisodicEntry[];
  stateChanges: StateChange[];
  availableTools: string[];
  constraints: Record<string, any>;
}

// Import types from other modules
import { StateChange, Alert, Source, Evidence, Flag } from './domain';
import { EpisodicEntry } from './memory';
import { Visualization } from './tools';