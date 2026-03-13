/**
 * Example: Integrating SSE Streaming with RosterIQ Agent
 * 
 * This example demonstrates how to integrate the SSE streaming service
 * with the RosterIQ Agent's query processing workflow.
 */

import { StreamingService } from '@/services/StreamingService';
import { ReasoningStep } from '@/types/agent';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example: Process a query with real-time streaming
 */
export async function processQueryWithStreaming(
  query: string,
  sessionId: string
): Promise<void> {
  const streamingService = StreamingService.getInstance();

  try {
    // Step 1: Analyze query intent
    const step1: ReasoningStep = {
      id: uuidv4(),
      type: 'analyze',
      description: 'Analyzing query intent and extracting parameters',
      toolsUsed: [],
      evidence: [],
      timestamp: new Date(),
      duration: 0,
      confidence: 0.9
    };
    streamingService.streamStep(sessionId, step1);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Load session context
    const step2: ReasoningStep = {
      id: uuidv4(),
      type: 'query',
      description: 'Loading session history and detecting state changes',
      toolsUsed: ['MemoryManager'],
      evidence: [],
      timestamp: new Date(),
      duration: 500,
      confidence: 0.95
    };
    streamingService.streamStep(sessionId, step2);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: Execute data queries
    const step3: ReasoningStep = {
      id: uuidv4(),
      type: 'query',
      description: 'Executing analytical queries on roster processing data',
      toolsUsed: ['DataQueryTool', 'DuckDB'],
      evidence: [],
      timestamp: new Date(),
      duration: 800,
      confidence: 0.92
    };
    streamingService.streamStep(sessionId, step3);

    await new Promise(resolve => setTimeout(resolve, 800));

    // Step 4: Correlate datasets
    const step4: ReasoningStep = {
      id: uuidv4(),
      type: 'correlate',
      description: 'Correlating roster processing with operational metrics',
      toolsUsed: ['CorrelationTool'],
      evidence: [],
      timestamp: new Date(),
      duration: 600,
      confidence: 0.88
    };
    streamingService.streamStep(sessionId, step4);

    await new Promise(resolve => setTimeout(resolve, 600));

    // Step 5: Generate insights
    const step5: ReasoningStep = {
      id: uuidv4(),
      type: 'conclude',
      description: 'Synthesizing insights and generating recommendations',
      toolsUsed: ['GeminiAPI'],
      evidence: [],
      timestamp: new Date(),
      duration: 1000,
      confidence: 0.87
    };
    streamingService.streamStep(sessionId, step5);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Stream final result
    streamingService.streamResult(sessionId, {
      response: 'Analysis complete. Found 3 critical issues in roster processing.',
      confidence: 0.87,
      totalSteps: 5,
      executionTime: 3200
    });

    // Stream completion signal
    streamingService.streamComplete(sessionId, {
      completed: true,
      totalSteps: 5,
      executionTime: 3200,
      confidence: 0.87
    });

  } catch (error) {
    // Stream error if something goes wrong
    streamingService.streamError(sessionId, error as Error);
  }
}

/**
 * Example: Stream diagnostic procedure execution
 */
export async function streamDiagnosticProcedure(
  procedureName: string,
  sessionId: string,
  parameters: Record<string, any>
): Promise<void> {
  const streamingService = StreamingService.getInstance();

  try {
    // Load procedure
    streamingService.streamStep(sessionId, {
      id: uuidv4(),
      type: 'analyze',
      description: `Loading diagnostic procedure: ${procedureName}`,
      toolsUsed: ['ProceduralMemory'],
      evidence: [],
      timestamp: new Date(),
      duration: 0,
      confidence: 1.0
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Execute procedure steps
    const procedureSteps = [
      'Validating input parameters',
      'Querying roster processing data',
      'Analyzing error patterns',
      'Identifying bottlenecks',
      'Generating recommendations'
    ];

    for (let i = 0; i < procedureSteps.length; i++) {
      streamingService.streamStep(sessionId, {
        id: uuidv4(),
        type: 'query',
        description: `Step ${i + 1}/${procedureSteps.length}: ${procedureSteps[i]}`,
        toolsUsed: ['DiagnosticTool'],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.9
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Stream completion
    streamingService.streamComplete(sessionId, {
      procedure: procedureName,
      stepsCompleted: procedureSteps.length,
      findings: 'Diagnostic procedure completed successfully'
    });

  } catch (error) {
    streamingService.streamError(sessionId, error as Error);
  }
}

/**
 * Example: Stream with compression for large results
 */
export async function streamLargeDataset(
  sessionId: string,
  data: any[]
): Promise<void> {
  const streamingService = StreamingService.getInstance();

  // Stream with compression enabled
  streamingService.streamResult(sessionId, {
    dataset: data,
    recordCount: data.length,
    timestamp: new Date()
  }, {
    compress: true,
    compressionThreshold: 1024 // Compress if > 1KB
  });
}

/**
 * Example: Stream with batching for high-frequency updates
 */
export async function streamProgressUpdates(
  sessionId: string,
  totalItems: number
): Promise<void> {
  const streamingService = StreamingService.getInstance();

  for (let i = 0; i < totalItems; i++) {
    streamingService.streamStep(sessionId, {
      id: uuidv4(),
      type: 'query',
      description: `Processing item ${i + 1}/${totalItems}`,
      toolsUsed: [],
      evidence: [],
      timestamp: new Date(),
      duration: 0,
      confidence: 1.0
    }, {
      batchSize: 10,      // Batch 10 messages together
      batchDelay: 100     // Or send after 100ms
    });

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  streamingService.streamComplete(sessionId);
}
