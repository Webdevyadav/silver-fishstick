# Pre-Hackathon Checklist ✅

## Setup (Do Before Event)

### Environment Setup
- [ ] Python 3.10+ installed
- [ ] Node.js 18+ installed
- [ ] Docker installed (optional)
- [ ] Git configured

### Installation
- [ ] Run `make install` or `bash scripts/setup.sh`
- [ ] Create `.env` file from `.env.example`
- [ ] Add OpenAI API key to `.env`
- [ ] Add Tavily API key to `.env` (optional)
- [ ] Install frontend dependencies: `cd frontend && npm install`

### Testing
- [ ] Run `make test` - all tests pass
- [ ] Run `python scripts/test_system.py` - works
- [ ] Run `python cli/agent_cli.py test` - works
- [ ] Start API: `cd api && uvicorn main:app --reload` - works
- [ ] Start frontend: `cd frontend && npm run dev` - works
- [ ] Access API docs: `http://localhost:8000/docs` - loads

### Verification
- [ ] CLI works: `python cli/agent_cli.py query "test"`
- [ ] Metrics work: `python cli/agent_cli.py metrics`
- [ ] Logs work: `python cli/agent_cli.py logs`
- [ ] Docker works: `make docker` (optional)

### Documentation Review
- [ ] Read `README.md`
- [ ] Read `HACKATHON_GUIDE.md`
- [ ] Read `QUICK_REFERENCE.md`
- [ ] Bookmark `ARCHITECTURE.md`

## During Hackathon

### When Dataset Arrives (20 min)

#### 1. Data Ingestion (5 min)
- [ ] Copy dataset to `./data/` directory
- [ ] Run: `python cli/agent_cli.py ingest ./data`
- [ ] Verify: Check `chroma_db/` directory created

#### 2. Custom Tools (10 min)
- [ ] Open `tools/dataset_tools.py`
- [ ] Add domain-specific analysis functions
- [ ] Test tools: `pytest tests/test_tools.py -v`

#### 3. Prompt Updates (5 min)
- [ ] Open `prompts/planner_prompt.md`
- [ ] Add domain context and available tools
- [ ] Open `prompts/evaluator_prompt.md`
- [ ] Add domain-specific evaluation criteria

### Testing Phase (15 min)

#### Quick Tests
- [ ] Run: `python cli/agent_cli.py test`
- [ ] Test custom query: `python cli/agent_cli.py query "your domain query"`
- [ ] Check metrics: `python cli/agent_cli.py metrics`
- [ ] Review logs: `python cli/agent_cli.py logs`

#### Integration Tests
- [ ] Test full workflow via API
- [ ] Test frontend interface
- [ ] Verify visualizations work
- [ ] Check error handling

### Optional Enhancements (If Time)

#### Advanced Features
- [ ] Try CrewAI: Edit `graph/agent_graph.py` to use CrewAI
- [ ] Try AutoGen: Edit `graph/agent_graph.py` to use AutoGen
- [ ] Add visualizations: Use `tools/visualization.py`
- [ ] Add custom API endpoints: Edit `api/advanced_endpoints.py`

#### Polish
- [ ] Add domain-specific error messages
- [ ] Improve prompt engineering
- [ ] Add more test cases
- [ ] Create demo dataset

### Presentation Prep (20 min)

#### Demo Script
- [ ] Prepare 3-5 example queries
- [ ] Test queries work reliably
- [ ] Prepare metrics to show
- [ ] Prepare architecture diagram

#### Talking Points
- [ ] Explain decision loop (retry mechanism)
- [ ] Show multi-agent collaboration
- [ ] Demonstrate RAG integration
- [ ] Show monitoring/metrics
- [ ] Highlight extensibility

#### Demo Flow
1. [ ] Show architecture (`ARCHITECTURE.md`)
2. [ ] Run query via CLI
3. [ ] Show metrics dashboard
4. [ ] Open API docs
5. [ ] Show logs with retry mechanism
6. [ ] Display visualizations (if applicable)
7. [ ] Show code structure

## Troubleshooting Checklist

### Common Issues

#### Import Errors
- [ ] Virtual environment activated: `source venv/bin/activate`
- [ ] Dependencies installed: `pip install -r requirements.txt`

#### API Not Starting
- [ ] Check port 8000 not in use: `lsof -i :8000`
- [ ] Check logs: `tail -f logs/agent_system.log`
- [ ] Verify .env file exists with API keys

#### ChromaDB Errors
- [ ] Clear database: `rm -rf chroma_db/`
- [ ] Reinitialize: `python cli/agent_cli.py ingest ./data`

#### Frontend Not Loading
- [ ] Check port 3000 not in use: `lsof -i :3000`
- [ ] Dependencies installed: `cd frontend && npm install`
- [ ] Check API URL in frontend config

#### Tests Failing
- [ ] Check OpenAI API key is valid
- [ ] Check internet connection (for web search)
- [ ] Run individual test files to isolate issue

## Final Pre-Event Check (Day Before)

### System Health
- [ ] All tests pass: `make test`
- [ ] API starts without errors
- [ ] Frontend loads correctly
- [ ] CLI commands work
- [ ] Docker builds successfully (optional)

### Knowledge Check
- [ ] Know where to add custom tools
- [ ] Know how to update prompts
- [ ] Know how to ingest data
- [ ] Know how to run tests
- [ ] Know how to check metrics

### Backup Plan
- [ ] Code pushed to GitHub
- [ ] .env.example updated
- [ ] Documentation complete
- [ ] Demo queries prepared

## Success Criteria

### Minimum Viable Demo
- [ ] System processes queries end-to-end
- [ ] Shows decision loop (retry mechanism)
- [ ] Displays metrics
- [ ] Has domain-specific tools

### Ideal Demo
- [ ] All of above +
- [ ] Visualizations working
- [ ] Multiple agent frameworks shown
- [ ] Comprehensive monitoring
- [ ] Professional presentation

## Time Budget

| Phase | Time | Status |
|-------|------|--------|
| Setup | 5 min | [ ] |
| Data ingestion | 10 min | [ ] |
| Custom tools | 20 min | [ ] |
| Testing | 15 min | [ ] |
| Polish | 15 min | [ ] |
| Presentation prep | 20 min | [ ] |
| **Buffer** | **35 min** | [ ] |
| **Total** | **2 hours** | [ ] |

## Emergency Contacts

- Documentation: `QUICK_REFERENCE.md`
- Troubleshooting: `DEPLOYMENT.md`
- Architecture: `ARCHITECTURE.md`
- Features: `FEATURES_SUMMARY.md`

---

**Remember**: You're 80% done before the event starts. Focus on domain-specific customization, not infrastructure!
