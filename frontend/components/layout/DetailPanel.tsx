'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Database, ExternalLink, ChevronRight, Info, HelpCircle } from 'lucide-react';
import { AnalysisResult, Evidence, Source } from './ThreePanelLayout';

interface DetailPanelProps {
  result: AnalysisResult | null;
  selectedEvidence: Evidence | null;
}

interface SessionInfo {
  sessionId: string;
  queryCount: number;
  startTime: Date;
  lastActivity: Date;
}

interface SystemHealth {
  duckdb: 'healthy' | 'degraded' | 'down';
  sqlite: 'healthy' | 'degraded' | 'down';
  redis: 'healthy' | 'degraded' | 'down';
  gemini: 'healthy' | 'degraded' | 'down';
}

export function DetailPanel({ result, selectedEvidence }: DetailPanelProps) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    duckdb: 'healthy',
    sqlite: 'healthy',
    redis: 'healthy',
    gemini: 'healthy'
  });
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // Fetch session info and system health
  useEffect(() => {
    fetchSessionInfo();
    fetchSystemHealth();
    
    const interval = setInterval(fetchSystemHealth, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchSessionInfo = async () => {
    try {
      const response = await fetch('/api/session/current');
      if (response.ok) {
        const data = await response.json();
        setSessionInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch session info:', error);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/health/status');
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  const toggleSourceExpansion = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'down':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSourceIcon = (type: Source['type']) => {
    return <Database className="h-4 w-4" />;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Details & Sources
        </CardTitle>
        <CardDescription>
          Evidence, sources, and contextual information
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Selected Evidence Detail */}
        {selectedEvidence && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Selected Evidence</h4>
                <Badge variant="outline">
                  Confidence: {(selectedEvidence.confidence * 100).toFixed(1)}%
                </Badge>
              </div>
              
              <div className="p-3 rounded-md bg-muted/50 border">
                <p className="text-sm">{selectedEvidence.content}</p>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground">Source</h5>
                <div className="flex items-center gap-2 p-2 rounded-md bg-card border">
                  {getSourceIcon(selectedEvidence.source.type)}
                  <div className="flex-1">
                    <div className="text-xs font-medium">
                      {selectedEvidence.source.type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedEvidence.source.reference}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Source Attribution */}
        {result && result.sources && result.sources.length > 0 && (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Source Attribution</h4>
              <div className="space-y-2">
                {result.sources.map((source) => (
                  <div key={source.id} className="border rounded-md overflow-hidden">
                    <button
                      className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors"
                      onClick={() => toggleSourceExpansion(source.id)}
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          expandedSources.has(source.id) ? 'rotate-90' : ''
                        }`}
                      />
                      {getSourceIcon(source.type)}
                      <div className="flex-1 text-left">
                        <div className="text-xs font-medium">{source.type}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {source.reference}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {source.type}
                      </Badge>
                    </button>
                    
                    {expandedSources.has(source.id) && (
                      <div className="p-3 bg-muted/30 border-t text-xs space-y-2">
                        <div>
                          <span className="font-medium">Reference: </span>
                          <span className="text-muted-foreground">{source.reference}</span>
                        </div>
                        {source.timestamp && (
                          <div>
                            <span className="font-medium">Timestamp: </span>
                            <span className="text-muted-foreground">
                              {new Date(source.timestamp).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          <ExternalLink className="h-3 w-3 mr-2" />
                          View Source Data
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Confidence Score Explanation */}
        {result && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Confidence Explanation</h4>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="p-3 rounded-md bg-muted/30 text-xs space-y-2">
                <p>
                  The confidence score ({(result.confidence * 100).toFixed(1)}%) is calculated based on:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Quality and quantity of evidence ({result.reasoning.length} steps)</li>
                  <li>Source reliability ({result.sources.length} sources)</li>
                  <li>Data completeness and consistency</li>
                  <li>Statistical significance of findings</li>
                </ul>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Session Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Session Status</h4>
          {sessionInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Session ID</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {sessionInfo.sessionId.slice(0, 8)}...
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Queries</span>
                <Badge variant="secondary">{sessionInfo.queryCount}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Started</span>
                <span>{new Date(sessionInfo.startTime).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Last Activity</span>
                <span>{new Date(sessionInfo.lastActivity).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Badge variant="secondary">Session Active</Badge>
              <Badge variant="outline">0 Queries</Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* System Health */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">System Health</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">DuckDB</span>
              <Badge variant={getHealthBadgeVariant(systemHealth.duckdb)}>
                {systemHealth.duckdb}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">SQLite</span>
              <Badge variant={getHealthBadgeVariant(systemHealth.sqlite)}>
                {systemHealth.sqlite}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Redis</span>
              <Badge variant={getHealthBadgeVariant(systemHealth.redis)}>
                {systemHealth.redis}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Gemini API</span>
              <Badge variant={getHealthBadgeVariant(systemHealth.gemini)}>
                {systemHealth.gemini}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Contextual Help */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <h4 className="text-sm font-medium">Help & Documentation</h4>
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <HelpCircle className="h-4 w-4 mr-2" />
              Query Syntax Guide
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Database className="h-4 w-4 mr-2" />
              Diagnostic Procedures
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Info className="h-4 w-4 mr-2" />
              Understanding Confidence Scores
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
