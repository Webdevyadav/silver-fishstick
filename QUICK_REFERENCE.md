# Quick Reference Card

## 🚀 Setup (5 minutes)
```bash
# Option 1: Makefile
make install

# Option 2: Manual
bash scripts/setup.sh

# Add API keys to .env
OPENAI_API_KEY=sk-...
```

## 🎯 When Dataset Arrives (20 minutes)

### 1. Ingest Data
```bash
# Via CLI
python cli/agent_cli.py ingest ./data

# Via Python
from rag.ingestion import RAGIngestion
RAGIngestion().ingest_directory("./data")
```

### 2. Add Custom Tools
Edit `tools/dataset_tools.py`:
```python
@staticmethod
def custom_analysis(df):
    # Your logic here
    return results
```

### 3. Update Prompts
Edit `prompts/planner_prompt.md` with domain context

## 💻 Running the System

### Development
```bash
make run
# Or
cd api && uvicorn main:app --reload
cd frontend && npm run dev
```

### Docker
```bash
make docker
# Or
docker-compose -f docker/docker-compose.yml up
```

### CLI
```bash
python cli/agent_cli.py query "Your question"
python cli/agent_cli.py metrics
python cli/agent_cli.py logs --follow
```

## 🧪 Testing
```bash
make test
# Or
pytest tests/ -v
python scripts/test_system.py
```

## 📊 Monitoring

### Metrics
```bash
curl http://localhost:8000/api/v1/metrics
python cli/agent_cli.py metrics
```

### Logs
```bash
python cli/agent_cli.py logs --follow
tail -f logs/agent_system.log
```

### System Status
```bash
curl http://localhost:8000/api/v1/system/status
```

## 🎨 Using Alternative Frameworks

### CrewAI
```python
from agents.crewai_integration import CrewAIOrchestrator
crew = CrewAIOrchestrator()
result = crew.run_analysis_workflow(query, dataset_path)
```

### AutoGen
```python
from agents.autogen_integration import AutoGenOrchestrator
autogen = AutoGenOrchestrator()
result = autogen.run_group_chat(query)
```

## 📈 Visualization
```python
from tools.visualization import VisualizationTools
viz = VisualizationTools()
viz.plot_distribution(df['column'])
viz.create_dashboard(df)
```

## 🔧 Common Commands

| Task | Command |
|------|---------|
| Install | `make install` |
| Run dev | `make run` |
| Run tests | `make test` |
| Docker | `make docker` |
| Clean | `make clean` |
| Query | `python cli/agent_cli.py query "text"` |
| Ingest | `python cli/agent_cli.py ingest ./data` |
| Metrics | `python cli/agent_cli.py metrics` |
| Logs | `python cli/agent_cli.py logs -f` |

## 🎤 Demo Script

1. Show architecture diagram
2. Run query via CLI: `python cli/agent_cli.py query "Analyze dataset"`
3. Show metrics: `python cli/agent_cli.py metrics`
4. Open API docs: `http://localhost:8000/docs`
5. Show retry mechanism in logs
6. Display visualization outputs

## 🏆 Winning Points

- ✅ Real decision loop (not just a chatbot)
- ✅ Multi-agent collaboration
- ✅ RAG integration
- ✅ Production-ready monitoring
- ✅ Multiple framework options
- ✅ Comprehensive testing
- ✅ Docker deployment
- ✅ Professional CLI
- ✅ Advanced visualizations
- ✅ Extensible architecture

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| Import errors | `source venv/bin/activate` |
| ChromaDB errors | `rm -rf chroma_db/` |
| API not responding | Check `logs/agent_system.log` |
| Out of memory | Reduce batch size in RAG |

## 🎯 Time Budget

- Setup: 5 min
- Data ingestion: 10 min
- Custom tools: 20 min
- Testing: 10 min
- Polish: 15 min

**Total: 60 minutes** (leaves 2+ hours for debugging/features)
