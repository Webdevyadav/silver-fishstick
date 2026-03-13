'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Database, BarChart3, AlertTriangle, Clock, Star } from 'lucide-react';

interface QueryInputPanelProps {
  onQuerySubmit: (query: string) => void;
  isProcessing: boolean;
}

interface QueryTemplate {
  id: string;
  name: string;
  query: string;
  icon: React.ReactNode;
  category: 'diagnostic' | 'analysis' | 'monitoring';
}

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 'triage_stuck',
    name: 'Triage Stuck Files',
    query: 'Run triage_stuck_ros diagnostic procedure',
    icon: <Database className="h-4 w-4" />,
    category: 'diagnostic'
  },
  {
    id: 'market_health',
    name: 'Market Health Report',
    query: 'Run market_health_report diagnostic procedure',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'diagnostic'
  },
  {
    id: 'quality_audit',
    name: 'Quality Audit',
    query: 'Run record_quality_audit diagnostic procedure',
    icon: <AlertTriangle className="h-4 w-4" />,
    category: 'diagnostic'
  },
  {
    id: 'what_changed',
    name: 'What Changed?',
    query: 'What changed in our roster processing since my last session?',
    icon: <Clock className="h-4 w-4" />,
    category: 'monitoring'
  }
];

export function QueryInputPanel({ onQuerySubmit, isProcessing }: QueryInputPanelProps) {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load query history and favorites from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('queryHistory');
    const savedFavorites = localStorage.getItem('queryFavorites');
    
    if (savedHistory) {
      setQueryHistory(JSON.parse(savedHistory));
    }
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const handleSubmit = () => {
    if (!query.trim() || isProcessing) return;

    // Add to history
    const newHistory = [query, ...queryHistory.filter(q => q !== query)].slice(0, 10);
    setQueryHistory(newHistory);
    localStorage.setItem('queryHistory', JSON.stringify(newHistory));

    onQuerySubmit(query);
    setQuery('');
    setShowSuggestions(false);
  };

  const handleTemplateClick = (template: QueryTemplate) => {
    setQuery(template.query);
  };

  const handleHistoryClick = (historicalQuery: string) => {
    setQuery(historicalQuery);
  };

  const toggleFavorite = (queryText: string) => {
    const newFavorites = favorites.includes(queryText)
      ? favorites.filter(f => f !== queryText)
      : [...favorites, queryText];
    
    setFavorites(newFavorites);
    localStorage.setItem('queryFavorites', JSON.stringify(newFavorites));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Query Input
        </CardTitle>
        <CardDescription>
          Ask questions about roster processing operations
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* Query Input */}
        <div className="space-y-2">
          <Textarea
            placeholder="What changed in our roster processing since my last session?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(e.target.value.length > 2);
            }}
            onKeyDown={handleKeyDown}
            className="min-h-[120px] resize-none"
            disabled={isProcessing}
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Press Cmd/Ctrl + Enter to submit</span>
            <span>{query.length} characters</span>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          disabled={isProcessing || !query.trim()}
          className="w-full"
        >
          {isProcessing ? 'Processing...' : 'Analyze'}
        </Button>

        <Separator />

        {/* Query Templates */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Diagnostic Procedures</h4>
          <div className="grid grid-cols-1 gap-2">
            {QUERY_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => handleTemplateClick(template)}
                disabled={isProcessing}
              >
                {template.icon}
                <span className="ml-2">{template.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Query History */}
        {queryHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Queries</h4>
              <div className="space-y-1">
                {queryHistory.slice(0, 5).map((historicalQuery, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                    onClick={() => handleHistoryClick(historicalQuery)}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{historicalQuery}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(historicalQuery);
                      }}
                    >
                      <Star
                        className={`h-3 w-3 ${
                          favorites.includes(historicalQuery)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Favorites</h4>
              <div className="space-y-1">
                {favorites.map((favorite, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                    onClick={() => handleHistoryClick(favorite)}
                  >
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{favorite}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
