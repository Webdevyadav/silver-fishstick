/**
 * WebSocket Integration Example
 * 
 * This example demonstrates how to use WebSocket for:
 * 1. Bidirectional communication with clients
 * 2. Real-time progress monitoring and cancellation
 * 3. Proactive alert delivery
 * 4. Collaboration features (cursor/selection sharing)
 */

import { WebSocketService } from '@/services/WebSocketService';
import { v4 as uuidv4 } from 'uuid';

// Get WebSocket service instance
const wsService = WebSocketService.getInstance();

/**
 * Example 1: Send proactive alert when anomaly is detected
 */
export function sendAnomalyAlert(sessionId: string) {
  const alert = {
    id: uuidv4(),
    type: 'anomaly' as const,
    severity: 4 as const,
    title: 'High Error Rate Detected',
    message: 'Error rate in Northeast market has exceeded 15% threshold',
    recommendations: [
      'Review recent roster submissions for data quality issues',
      'Check processing pipeline for system errors',
      'Contact providers with high rejection rates'
    ],
    impact: 'Estimated 250 provider records affected, potential 2-day processing delay',
    timestamp: new Date(),
    sessionId,
    acknowledged: false
  };

  wsService.sendAlert(sessionId, alert);
  console.log(`Alert sent to session ${sessionId}:`, alert.id);
}

/**
 * Example 2: Track long-running operation with progress updates
 */
export async function runLongAnalysisWithProgress(sessionId: string) {
  const operationId = uuidv4();
  const totalSteps = 5;

  try {
    // Step 1: Initialize
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 0,
      currentStep: 'Initializing analysis',
      totalSteps,
      completedSteps: 0,
      estimatedTimeRemaining: 30000,
      message: 'Loading data and preparing analysis'
    });

    await simulateWork(5000);

    // Step 2: Data loading
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 20,
      currentStep: 'Loading roster data',
      totalSteps,
      completedSteps: 1,
      estimatedTimeRemaining: 24000,
      message: 'Querying roster processing details'
    });

    await simulateWork(6000);

    // Step 3: Cross-dataset correlation
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 40,
      currentStep: 'Correlating datasets',
      totalSteps,
      completedSteps: 2,
      estimatedTimeRemaining: 18000,
      message: 'Analyzing cross-dataset patterns'
    });

    await simulateWork(7000);

    // Step 4: Statistical analysis
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 60,
      currentStep: 'Running statistical analysis',
      totalSteps,
      completedSteps: 3,
      estimatedTimeRemaining: 12000,
      message: 'Calculating correlation coefficients'
    });

    await simulateWork(6000);

    // Step 5: Generating insights
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 80,
      currentStep: 'Generating insights',
      totalSteps,
      completedSteps: 4,
      estimatedTimeRemaining: 6000,
      message: 'Synthesizing findings and recommendations'
    });

    await simulateWork(6000);

    // Complete
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'completed',
      progress: 100,
      currentStep: 'Analysis complete',
      totalSteps,
      completedSteps: 5,
      estimatedTimeRemaining: 0,
      message: 'Analysis completed successfully'
    });

    console.log(`Operation ${operationId} completed successfully`);
  } catch (error) {
    // Handle cancellation or error
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'failed',
      progress: 0,
      message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    console.error(`Operation ${operationId} failed:`, error);
  }
}

/**
 * Example 3: Handle operation cancellation
 */
export function setupCancellationHandler() {
  const io = wsService['connectionManager'].getIO();
  if (!io) return;

  io.on('operation:cancelled', async (data: { operationId: string; sessionId: string; userId: string }) => {
    console.log(`Operation ${data.operationId} cancelled by user ${data.userId}`);

    // Implement cancellation logic here
    // For example, set a flag that the operation checks periodically
    // or use AbortController for async operations

    // Send confirmation
    wsService.sendProgress(data.sessionId, data.operationId, {
      operationId: data.operationId,
      status: 'cancelled',
      progress: 0,
      message: 'Operation cancelled by user'
    });
  });
}

