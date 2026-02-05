# Previous NextJS Attempt Analysis

**Location**: `/data/www/ecod/html/node/ecod_frontpage_test`
**Date Analyzed**: 2026-02-05

---

## Overview

A partially-completed NextJS 14 application that implemented many core ECOD features but encountered issues, particularly with 3D molecular visualization integration.

---

## Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Next.js | 14.0.0 | App Router |
| React | 18.2.0 | Hooks-based |
| TypeScript | 5.0.0 | Strict mode |
| Tailwind CSS | 3.3.0 | Utility-first styling |
| PostgreSQL | pg 8.16.3 | Connection pooling |
| 3DMol.js | 2.0.4 | Molecular viewer (problematic) |
| Lucide React | 0.294.0 | Icons |

---

## Project Structure

```
ecod_frontpage_test/
├── app/
│   ├── api/                    # 13 API route directories
│   │   ├── search/
│   │   ├── stats/
│   │   ├── tree/
│   │   ├── domains/[id]/
│   │   ├── proteins/[id]/
│   │   ├── structures/[id]/
│   │   ├── sequences/[id]/
│   │   ├── classification/[id]/
│   │   ├── representative/[id]/
│   │   └── export/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   ├── protein/[id]/
│   ├── domain/[id]/
│   ├── search/
│   ├── tree/
│   ├── distribution/
│   └── documentation/
├── components/                 # 38 TSX files
│   ├── layout/
│   ├── visualization/          # Multiple viewer attempts
│   ├── protein/
│   └── ui/
├── contexts/                   # 5 context providers
├── lib/
│   ├── db.ts                   # PostgreSQL utilities
│   ├── api.ts
│   └── cache.ts
├── types/
│   ├── database.ts
│   └── protein.ts
└── utils/
```

---

## What Worked Well

### 1. Database Integration (`lib/db.ts`)

Solid PostgreSQL connection with pooling:

```typescript
// Connection pool configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'asteria',
  port: parseInt(process.env.DB_PORT || '45000'),
  database: process.env.DB_NAME || 'ecod_af2_pdb',
  user: process.env.DB_USER || 'ecod',
  max: 20,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 10000,
});

// Type-safe query wrapper
async function query<T>(text: string, params?: any[]): Promise<T[]>
```

### 2. Context Architecture

Well-organized state management:
- `AppContextProvider` - Aggregates all contexts
- `SearchContext` - Search state with useReducer + localStorage
- `TreeContext` - Hierarchical navigation state
- `UserPreferencesContext` - User settings

### 3. API Routes

Comprehensive REST API:
- `/api/search` - Multi-parameter search with relevance scoring
- `/api/tree` - Hierarchical classification
- `/api/domains/[id]` - Domain details
- `/api/proteins/[id]` - Protein information
- `/api/stats` - Cached database statistics

### 4. Caching Strategy (`lib/cache.ts`)

TTL-based in-memory cache with automatic cleanup.

### 5. TypeScript Types (`types/database.ts`)

Comprehensive type definitions for all database entities.

---

## What Did NOT Work Well

### 1. 3D Molecular Viewer Integration (Critical)

**The Problem**: React and WebGL-based molecular viewers (3DMol.js, Molstar) have fundamental conflicts:

1. **Lifecycle Mismatch**: React's declarative rendering vs. imperative WebGL state
2. **Re-render Destruction**: React unmounts components, destroying viewer state
3. **Ref Timing Issues**: Canvas refs not ready when viewer initializes
4. **Memory Leaks**: Improper cleanup on component unmount
5. **State Synchronization**: Keeping React state in sync with viewer state

**Evidence**: Multiple viewer component files exist (`ThreeDMolViewer.tsx`, `StructureViewer.tsx`), suggesting repeated attempts to solve this issue.

### 2. Incomplete Features

- Protein pages partially implemented
- Domain detail pages infrastructure exists but incomplete
- BLAST integration stubbed but not functional
- Export functionality unclear

### 3. Development Artifacts

- Mock data left in `protein.ts`
- Generic component names (`ExampleComponent`, `ClientLayout`)
- Development logging throughout codebase
- No test coverage

