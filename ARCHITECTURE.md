# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web UI     │  │     CLI      │  │   REST API   │      │
│  │  (Next.js)   │  │   (Typer)    │  │  (FastAPI)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Agent Orchestration Layer                  │
│                        (LangGraph)                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Planner  │→ │ Research │→ │   RAG    │→ │ Execute  │   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                    ↓         │
│                                            ┌──────────┐     │
│                                            │Evaluator │     │
│                                            │  Agent   │     │
│                                            └──────────┘     │
│                                                    ↓         │
│                                         [Retry if needed]   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         Tool Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Python  │  │ Dataset  │  │   Web    │  │   RAG    │   │
│  │ Executor │  │ Analysis │  │  Search  │  │ Retrieval│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data & Storage Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ ChromaDB │  │  Datasets│  │   Logs   │  │ Metrics  │   │
│  │ (Vector) │  │  (Files) │  │  (Files) │  │  (JSON)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Agent Decision Flow

```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       ↓
┌─────────────────────────────────────┐
│      Planner Agent                  │
│  • Analyze query                    │
│  • Break into steps                 │
│  • Assign tools                     │
└──────┬──────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│      Research Agent                 │
│  • Web search (DuckDuckGo/Tavily)  │
│  • Gather context                   │
└──────┬──────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│      RAG Agent                      │
│  • Query vector database            │
│  • Retrieve relevant documents      │
│  • Build context                    │
└──────┬──────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│      Tool Executor                  │
│  • Execute Python code              │
│  • Analyze datasets                 │
│  • Run computations                 │
└──────┬──────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│      Response Generator             │
│  • Combine all results              │
│  • Format response                  │
└──────┬──────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│      Evaluator Agent                │
│  • Check quality                    │
│  • Validate completeness            │
│  • Decide: Accept or Retry          │
└──────┬──────────────────────────────┘
       ↓
    [Decision]
       ↓
   ┌───┴───┐
   │       │
Accept   Retry
   │       │
   ↓       └──→ [Back to Planner]
Response
```

## Alternative Frameworks

### Option 1: LangGraph (Default)
```
State Machine → Nodes → Edges → Conditional Logic
```
**Best for**: Complex workflows, state management

### Option 2: CrewAI
```
Agents → Tasks → Crew → Sequential/Parallel Execution
```
**Best for**: Role-based collaboration, task delegation

### Option 3: AutoGen
```
Agents → Group Chat → Manager → Conversation Flow
```
**Best for**: Conversational agents, code execution

## Data Flow

### RAG Pipeline
```
Documents → Chunking → Embedding → Vector Store → Retrieval → Context
```

### Query Processing
```
Query → Embedding → Similarity Search → Top-K Results → Reranking → Context
```

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Layer                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Logger     │  │   Metrics    │  │   Status     │     │
│  │   (Rich)     │  │  Collector   │  │  Monitor     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                  ↓                  ↓             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Log Files   │  │ Metrics JSON │  │ System Stats │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Development
```
Local Machine
├── Backend (uvicorn)
├── Frontend (npm dev)
└── ChromaDB (local)
```

### Docker
```
Docker Compose
├── agent-api (container)
├── frontend (container)
└── shared volumes
```

### Production
```
Cloud Platform
├── API (ECS/Cloud Run)
├── Frontend (Vercel)
├── Vector DB (Pinecone/managed)
└── Monitoring (Datadog)
```

## Security Layers

```
┌─────────────────────────────────────────┐
│         Security Boundaries             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Input Validation               │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Authentication/Authorization   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Rate Limiting                  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Secrets Management             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Error Handling                 │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Scalability Strategy

### Horizontal Scaling
```
Load Balancer
├── API Instance 1
├── API Instance 2
└── API Instance N
```

### Caching Layer
```
Request → Cache Check → [Hit: Return] or [Miss: Process → Cache → Return]
```

### Queue System (Future)
```
Request → Queue → Worker Pool → Process → Response
```

## Extension Points

1. **Add New Agent**: Create in `agents/` directory
2. **Add New Tool**: Create in `tools/` directory
3. **Add New Endpoint**: Extend `api/` routers
4. **Add New Prompt**: Create in `prompts/` directory
5. **Add New Test**: Create in `tests/` directory

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Next.js + React + TypeScript + TailwindCSS                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  FastAPI + Python + Pydantic                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      AI Framework                            │
│  LangChain + LangGraph + LlamaIndex                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         LLM Layer                            │
│  OpenAI GPT-4 + Embeddings                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│  ChromaDB + File System + JSON                              │
└─────────────────────────────────────────────────────────────┘
```
