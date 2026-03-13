'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BarChart3, X, Download, Share2, CheckCircle, Loader2 } from 'lucide-react';
import { AnalysisResult, ReasoningStep, Evidence } from './ThreePanelLayout';
import ReactMarkdown from 'react-markdown';

interface ResultsDisplayPanelProps {
  result: AnalysisResult | null;
  isStreaming: boolean;
  streamingSteps: ReasoningStep[];
  onCancel: () => void;
  onEvidenceSelect: (evidence: Evidence) => void;
}

export function ResultsDisplayPanel({
  result,
  isStreaming,
  streamingSteps,
  onCancel,
  onEvidenceSelect
}: ResultsDisplayPanelProps) {
  const handleExport = () => {
    if (!result) return;
    
    const exportData = {
      timestamp: result.timestamp,
      response: result.response,
      confidence: result.confidence,
      sources: result.sources,
      reasoning: result.reasoning
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rosteriq-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!result) return;
    
    const shareText = `RosterIQ Analysis (Confidence: ${(result.confidence * 100).toFixed(1)}%)\n\n${result.response}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RosterIQ Analysis',
          text: shareText
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      alert('Analysis copied to clipboard!');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>Analysis Results</CardTitle>
          </div>
          
          {result && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Real-time streaming analysis and insights
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-y-auto space-y-4">
        {/* Streaming Progress */}
        {isStreaming && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Processing query...</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Streaming Steps */}
            <div className="space-y-2">
              {streamingSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="p-3 rounded-md bg-muted/50 border border-border"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {step.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{step.description}</p>
                      {step.toolsUsed.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {step.toolsUsed.map((tool, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Result */}
        {result && !isStreaming && (
          <div className="space-y-4">
            {/* Confidence Score */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm font-medium">Confidence Score</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      result.confidence >= 0.8
                        ? 'bg-green-500'
                        : result.confidence >= 0.6
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold">
                  {(result.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Flags */}
            {result.flags && result.flags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Alerts & Flags</h4>
                <div className="space-y-2">
                  {result.flags.map((flag) => (
                    <div
                      key={flag.id}
                      className={`p-3 rounded-md border ${
                        flag.type === 'alert'
                          ? 'bg-red-50 border-red-200'
                          : flag.type === 'warning'
                          ? 'bg-yellow-50 border-yellow-200'
                          : flag.type === 'success'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs">
                          {flag.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Severity {flag.severity}
                        </Badge>
                      </div>
                      <p className="text-sm mt-2">{flag.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Response Content */}
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{result.response}</ReactMarkdown>
            </div>

            {/* Visualizations */}
            {result.visualizations && result.visualizations.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Visualizations</h4>
                  {result.visualizations.map((viz) => (
                    <div
                      key={viz.id}
                      className="p-4 rounded-md border bg-card"
                    >
                      <Badge variant="outline" className="mb-2">
                        {viz.type}
                      </Badge>
                      {/* Visualization rendering will be implemented with recharts */}
                      <div className="h-64 flex items-center justify-center bg-muted/30 rounded">
                        <span className="text-sm text-muted-foreground">
                          {viz.type} chart ({viz.data.length} data points)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Reasoning Steps */}
            {result.reasoning && result.reasoning.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Reasoning Process</h4>
                  <div className="space-y-2">
                    {result.reasoning.map((step, index) => (
                      <div
                        key={step.id}
                        className="p-3 rounded-md bg-muted/30 border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-muted-foreground">
                            Step {index + 1}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {step.type}
                          </Badge>
                        </div>
                        <p className="text-sm">{step.description}</p>
                        {step.evidence.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {step.evidence.map((evidence) => (
                              <button
                                key={evidence.id}
                                className="text-xs text-blue-600 hover:underline block"
                                onClick={() => onEvidenceSelect(evidence)}
                              >
                                View evidence ({evidence.source.type})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !isStreaming && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Submit a query to see analysis results</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
