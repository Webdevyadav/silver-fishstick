# Deployment Guide

## Quick Start Options

### Option 1: Local Development
```bash
make install
make run
```

### Option 2: Docker
```bash
make docker
# Or
docker-compose -f docker/docker-compose.yml up --build
```

### Option 3: Manual
```bash
# Backend
cd api && uvicorn main:app --reload

# Frontend (new terminal)
cd frontend && npm run dev
```

## Environment Variables

Create `.env` file:
```bash
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...  # Optional
MODEL_NAME=gpt-4-turbo-preview
TEMPERATURE=0.7
MAX_ITERATIONS=5
```

## Production Deployment

### AWS Deployment
```bash
# Build and push Docker image
docker build -t agent-system -f docker/Dockerfile .
docker tag agent-system:latest <ecr-repo>:latest
docker push <ecr-repo>:latest

# Deploy to ECS/EKS
# Use provided docker-compose.yml as reference
```

### Vercel (Frontend)
```bash
cd frontend
vercel deploy --prod
```

### Railway/Render (Backend)
- Connect GitHub repo
- Set environment variables
- Deploy from `api/` directory
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Monitoring

### Health Checks
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/system/status
```

### Metrics
```bash
curl http://localhost:8000/api/v1/metrics
```

### Logs
```bash
# Via CLI
python cli/agent_cli.py logs --follow

# Direct file access
tail -f logs/agent_system.log
```

## Scaling Considerations

1. **Horizontal Scaling**: Run multiple API instances behind load balancer
2. **Vector DB**: Use managed ChromaDB or Pinecone for production
3. **Caching**: Add Redis for response caching
4. **Queue System**: Add Celery for background tasks
5. **Monitoring**: Integrate Datadog/Prometheus

## Security Checklist

- [ ] API keys in environment variables (never in code)
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] HTTPS enabled
- [ ] Authentication/authorization implemented
- [ ] Secrets management (AWS Secrets Manager, etc.)

## Performance Optimization

1. **API Response Time**: Target < 2s for most queries
2. **Vector Search**: Optimize embedding model and index size
3. **LLM Calls**: Use streaming for long responses
4. **Caching**: Cache frequent queries and embeddings
5. **Database**: Index frequently queried fields

## Troubleshooting

### Common Issues

**Issue**: Import errors
```bash
# Solution: Ensure virtual environment is activated
source venv/bin/activate
```

**Issue**: ChromaDB errors
```bash
# Solution: Clear and reinitialize
rm -rf chroma_db/
python -c "from rag.ingestion import RAGIngestion; RAGIngestion()"
```

**Issue**: API not responding
```bash
# Check logs
tail -f logs/agent_system.log

# Check process
ps aux | grep uvicorn
```

**Issue**: Out of memory
```bash
# Reduce batch size in RAG ingestion
# Use smaller embedding model
# Limit concurrent requests
```
