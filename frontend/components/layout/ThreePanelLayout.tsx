'use client';

import { useState, useEffect } from 'react';
import { QueryInputPanel } from './QueryInputPanel';
import { ResultsDisplayPanel } from './ResultsDisplayPanel';
import { DetailPanel } from './DetailPanel';
import { useSSE } from '@/lib/useSSE';

export interface AnalysisResult {
  id: string;
  response: string;
  sources: Source[];
  confidence: number;
  reasoning: ReasoningStep[];
  flags: Flag[];
  visualizations?: Visualization[];
  timestamp: Date;
}

export interface Source {
  id: string;
  type: 'roster_processing' | 'operational_metrics' | 'web_search' | 'memory';
  reference: string;
  timestamp?: Date;
}

export interface ReasoningStep {
  id: string;
  type: 'analyze' | 'query' | 'search' | 'correlate' | 'conclude';
  description: string;
  toolsUsed: string[];
  evidence: Evidence[];
  timestamp: Date;
}

export interface Evidence {
  id: string;
  content: string;
  source: Source;
  confidence: number;
}

export interface Flag {
  id: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  category: 'data_quality' | 'performance' | 'anomaly' | 'regulatory';
  message: string;
  severity: 1 | 2 | 3 | 4 | 5;
  timestamp: Date;
  resolved: boolean;
}

export interface Visualization {
  id: string;
  type: 'trend' | 'correlation' | 'distribution' | 'heatmap' | 'sankey' | 'scatter' | 'bar' | 'timeline';
  data: any[];
  config: any;
  sources: Source[];
}

export function ThreePanelLayout() {
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSteps, setStreamingSteps] = useState<ReasoningStep[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [sseUrl, setSSEUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Initialize session
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  const handleQuerySubmit = async (query: string) => {
    if (!sessionId) {
      console.error('No session ID available');
      return;
    }

    setIsStreaming(true);
    setStreamingSteps([]);
    setCurrentResult(null);
    
    try {
      // Start SSE stream for real-time updates
      const streamUrl = `/api/query/stream?sessionId=${sessionId}&query=${encodeURIComponent(query)}`;
      setSSEUrl(streamUrl);
      
      // Also submit the query via POST
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sessionId })
      });
      
      if (!response.ok) {
        throw new Error('Query submission failed');
      }
    } catch (error) {
      console.error('Failed to submit query:', error);
      setIsStreaming(false);
      setSSEUrl(null);
    }
  };

  const handleCancelQuery = () => {
    setIsStreaming(false);
    setStreamingSteps([]);
    setSSEUrl(null);
  };

  // Handle SSE messages
  const handleSSEMessage = (message: any) => {
    switch (message.type) {
      case 'step':
        setStreamingSteps(prev => [...prev, message.data]);
        break;
      case 'result':
        setCurrentResult(message.data);
        setIsStreaming(false);
        setSSEUrl(null);
        break;
      case 'error':
        console.error('Query error:', message.data);
        setIsStreaming(false);
        setSSEUrl(null);
        break;
      case 'complete':
        setIsStreaming(false);
        setSSEUrl(null);
        break;
    }
  };

  // Use SSE hook for real-time streaming
  useSSE(sseUrl, handleSSEMessage);

  return (
    <div className="h-screen flex flex-col">
      {/* Three-panel responsive layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Query Input Panel - Left */}
        <div className="lg:col-span-3 flex flex-col overflow-hidden">
          <QueryInputPanel 
            onQuerySubmit={handleQuerySubmit}
            isProcessing={isStreaming}
          />
        </div>

        {/* Results Display Panel - Center */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden">
          <ResultsDisplayPanel
            result={currentResult}
            isStreaming={isStreaming}
            streamingSteps={streamingSteps}
            onCancel={handleCancelQuery}
            onEvidenceSelect={setSelectedEvidence}
          />
        </div>

        {/* Detail Panel - Right */}
        <div className="lg:col-span-4 flex flex-col overflow-hidden">
          <DetailPanel
            result={currentResult}
            selectedEvidence={selectedEvidence}
          />
        </div>
      </div>
    </div>
  );
}
