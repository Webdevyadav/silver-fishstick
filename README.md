# RosterIQ AI Agent System

An autonomous AI agent system designed for healthcare insurance payers to analyze provider roster pipeline operations with intelligent persistent memory capabilities.

## Overview

RosterIQ processes two CSV datasets (roster processing details and operational metrics) through a Node.js/TypeScript backend with React/Next.js frontend, featuring:

- **Three-Panel UI**: Query input, results display, and detail panels
- **Real-time Streaming**: Live analysis updates via Server-Sent Events
- **Cross-Dataset Correlation**: Statistical analysis across multiple data sources
- **Four Named Diagnostic Procedures**: Standardized operational investigations
- **Persistent Memory**: Episodic, procedural, and semantic memory systems
- **Proactive Monitoring**: Automated anomaly detection and alerting

## Architecture

- **Frontend**: React/Next.js with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js API with TypeScript
- **Databases**: DuckDB for analytics, SQLite for episodic memory, Redis for caching
- **AI Integration**: Gemini 2.0 Flash API for natural language processing
- **Memory Systems**: Three types of persistent memory with state change detection

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (optional)
- Redis server
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rosteriq-ai-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers**
   ```bash
   # Start backend
   npm run dev

   # In another terminal, start frontend
   cd frontend && npm run dev
   ```

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Databases
DUCKDB_PATH=./data/analytics.duckdb
SQLITE_PATH=./data/episodic_memory.db
REDIS_URL=redis://localhost:6379

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Data Files
CSV_ROSTER_PROCESSING_PATH=./data/roster_processing_details.csv
CSV_OPERATIONAL_METRICS_PATH=./data/aggregated_operational_metrics.csv
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Query Processing
```
POST /api/query
{
  "query": "What changed in our roster processing since my last session?",
  "sessionId": "user-session-id",
  "userId": "user-id"
}
```

### Session Management
```
POST /api/session
{
  "userId": "user-id",
  "sessionId": "optional-existing-session-id"
}
```

### Diagnostic Procedures
```
POST /api/diagnostic
{
  "procedureName": "triage_stuck_ros",
  "parameters": { "market_segment": "commercial" },
  "sessionId": "user-session-id",
  "userId": "user-id"
}
```

## Development

### Project Structure

```
├── src/
│   ├── api/           # API routes and handlers
│   ├── services/      # Core services (Database, Redis)
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   ├── validation/    # Data validation schemas
│   └── index.ts       # Application entry point
├── frontend/
│   ├── app/           # Next.js app directory
│   ├── components/    # React components
│   └── lib/           # Frontend utilities
├── tests/             # Test files
├── data/              # Sample data files
└── docs/              # Documentation
```

### Scripts

```bash
# Backend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run type-check   # TypeScript type checking

# Frontend
cd frontend
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run lint         # Lint code
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Data Models

### Roster Processing Record
```typescript
interface RosterProcessingRecord {
  file_id: string;
  submission_date: Date;
  market_segment: string;
  provider_type: string;
  total_records: number;
  processed_records: number;
  failed_records: number;    // FAIL_REC_CNT - pipeline errors
  rejected_records: number;  // REJ_REC_CNT - data quality issues
  processing_stage: string;
  processing_time_minutes: number;
  retry_count: number;
  final_status: string;
}
```

### Operational Metrics
```typescript
interface OperationalMetrics {
  market_id: string;
  month: string;
  total_files_received: number;
  files_processed_successfully: number;
  average_processing_time: number;
  error_rate_percentage: number;
  provider_onboarding_rate: number;
  data_quality_score: number;
  sla_compliance_percentage: number;
}
```

## Diagnostic Procedures

1. **triage_stuck_ros**: Analyze roster files stuck in processing stages
2. **record_quality_audit**: Examine data quality patterns and validation failures
3. **market_health_report**: Generate comprehensive market-level health assessments
4. **retry_effectiveness_analysis**: Evaluate retry operation success rates and patterns

## Memory Systems

- **Episodic Memory**: Session-based memory storing user interactions and system responses
- **Procedural Memory**: Workflow-based memory storing diagnostic procedures and improvements
- **Semantic Memory**: Knowledge-based memory storing domain facts and learned patterns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions and support, please open an issue in the repository or contact the development team.