### 4. Production Readiness

- Hardcoded credentials in `.env.local`
- No authentication/authorization
- No rate limiting implementation
- Limited error boundaries

---

## Patterns to Reuse

### Database Query Pattern

```typescript
export async function query<T>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result.rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
```

### Search Query Pattern

```typescript
// Multi-view search with relevance scoring
const searchQuery = `
  SELECT
    uid, id, type, range,
    xid, hid, tid, fid,
    xname, hname, tname, fname,
    unp_acc, source_id,
    ts_rank(search_vector, plainto_tsquery($1)) as relevance
  FROM (
    SELECT *, to_tsvector('english', coalesce(fname,'') || ' ' || coalesce(tname,'')) as search_vector
    FROM view_dom_clsrel_pdbinfo
    UNION ALL
    SELECT *, to_tsvector('english', coalesce(fname,'') || ' ' || coalesce(tname,'')) as search_vector
    FROM view_dom_clsrel_csminfo
  ) combined
  WHERE search_vector @@ plainto_tsquery($1)
  ORDER BY relevance DESC
  LIMIT $2 OFFSET $3
`;
```

### Cache Pattern

```typescript
class TTLCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }
}
```

---

## 3D Viewer Solutions for New Implementation

### Option 1: Iframe Isolation (Recommended)

Completely isolate the viewer from React's lifecycle:

```typescript
// Viewer in separate HTML file served statically
// React component just manages iframe src
function StructureViewer({ uid, range }: Props) {
  const src = `/viewer.html?uid=${uid}&range=${encodeURIComponent(range)}`;
  return <iframe src={src} className="w-full h-[500px]" />;
}
```

**Pros**: Complete isolation, no lifecycle conflicts
**Cons**: Cross-frame communication complexity, separate codebase

### Option 2: Careful useRef + useEffect

```typescript
function StructureViewer({ pdbData, selection }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize viewer ONCE
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    viewerRef.current = new Viewer(containerRef.current);
    setIsReady(true);

    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []); // Empty deps - only run once

  // Update viewer when data changes (NOT re-create)
  useEffect(() => {
    if (!isReady || !viewerRef.current || !pdbData) return;
    viewerRef.current.loadStructure(pdbData);
  }, [isReady, pdbData]);

  return <div ref={containerRef} className="w-full h-[500px]" />;
}
```

**Pros**: Integrated in React
**Cons**: Fragile, easy to break with wrong dependencies

### Option 3: Static Images + On-Demand Viewer

Pre-render structure images server-side, only load interactive viewer when user requests it:

```typescript
function StructureViewer({ uid }: Props) {
  const [interactive, setInteractive] = useState(false);

  if (!interactive) {
    return (
      <div className="relative">
        <img src={`/api/images/structure/${uid}`} alt="Structure" />
        <button onClick={() => setInteractive(true)}>
          Load Interactive Viewer
        </button>
      </div>
    );
  }

  return <InteractiveViewer uid={uid} />;
}
```

**Pros**: Fast initial load, viewer only when needed
**Cons**: Requires server-side image generation (PyMOL)

### Option 4: Mol* Plugin UI

Mol* has official React bindings, but they're complex:

```typescript
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';

// Requires careful lifecycle management
// See: https://github.com/molstar/molstar/tree/master/src/apps/viewer
```

**Pros**: Official support, full Mol* features
**Cons**: Complex setup, large bundle size, still has lifecycle issues

---

## Recommendations for New Implementation

1. **Start with iframe isolation** for the 3D viewer - simplest and most reliable
2. **Reuse database utilities** - they were well-implemented
3. **Reuse type definitions** - comprehensive and accurate
4. **Reuse caching pattern** - effective for expensive queries
5. **Rebuild context architecture** - good pattern but needs cleanup
6. **Add proper error boundaries** - missing from previous attempt
7. **Add testing from start** - no tests in previous attempt
8. **Use environment variables properly** - no hardcoded credentials

---

*Analysis for ECOD NextJS/React migration project*
