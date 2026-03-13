# RosterIQ Frontend

React/Next.js frontend for the RosterIQ AI Agent system with three-panel responsive UI.

## Architecture

### Three-Panel Layout

The UI is organized into three distinct panels:

1. **Query Input Panel** (Left) - Natural language query interface
   - Query input with autocomplete
   - Query history and favorites
   - Diagnostic procedure templates
   - Query validation

2. **Results Display Panel** (Center) - Real-time analysis results
   - SSE streaming for live updates
   - Confidence score visualization
   - Flags and alerts display
   - Reasoning process steps
   - Visualizations (charts, graphs)
   - Export and share functionality

3. **Detail Panel** (Right) - Source attribution and context
   - Source citations with drill-down
   - Evidence details
   - Confidence score explanation
   - Session information
   - System health status
   - Contextual help

## Key Features

### Real-Time Streaming (SSE)
- Server-Sent Events for live analysis updates
- Progress indicators during query processing
- Cancellation support for long-running queries
- Automatic reconnection on connection loss

### Query Management
- Natural language query input
- Pre-defined diagnostic procedure templates
- Query history with localStorage persistence
- Favorites system for frequently used queries
- Keyboard shortcuts (Cmd/Ctrl + Enter to submit)

### Source Attribution
- Complete traceability for all data points
- Expandable source details
- Links to original data sources
- Confidence scoring for evidence

### Responsive Design
- Mobile-first approach with Tailwind CSS
- Three-panel layout adapts to screen size
- Touch-friendly interactions
- Accessible components (WCAG 2.1 AA)

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Markdown**: react-markdown
- **Real-time**: Server-Sent Events (EventSource API)
- **Testing**: Jest + React Testing Library

## Project Structure

```
frontend/
├── app/                      # Next.js app directory
│   ├── analysis/            # Analysis page route
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   ├── layout/              # Layout components
│   │   ├── ThreePanelLayout.tsx      # Main layout orchestrator
│   │   ├── QueryInputPanel.tsx       # Query input interface
│   │   ├── ResultsDisplayPanel.tsx   # Results display
│   │   └── DetailPanel.tsx           # Details and sources
│   └── ui/                  # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── separator.tsx
│       └── textarea.tsx
├── lib/
│   ├── useSSE.ts            # SSE hook for real-time streaming
│   └── utils.ts             # Utility functions
├── __tests__/
│   ├── integration/         # Integration tests
│   └── setup.ts             # Test configuration
└── public/                  # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Type checking
npm run type-check

# Linting
npm run lint
```

## API Integration

The frontend connects to the Express.js backend API:

### Endpoints

- `POST /api/session/create` - Initialize new session
- `GET /api/session/current` - Get current session info
- `POST /api/query` - Submit analysis query
- `GET /api/query/stream` - SSE stream for real-time updates
- `GET /api/health/status` - System health check

### SSE Message Format

```typescript
interface SSEMessage {
  type: 'step' | 'result' | 'error' | 'complete';
  data: any;
}
```

## Component API

### ThreePanelLayout

Main layout component orchestrating the three panels.

```typescript
<ThreePanelLayout />
```

### QueryInputPanel

```typescript
interface QueryInputPanelProps {
  onQuerySubmit: (query: string) => void;
  isProcessing: boolean;
}
```

### ResultsDisplayPanel

```typescript
interface ResultsDisplayPanelProps {
  result: AnalysisResult | null;
  isStreaming: boolean;
  streamingSteps: ReasoningStep[];
  onCancel: () => void;
  onEvidenceSelect: (evidence: Evidence) => void;
}
```

### DetailPanel

```typescript
interface DetailPanelProps {
  result: AnalysisResult | null;
  selectedEvidence: Evidence | null;
}
```

## Data Models

### AnalysisResult

```typescript
interface AnalysisResult {
  id: string;
  response: string;
  sources: Source[];
  confidence: number;
  reasoning: ReasoningStep[];
  flags: Flag[];
  visualizations?: Visualization[];
  timestamp: Date;
}
```

### ReasoningStep

```typescript
interface ReasoningStep {
  id: string;
  type: 'analyze' | 'query' | 'search' | 'correlate' | 'conclude';
  description: string;
  toolsUsed: string[];
  evidence: Evidence[];
  timestamp: Date;
}
```

### Source

```typescript
interface Source {
  id: string;
  type: 'roster_processing' | 'operational_metrics' | 'web_search' | 'memory';
  reference: string;
  timestamp?: Date;
}
```

## Styling

The application uses Tailwind CSS with a custom theme configured in `tailwind.config.ts`.

### Color Scheme

- Primary: Healthcare blue
- Secondary: Neutral grays
- Success: Green
- Warning: Yellow
- Error: Red
- Info: Blue

### Responsive Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (three-panel layout activates)
- `xl`: 1280px
- `2xl`: 1536px

## Accessibility

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Color contrast compliance (WCAG 2.1 AA)

## Performance Optimization

- Next.js automatic code splitting
- React Server Components where applicable
- Image optimization with next/image
- Lazy loading for heavy components
- Memoization for expensive computations
- Debounced input handlers

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## Deployment

### Docker

```bash
docker build -t rosteriq-frontend .
docker run -p 3000:3000 rosteriq-frontend
```

### Vercel

The application is optimized for deployment on Vercel:

```bash
vercel deploy
```

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Ensure all tests pass
5. Run type checking and linting

## License

Proprietary - RosterIQ AI Agent System
