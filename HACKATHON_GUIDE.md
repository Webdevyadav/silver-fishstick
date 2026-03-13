# Hackathon Quick Start Guide

## Pre-Event Checklist

- [ ] Install Python 3.10+
- [ ] Run `bash scripts/setup.sh` or `make install`
- [ ] Get OpenAI API key (required)
- [ ] Get Tavily API key (optional, for better search)
- [ ] Test system: `python scripts/test_system.py`
- [ ] Run tests: `make test` or `pytest tests/ -v`
- [ ] Review agent architecture
- [ ] Try CLI: `python cli/agent_cli.py query "test query"`

## When Dataset Arrives

### 1. Ingest Data (5 minutes)
```python
from rag.ingestion import RAGIngestion

ingestion = RAGIngestion()
ingestion.ingest_directory("./data")
```

### 2. Add Custom Tools (10 minutes)
Edit `tools/dataset_tools.py`:
```python
@staticmethod
def custom_analysis(df):
    # Your domain-specific logic
    return results
```

### 3. Update Prompts (5 minutes)
Edit `prompts/planner_prompt.md` with domain context

### 4. Test End-to-End (5 minutes)
```bash
cd api && uvicorn main:app --reload
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Your test query"}'
```

## Architecture Overview

```
Query → Planner → Research → RAG → Execute → Evaluate
         ↓                                      ↓
      [Retry Loop if unsatisfactory] ←---------┘
```

## Key Files to Customize

1. `tools/dataset_tools.py` - Dataset-specific analysis
2. `prompts/planner_prompt.md` - Task planning instructions
3. `agents/executor.py` - Add new tool integrations
4. `rag/ingestion.py` - Document processing

## Common Patterns

### Pattern 1: Data Analysis
```python
orchestrator.run("Analyze dataset and find top insights")
```

### Pattern 2: Research + Analysis
```python
orchestrator.run("Research topic X and apply to our data")
```

### Pattern 3: Multi-Step Workflow
```python
orchestrator.run("Load data, clean it, analyze patterns, generate report")
```

## Debugging Tips

- Check logs in `logs/`
- Test agents individually before orchestration
- Use `scripts/test_system.py` for quick validation
- Monitor API at `http://localhost:8000/docs`

## Presentation Tips

1. Show the decision loop (retry mechanism)
2. Demonstrate multi-agent collaboration
3. Highlight RAG integration
4. Show tool execution transparency
5. Emphasize modularity

## Time Allocation

- Setup: 15 min
- Data ingestion: 15 min
- Custom tools: 30 min
- Testing: 20 min
- Frontend (optional): 40 min
- Presentation prep: 20 min

Total: 2h 20min (leaves buffer for debugging)

## Optional Enhancements (If Time Permits)

### 1. Advanced Agent Frameworks
```python
# Use CrewAI for sophisticated coordination
from agents.crewai_integration import CrewAIOrchestrator
crew = CrewAIOrchestrator()
result = crew.run_analysis_workflow(query, dataset_path)

# Use AutoGen for conversational agents
from agents.autogen_integration import AutoGenOrchestrator
autogen = AutoGenOrchestrator()
result = autogen.run_group_chat(query)
```

### 2. Advanced Monitoring
```bash
# View metrics
python cli/agent_cli.py metrics

# Follow logs in real-time
python cli/agent_cli.py logs --follow

# Check system status
curl http://localhost:8000/api/v1/system/status
```

### 3. Visualization Tools
```python
from tools.visualization import VisualizationTools
viz = VisualizationTools()
viz.plot_distribution(df['column'])
viz.create_dashboard(df)
```

### 4. CLI Interface
```bash
# Process queries via CLI
python cli/agent_cli.py query "Analyze the dataset"

# Ingest documents
python cli/agent_cli.py ingest ./data

# Run system tests
python cli/agent_cli.py test
```

### 5. Docker Deployment
```bash
# Quick deployment
make docker

# Or manually
docker-compose -f docker/docker-compose.yml up --build
```

## Advanced Features Included

✅ **CrewAI Integration** - Sophisticated multi-agent coordination
✅ **AutoGen Integration** - Conversational agent systems
✅ **Rich Logging** - Colored console output with Rich library
✅ **Metrics Collection** - Performance tracking and analytics
✅ **CLI Interface** - Typer-based command-line tools
✅ **Visualization Tools** - Plotly & Seaborn charts
✅ **Advanced API Endpoints** - Monitoring, metrics, system status
✅ **Docker Support** - Full containerization
✅ **Test Suite** - Unit and integration tests
✅ **Makefile** - Quick commands for common tasks
