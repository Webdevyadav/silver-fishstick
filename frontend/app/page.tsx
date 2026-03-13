'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Database, Search, BarChart3, AlertTriangle, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/analysis');
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Brain className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">RosterIQ AI Agent</h1>
        </div>
        <p className="text-muted-foreground text-xl mb-6">
          Autonomous healthcare roster analytics with intelligent memory
        </p>
        <Button size="lg" onClick={handleGetStarted}>
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Natural Language Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask questions about roster processing in plain English. No SQL or technical commands required.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Persistent Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Session continuity with episodic, procedural, and semantic memory. The system learns from your interactions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Real-Time Streaming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Watch the AI's reasoning process in real-time with Server-Sent Events streaming.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Proactive Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Automatic anomaly detection and alerts for operational issues before they become critical.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Cross-Dataset Correlation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Analyze patterns between file-level roster data and market-level operational metrics.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Source Attribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Every data point is traceable to its source with complete evidence-based analysis.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic Procedures */}
      <Card>
        <CardHeader>
          <CardTitle>Named Diagnostic Procedures</CardTitle>
          <CardDescription>
            Pre-built analytical workflows for common operational investigations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">triage_stuck_ros</h4>
              <p className="text-sm text-muted-foreground">
                Analyze roster files stuck in processing stages and identify bottlenecks
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">record_quality_audit</h4>
              <p className="text-sm text-muted-foreground">
                Examine data quality patterns and validation failures across roster submissions
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">market_health_report</h4>
              <p className="text-sm text-muted-foreground">
                Generate comprehensive market-level operational health assessments
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">retry_effectiveness_analysis</h4>
              <p className="text-sm text-muted-foreground">
                Evaluate success rates and patterns of retry operations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}