from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import uuid
sys.path.append("..")

from graph.agent_graph import AgentOrchestrator
from monitoring.metrics import metrics_collector
from monitoring.logger import logger
from api.advanced_endpoints import router as advanced_router

app = FastAPI(
    title="AI Agent API",
    description="Multi-agent orchestration system with RAG",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include advanced endpoints
app.include_router(advanced_router)

orchestrator = AgentOrchestrator()

class QueryRequest(BaseModel):
    query: str
    context: dict = {}

class QueryResponse(BaseModel):
    query_id: str
    response: str
    plan: dict
    evaluation: dict
    iterations: int
    duration: float

@app.get("/")
def root():
    return {
        "status": "AI Agent System Running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    query_id = str(uuid.uuid4())
    
    try:
        # Start tracking
        metrics = metrics_collector.start_query(query_id, request.query)
        logger.log_query(request.query, {"query_id": query_id})
        
        # Run orchestrator
        result = orchestrator.run(request.query)
        
        # End tracking
        metrics_collector.end_query(query_id, success=True)
        
        return QueryResponse(
            query_id=query_id,
            response=result.get("response", ""),
            plan=result.get("plan", {}),
            evaluation=result.get("evaluation", {}),
            iterations=result.get("iteration", 0),
            duration=metrics.duration if hasattr(metrics, 'duration') else 0
        )
    except Exception as e:
        metrics_collector.end_query(query_id, success=False, error=str(e))
        logger.log_error(e, {"query_id": query_id})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "metrics": metrics_collector.get_summary()}
