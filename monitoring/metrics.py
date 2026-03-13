"""
Performance metrics and monitoring
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List
import time
import json
from pathlib import Path

@dataclass
class QueryMetrics:
    """Metrics for a single query"""
    query_id: str
    query: str
    start_time: float
    end_time: float = 0
    duration: float = 0
    iterations: int = 0
    agents_used: List[str] = field(default_factory=list)
    tools_used: List[str] = field(default_factory=list)
    success: bool = False
    error: str = None

class MetricsCollector:
    """Collect and analyze system metrics"""
    
    def __init__(self, metrics_dir: str = "logs/metrics"):
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
        
        self.active_queries: Dict[str, QueryMetrics] = {}
        self.completed_queries: List[QueryMetrics] = []
    
    def start_query(self, query_id: str, query: str) -> QueryMetrics:
        """Start tracking a query"""
        metrics = QueryMetrics(
            query_id=query_id,
            query=query,
            start_time=time.time()
        )
        self.active_queries[query_id] = metrics
        return metrics
    
    def end_query(self, query_id: str, success: bool = True, error: str = None):
        """End tracking a query"""
        if query_id not in self.active_queries:
            return
        
        metrics = self.active_queries[query_id]
        metrics.end_time = time.time()
        metrics.duration = metrics.end_time - metrics.start_time
        metrics.success = success
        metrics.error = error
        
        self.completed_queries.append(metrics)
        del self.active_queries[query_id]
        
        self._save_metrics(metrics)
    
    def record_agent_usage(self, query_id: str, agent: str):
        """Record agent usage"""
        if query_id in self.active_queries:
            self.active_queries[query_id].agents_used.append(agent)
    
    def record_tool_usage(self, query_id: str, tool: str):
        """Record tool usage"""
        if query_id in self.active_queries:
            self.active_queries[query_id].tools_used.append(tool)
    
    def record_iteration(self, query_id: str):
        """Record iteration count"""
        if query_id in self.active_queries:
            self.active_queries[query_id].iterations += 1
    
    def get_summary(self) -> Dict:
        """Get metrics summary"""
        if not self.completed_queries:
            return {"message": "No queries completed yet"}
        
        total = len(self.completed_queries)
        successful = sum(1 for q in self.completed_queries if q.success)
        avg_duration = sum(q.duration for q in self.completed_queries) / total
        avg_iterations = sum(q.iterations for q in self.completed_queries) / total
        
        return {
            "total_queries": total,
            "successful": successful,
            "success_rate": successful / total,
            "avg_duration_seconds": avg_duration,
            "avg_iterations": avg_iterations,
            "most_used_agents": self._count_usage([q.agents_used for q in self.completed_queries]),
            "most_used_tools": self._count_usage([q.tools_used for q in self.completed_queries])
        }
    
    def _count_usage(self, usage_lists: List[List[str]]) -> Dict[str, int]:
        """Count usage frequency"""
        counts = {}
        for usage_list in usage_lists:
            for item in usage_list:
                counts[item] = counts.get(item, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))
    
    def _save_metrics(self, metrics: QueryMetrics):
        """Save metrics to file"""
        filename = self.metrics_dir / f"metrics_{datetime.now().strftime('%Y%m%d')}.jsonl"
        
        with open(filename, 'a') as f:
            f.write(json.dumps({
                "query_id": metrics.query_id,
                "query": metrics.query,
                "duration": metrics.duration,
                "iterations": metrics.iterations,
                "agents_used": metrics.agents_used,
                "tools_used": metrics.tools_used,
                "success": metrics.success,
                "error": metrics.error,
                "timestamp": datetime.now().isoformat()
            }) + "\n")

# Global metrics collector
metrics_collector = MetricsCollector()
