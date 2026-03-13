"""
Advanced API endpoints for monitoring and control
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, List
import sys
sys.path.append("..")

from monitoring.metrics import metrics_collector
from monitoring.logger import logger
from rag.ingestion import RAGIngestion

router = APIRouter(prefix="/api/v1", tags=["advanced"])

class IngestRequest(BaseModel):
    directory: Optional[str] = None
    files: Optional[List[str]] = None

class MetricsResponse(BaseModel):
    total_queries: int
    successful: int
    success_rate: float
    avg_duration_seconds: float
    avg_iterations: float
    most_used_agents: Dict[str, int]
    most_used_tools: Dict[str, int]

@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Get system metrics"""
    try:
        summary = metrics_collector.get_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/recent")
async def get_recent_logs(lines: int = 50):
    """Get recent log entries"""
    try:
        with open("logs/agent_system.log", "r") as f:
            all_lines = f.readlines()
            recent = all_lines[-lines:]
            return {"logs": recent}
    except FileNotFoundError:
        return {"logs": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
async def ingest_documents(request: IngestRequest, background_tasks: BackgroundTasks):
    """Ingest documents into RAG system"""
    try:
        ingestion = RAGIngestion()
        
        if request.directory:
            background_tasks.add_task(ingestion.ingest_directory, request.directory)
            return {"status": "ingestion_started", "source": request.directory}
        elif request.files:
            background_tasks.add_task(ingestion.ingest_files, request.files)
            return {"status": "ingestion_started", "files": len(request.files)}
        else:
            raise HTTPException(status_code=400, detail="Provide directory or files")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/status")
async def system_status():
    """Get system status"""
    import psutil
    
    return {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
        "active_queries": len(metrics_collector.active_queries),
        "completed_queries": len(metrics_collector.completed_queries)
    }

@router.post("/system/clear-cache")
async def clear_cache():
    """Clear system cache"""
    try:
        # Clear metrics
        metrics_collector.completed_queries.clear()
        logger.print_status("Cache cleared", "success")
        return {"status": "cache_cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
