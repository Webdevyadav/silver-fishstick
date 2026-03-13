// API request/response types and error handling interfaces

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId: string;
  executionTime: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
}

export interface QueryRequest {
  query: string;
  sessionId: string;
  userId: string;
  options?: QueryOptions;
}

export interface QueryOptions {
  streaming?: boolean;
  includeVisualization?: boolean;
  maxExecutionTime?: number;
  confidenceThreshold?: number;
  enableProactiveAlerts?: boolean;
}

export interface QueryResponse {
  response: string;
  sources: Source[];
  confidence: number;
  reasoning: ReasoningStep[];
  flags: Flag[];
  visualizations?: Visualization[];
  executionTime: number;
  sessionId: string;
  stateChanges?: StateChange[];
}

export interface DiagnosticRequest {
  procedureName: string;
  parameters: Record<string, any>;
  sessionId: string;
  userId: string;
}

export interface CorrelationRequest {
  dataset1Query: string;
  dataset2Query: string;
  correlationParams: CorrelationConfig;
  sessionId: string;
  userId: string;
}
export interface SessionRequest {
  userId: string;
  sessionId?: string;
}

export interface SessionResponse {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  queryCount: number;
  flags: Flag[];
  stateChanges: StateChange[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  services: ServiceStatus[];
  uptime: number;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  details?: Record<string, any>;
}

export interface StreamingResponse {
  type: 'step' | 'result' | 'error' | 'complete';
  data: any;
  timestamp: Date;
  sessionId: string;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

// Import types from other modules
import { Source, Flag, StateChange } from './domain';
import { ReasoningStep } from './agent';
import { Visualization, CorrelationConfig } from './tools';