/**
 * Example 4: Real-time collaboration - broadcast cursor updates
 */
export function broadcastCursorPosition(
  sessionId: string,
  userId: string,
  position: { line: number; column: number },
  selection: { start: { line: number; column: number }; end: { line: number; column: number } }
) {
  wsService.broadcastCollaboration({
    userId,
    sessionId,
    type: 'cursor',
    data: { position, selection },
    timestamp: new Date()
  });
}

/**
 * Example 5: Send multiple alerts based on diagnostic findings
 */
export function sendDiagnosticAlerts(sessionId: string, findings: any[]) {
  findings.forEach((finding, index) => {
    const alert = {
      id: uuidv4(),
      type: determineSeverityType(finding.severity),
      severity: finding.severity,
      title: finding.title,
      message: finding.description,
      recommendations: finding.recommendations || [],
      impact: finding.impact,
      timestamp: new Date(),
      sessionId,
      acknowledged: false
    };

    // Stagger alerts slightly to avoid overwhelming the client
    setTimeout(() => {
      wsService.sendAlert(sessionId, alert);
    }, index * 100);
  });
}

/**
 * Example 6: Monitor and report on active operations
 */
export function getOperationStatus(operationId: string) {
  const operations = wsService.getActiveOperations();
  return operations.find(op => op.operationId === operationId);
}

/**
 * Example 7: Check if session has active WebSocket connections
 */
export function canSendRealtimeUpdates(sessionId: string): boolean {
  return wsService.hasActiveConnections(sessionId);
}

/**
 * Example 8: Send state change notification
 */
export function notifyStateChange(sessionId: string, changes: any[]) {
  const alert = {
    id: uuidv4(),
    type: 'info' as const,
    severity: 2 as const,
    title: 'Data Changes Detected',
    message: `${changes.length} changes detected since your last session`,
    recommendations: [
      'Review the changes in the detail panel',
      'Run diagnostic procedures to assess impact'
    ],
    impact: `${changes.length} datasets updated`,
    timestamp: new Date(),
    sessionId,
    acknowledged: false
  };

  wsService.sendAlert(sessionId, alert);
}

// Helper functions

function simulateWork(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function determineSeverityType(severity: number): 'anomaly' | 'error' | 'warning' | 'info' {
  if (severity >= 4) return 'anomaly';
  if (severity === 3) return 'error';
  if (severity === 2) return 'warning';
  return 'info';
}

/**
 * Example 9: Complete integration with query processing
 */
export async function processQueryWithWebSocket(
  sessionId: string,
  query: string,
  userId: string
) {
  const operationId = uuidv4();

  // Check if WebSocket is available
  if (!wsService.hasActiveConnections(sessionId)) {
    console.log('No active WebSocket connections, falling back to SSE');
    return;
  }

  try {
    // Send initial progress
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 0,
      currentStep: 'Analyzing query',
      message: `Processing: "${query}"`
    });

    // Simulate query processing steps
    await simulateWork(2000);

    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'running',
      progress: 50,
      currentStep: 'Executing analysis',
      message: 'Running data queries and correlations'
    });

    await simulateWork(3000);

    // Check for anomalies and send alerts if needed
    const anomalyDetected = Math.random() > 0.7;
    if (anomalyDetected) {
      sendAnomalyAlert(sessionId);
    }

    // Complete
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'completed',
      progress: 100,
      currentStep: 'Complete',
      message: 'Query processed successfully'
    });

    // Send result via WebSocket
    wsService.streamResult(sessionId, {
      query,
      response: 'Analysis complete with findings',
      confidence: 0.85,
      timestamp: new Date()
    });

    wsService.streamComplete(sessionId, {
      operationId,
      executionTime: 5000
    });
  } catch (error) {
    wsService.streamError(sessionId, error as Error);
    wsService.sendProgress(sessionId, operationId, {
      operationId,
      status: 'failed',
      progress: 0,
      message: 'Query processing failed'
    });
  }
}
