'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Database, Search, BarChart3, AlertTriangle } from 'lucide-react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmitQuery = async () => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    // TODO: Implement actual query submission to API
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">RosterIQ AI Agent</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Autonomous healthcare roster analytics with intelligent memory
        </p>
      </div>

      {/* Three-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        
        {/* Query Input Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Query Input
            </CardTitle>
            <CardDescription>
              Ask questions about your roster processing operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="What changed in our roster processing since my last session?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[120px]"
            />
            <Button 
              onClick={handleSubmitQuery}
              disabled={isProcessing || !query.trim()}
              className="w-full"
            >
              {isProcessing ? 'Processing...' : 'Analyze'}
            </Button>
            
            <Separator />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" size="sm" className="justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  triage_stuck_ros
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  market_health_report
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  record_quality_audit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Display Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Real-time streaming analysis and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Submit a query to see analysis results</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Details & Sources
            </CardTitle>
            <CardDescription>
              Evidence, sources, and drill-down information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Session Status</h4>
                <div className="flex gap-2">
                  <Badge variant="secondary">Session Active</Badge>
                  <Badge variant="outline">0 Queries</Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium mb-2">System Health</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">DuckDB</span>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">SQLite</span>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Redis</span>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}