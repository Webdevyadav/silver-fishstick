// Memory system interfaces

export interface EpisodicEntry {
  sessionId: string;
  timestamp: Date;
  query: string;
  response: string;
  flags: Flag[];
  dataState: DataStateSnapshot;
  toolsUsed: string[];
  confidence: number;
  reasoning: ReasoningStep[];
}

export interface EpisodicMemory {
  entries: EpisodicEntry[];
  sessionIndex: Map<string, EpisodicEntry[]>;
  flagIndex: Map<string, Flag[]>;
  stateChangeLog: StateChange[];
}

export interface DiagnosticProcedure {
  name: string;
  version: string;
  description: string;
  steps: ProcedureStep[];
  parameters: Parameter[];
  expectedOutputs: OutputSpec[];
  lastModified: Date;
  author: string;
}

export interface ProcedureStep {
  id: string;
  name: string;
  description: string;
  type: 'query' | 'analysis' | 'correlation' | 'validation';
  preconditions: string[];
  postconditions: string[];
  parameters: Record<string, any>;
  expectedDuration: number;
}

export interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: ValidationRule[];
}

export interface OutputSpec {
  name: string;
  type: string;
  description: string;
  format: 'json' | 'csv' | 'chart' | 'text';
}
export interface ProceduralMemory {
  procedures: Map<string, DiagnosticProcedure>;
  versions: Map<string, ProcedureVersion[]>;
  executionHistory: ProcedureExecution[];
  improvementLog: ProcedureImprovement[];
}

export interface ProcedureVersion {
  version: string;
  procedure: DiagnosticProcedure;
  timestamp: Date;
  changes: string;
  author: string;
}

export interface ProcedureExecution {
  id: string;
  procedureName: string;
  version: string;
  parameters: Record<string, any>;
  startTime: Date;
  endTime: Date;
  result: DiagnosticResult;
  success: boolean;
  errorMessage?: string;
}

export interface ProcedureImprovement {
  id: string;
  procedureName: string;
  feedback: string;
  changes: string;
  timestamp: Date;
  author: string;
  performanceImpact: number;
}

export interface SemanticMemory {
  knowledgeBase: KnowledgeFact[];
  embeddings: Map<string, number[]>;
  conceptGraph: ConceptNode[];
  domainOntology: OntologyEntry[];
}

export interface KnowledgeFact {
  id: string;
  content: string;
  category: 'regulatory' | 'operational' | 'technical' | 'business';
  confidence: number;
  sources: Source[];
  lastUpdated: Date;
  embedding: number[];
  tags: string[];
}
export interface ConceptNode {
  id: string;
  name: string;
  type: string;
  description: string;
  relationships: ConceptRelationship[];
  embedding: number[];
}

export interface ConceptRelationship {
  targetId: string;
  type: 'is_a' | 'part_of' | 'related_to' | 'causes' | 'prevents';
  strength: number;
  bidirectional: boolean;
}

export interface OntologyEntry {
  id: string;
  term: string;
  definition: string;
  category: string;
  synonyms: string[];
  relatedTerms: string[];
  source: string;
}

// Import types from domain
import { Flag, DataStateSnapshot, StateChange, Source } from './domain';
import { ReasoningStep } from './agent';
import { DiagnosticResult } from './tools';
import { ValidationRule } from './validation';