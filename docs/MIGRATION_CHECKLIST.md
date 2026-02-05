# ECOD NextJS Migration Checklist

## Phase 1: Project Setup

- [ ] Initialize Next.js 14+ project with App Router
- [ ] Configure TypeScript
- [ ] Set up Tailwind CSS
- [ ] Configure ESLint and Prettier
- [ ] Set up environment variables (.env.local)
- [ ] Configure PostgreSQL connection (Prisma or Drizzle)
- [ ] Generate database types from schema
- [ ] Set up project structure

## Phase 2: Core Infrastructure

### Database Layer
- [ ] Create Prisma/Drizzle schema matching PostgreSQL
- [ ] Implement connection pooling
- [ ] Create data access layer (repositories)
- [ ] Add query caching strategy

### API Routes
- [ ] `/api/clusters` - Get cluster hierarchy
- [ ] `/api/clusters/[id]` - Get cluster details
- [ ] `/api/clusters/[id]/children` - Get cluster children
- [ ] `/api/domains` - Search domains
- [ ] `/api/domains/[uid]` - Get domain details
- [ ] `/api/search` - Unified search endpoint
- [ ] `/api/search/blast` - BLAST submission
- [ ] `/api/blast/[id]` - BLAST status/results
- [ ] `/api/download/structure/[uid]` - PDB download
- [ ] `/api/download/sequence/[uid]` - FASTA download
- [ ] `/api/download/pymol/[uid]` - PyMOL script

## Phase 3: UI Components

### Layout Components
- [ ] Root layout with metadata
- [ ] Header/Navigation bar
- [ ] Footer
- [ ] Sidebar for tree navigation
- [ ] Mobile responsive layout

### Tree Navigation
- [ ] TreeView container component
- [ ] TreeNode component (expandable)
- [ ] Lazy-loading for children
- [ ] Pagination for large clusters
- [ ] Highlight/selection state
- [ ] URL sync for deep linking

### Domain Display
- [ ] Domain page layout
- [ ] Domain metadata card
- [ ] Classification breadcrumb
- [ ] Related domains list
- [ ] External links section
- [ ] Tabbed interface

### 3D Visualization
- [ ] Evaluate Mol* vs NGL Viewer
- [ ] Structure viewer component
- [ ] Domain highlighting in structure
- [ ] pLDDT coloring for AlphaFold models
- [ ] Download controls

### Search
- [ ] Search input with autocomplete
- [ ] Search results list
- [ ] Result filtering
- [ ] Pagination
- [ ] Advanced search form (taxonomy)

### BLAST
- [ ] Sequence input form
- [ ] Job submission handler
- [ ] Progress indicator
- [ ] Results display with alignments
- [ ] Score color coding

### Distribution/Download
- [ ] Version list display
- [ ] Filtered set options
- [ ] Download links
- [ ] Statistics display

## Phase 4: Page Routes

| Route | Status | Notes |
|-------|--------|-------|
| `/` | [ ] | Home page with tree |
| `/tree` | [ ] | Alias for tree view |
| `/domain/[uid]` | [ ] | Domain detail page |
| `/search` | [ ] | Search results |
| `/search/advanced` | [ ] | Taxonomy search |
| `/blast/[id]` | [ ] | BLAST results |
| `/distribution` | [ ] | Downloads page |
| `/documentation` | [ ] | Help/docs |

## Phase 5: Feature Parity

### From PHP Site
- [ ] Tree lazy loading matches performance
- [ ] All search types working
- [ ] Domain pages display all info
- [ ] File downloads work correctly
- [ ] BLAST integration functional
- [ ] Pagination matches behavior
- [ ] Cache headers appropriate

### Improvements
- [ ] Faster initial page load (SSR/SSG)
- [ ] Better mobile experience
- [ ] Improved accessibility (ARIA)
- [ ] Modern 3D viewer
- [ ] Better error handling
- [ ] Loading states/skeletons

## Phase 6: Testing

- [ ] Unit tests for utilities
- [ ] Component tests (React Testing Library)
- [ ] API route tests
- [ ] E2E tests (Playwright)
- [ ] Performance benchmarks
- [ ] Accessibility audit

## Phase 7: Deployment

- [ ] Docker configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] Production deployment
- [ ] DNS/routing configuration
- [ ] SSL certificates
- [ ] Monitoring setup
- [ ] Analytics integration

## Phase 8: Documentation

- [ ] README with setup instructions
- [ ] API documentation
- [ ] Component documentation (Storybook?)
- [ ] Deployment guide
- [ ] User guide updates

---

## Feature Mapping: PHP → NextJS

| PHP Handler | NextJS Route/Component |
|-------------|------------------------|
| `MainPage->treeView` | `/app/page.tsx` + `TreeView` component |
| `Domain->domainPage` | `/app/domain/[uid]/page.tsx` |
| `Load->ajaxLoad` | `/api/clusters/[id]/children` + React Query |
| `Search->searchAll` | `/app/search/page.tsx` + `/api/search` |
| `Search->searchBLAST` | `/api/search/blast` (POST) |
| `Blast->resultPage` | `/app/blast/[id]/page.tsx` |
| `Distribution->page` | `/app/distribution/page.tsx` |
| `Documentation->page` | `/app/documentation/page.tsx` |
| `Structure->download` | `/api/download/structure/[uid]` |
| `Sequence->download` | `/api/download/sequence/[uid]` |
| `Pymol->download` | `/api/download/pymol/[uid]` |
| `pic->domainPic` | `/api/images/[uid]` or static serving |

---

## Dependencies to Evaluate

### Required
- `next` - Framework
- `react`, `react-dom` - UI library
- `typescript` - Type safety
- `tailwindcss` - Styling
- `prisma` or `drizzle-orm` - Database ORM
- `pg` - PostgreSQL driver

### Recommended
- `@tanstack/react-query` - Data fetching/caching
- `zustand` or `jotai` - State management
- `zod` - Schema validation
- `molstar` - 3D structure visualization
- `lucide-react` - Icons
- `@radix-ui/*` - Accessible UI primitives

### Development
- `eslint` - Linting
- `prettier` - Formatting
- `vitest` - Unit testing
- `@testing-library/react` - Component testing
- `playwright` - E2E testing

---

## Notes

- Database is read-only for web user - no migrations needed for existing data
- BLAST requires backend queue system - consider Bull/BullMQ with Redis
- Structure files served from `/usr1/ECOD/html/af2_pdb_d/`
- Distribution files from `/usr1/ECOD/html/distributions/`
- Consider CDN for static structure images

---

*Migration checklist for ECOD NextJS/React project*
