# Plan: Migrate ECOD API into ecod2 Platform

## Background

A standalone FastAPI service exists at `~/work/api/ecod-api/` that provides programmatic
access to ECOD domain data. It runs on leda:8000 behind an Apache reverse proxy at
`prodata.swmed.edu/ecod/api/`. It has two endpoints:

- `GET /domains/uniprot/{acc}` - All domains for a UniProt accession
- `GET /domains/{uid}` - Single domain by UID

This service should be absorbed into the ecod2 Next.js application. There is no backward
compatibility requirement -- the user base is negligible.

## Current State

### FastAPI (~/work/api/ecod-api/)
- Python/FastAPI with SQLAlchemy, queries `view_dom_clsrel_clsname`
- Rate limiting via slowapi (100/min, 1000/hr per IP)
- Request logging (IP, path, duration, user-agent) to file
- CORS enabled
- Deployed as uvicorn process on leda, proxied via Apache

### ecod2 Internal API Routes (already in Next.js)
These serve the website UI and are not designed for external programmatic use:

| Route | Purpose |
|---|---|
| `/api/domain/[uid]` | Domain detail for domain page (rich: Pfam, DrugDomain, ligands, PDB info) |
| `/api/domain/[uid]/pdb` | Pre-cut domain PDB file download |
| `/api/domain/[uid]/fasta` | Pre-cut domain FASTA file download |
| `/api/protein/[identifier]` | All domains for a UniProt acc or PDB chain (for protein page) |
| `/api/pdb/[pdbId]` | All chains/domains for a PDB entry (for PDB page) |
| `/api/search` | Multi-type search with auto-detection |
| `/api/search/advanced` | Taxonomic search |
| `/api/tree` | Classification tree children |
| `/api/tree/domains` | Domains under a classification node |
| `/api/stats` | Database statistics |
| `/api/health` | Health check |
| `/api/news` | News items |
| `/api/distributions` | Distribution file listing |
| `/api/blast/submit`, `/api/blast/[jobId]` | BLAST search |
| `/api/foldseek/submit`, `/api/foldseek/[jobId]` | Foldseek search |
| `/api/taxonomy` | Taxonomy lookup |

## Design

### Namespace: `/api/v1/`

Public programmatic API lives under `/api/v1/` to separate it from internal UI routes
under `/api/`. The v1 namespace allows future API evolution without breaking existing
consumers or conflicting with UI routes.

### Endpoints

#### 1. `GET /api/v1/domains/uniprot/{acc}`

All domains for a UniProt accession. Primary use case for external consumers.

**Response:**
```json
{
  "uniprot_acc": "P00519",
  "domain_count": 2,
  "domains": [
    {
      "uid": 123456,
      "ecod_domain_id": "e1opkA1",
      "type": "experimental structure",
      "source_id": "1opk_A",
      "range": "A:229-513",
      "seqid_range": "229-513",
      "classification": {
        "architecture": { "id": "a.1", "name": "beta barrels" },
        "x_group": { "id": "1.1", "name": "cradle loop barrel" },
        "h_group": { "id": "1.1.1", "name": "RIFT-related" },
        "t_group": { "id": "1.1.1.1", "name": "acid protease" },
        "family": { "id": "1.1.1.1.1", "name": "RVP" }
      },
      "is_representative": true
    }
  ]
}
```

**Implementation:** Reuse the query pattern from `/api/protein/[identifier]` (which
already handles UniProt lookup with full classification via JOINs). Simplify the response
to the fields relevant for programmatic use -- no ligand visualization data, no gap
computation, no estimated chain length.

#### 2. `GET /api/v1/domains/pdb/{pdb_id}`

All domains for a PDB entry (all chains).

**Response:**
```json
{
  "pdb_id": "1OPK",
  "domain_count": 3,
  "domains": [
    {
      "uid": 123456,
      "ecod_domain_id": "e1opkA1",
      "type": "experimental structure",
      "chain_id": "A",
      "range": "A:229-513",
      "seqid_range": "229-513",
      "classification": { ... },
      "is_representative": true
    }
  ]
}
```

**Implementation:** Query `domain` table by `source_id LIKE '{pdb}_%'` (case-insensitive).
Similar to existing `/api/pdb/[pdbId]` but with the v1 response shape.

#### 3. `GET /api/v1/domains/{uid}`

Single domain by UID. Leaner than the internal `/api/domain/[uid]` which fetches Pfam,
DrugDomain, ligands, PDB chain info, and representative domain data.

**Response:**
```json
{
  "uid": 123456,
  "ecod_domain_id": "e1opkA1",
  "type": "experimental structure",
  "source_id": "1opk_A",
  "uniprot_acc": "P00519",
  "chain_id": "A",
  "range": "A:229-513",
  "seqid_range": "229-513",
  "classification": {
    "architecture": { "id": "a.1", "name": "beta barrels" },
    "x_group": { "id": "1.1", "name": "cradle loop barrel" },
    "h_group": { "id": "1.1.1", "name": "RIFT-related" },
    "t_group": { "id": "1.1.1.1", "name": "acid protease" },
    "family": { "id": "1.1.1.1.1", "name": "RVP" }
  },
  "is_representative": true,
  "files": {
    "pdb": "/api/v1/domains/123456/pdb",
    "fasta": "/api/v1/domains/123456/fasta"
  }
}
```

**Implementation:** Simplified version of `/api/domain/[uid]`. Single query joining
`domain` + `cluster` hierarchy. Include links to file download endpoints.

#### 4. `GET /api/v1/domains/{uid}/pdb` and `/fasta`

Pre-cut domain structure and sequence files. These can simply proxy to the existing
`/api/domain/[uid]/pdb` and `/fasta` routes, or share the same file-serving logic.

#### 5. `GET /api/v1/health`

Health check with database connectivity and version.

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "version": "1.0.0"
}
```

### Shared Query Logic

The v1 routes and internal UI routes query the same database. To avoid duplication,
extract common query functions into a shared module:

```
src/lib/
  db.ts              (existing - connection pool)
  domain-queries.ts  (new - shared query functions)
```

Functions:
- `getDomainByUid(uid)` - Core domain + classification lookup
- `getDomainsByUniprot(acc)` - All domains for a UniProt accession
- `getDomainsByPdb(pdbId)` - All domains for a PDB entry
- `getClassificationHierarchy(fid, tid)` - Walk cluster hierarchy

The internal UI routes can continue to fetch additional data (Pfam, DrugDomain, ligands)
on top of these shared functions.

### Rate Limiting

Implement per-IP rate limiting in Next.js middleware for `/api/v1/` routes:

- 100 requests/minute per IP
- 1000 requests/hour per IP
- In-memory store (Map with TTL cleanup) -- sufficient for current traffic
- Return `429 Too Many Requests` with `Retry-After` header

This does not apply to internal UI routes (`/api/`) which are only called by the
website itself.

### CORS

Already handled by the Next.js middleware for all API routes.

### Request Logging

Optional. The existing FastAPI logs IP/path/duration/user-agent to a file. We could:

1. Rely on Apache access logs (already captured)
2. Add lightweight logging middleware for `/api/v1/` routes only

Recommendation: Start with Apache logs only. Add dedicated logging later if needed
for usage statistics or grant reporting.

## Documentation

### Approach

Add API documentation as a sub-section of the existing `/documentation` page, or as a
separate `/documentation/api` page if the content is substantial enough. Given the number
of endpoints and the desire for interactive examples, a separate page is likely better.

### Content

1. **Overview** - What the API provides, base URL, data source
2. **Authentication** - None required (public data)
3. **Rate Limits** - Policy and error responses
4. **Endpoints** - For each endpoint:
   - Method and URL
   - Path parameters
   - Response schema (with field descriptions)
   - Example request/response
   - Status codes
5. **Interactive Examples** - "Try it" forms that call the live API and display formatted
   JSON responses. Simple client-side fetch + pretty-print, no Swagger dependency.
6. **Client Examples** - Python and JavaScript code snippets
7. **Data Notes** - Domain types, classification hierarchy explanation, coverage

### Navigation

Add "API Reference" link to the documentation page table of contents, or to the main
site navigation if warranted.

## File Plan

New files:
```
src/lib/domain-queries.ts          - Shared domain query functions
src/app/api/v1/domains/uniprot/[acc]/route.ts
src/app/api/v1/domains/pdb/[pdbId]/route.ts
src/app/api/v1/domains/[uid]/route.ts
src/app/api/v1/domains/[uid]/pdb/route.ts
src/app/api/v1/domains/[uid]/fasta/route.ts
src/app/api/v1/health/route.ts
src/middleware.ts                   - Rate limiting for /api/v1/ (extend existing)
src/app/documentation/api/page.tsx  - API reference page
```

Modified files:
```
src/app/api/domain/[uid]/route.ts       - Refactor to use shared query functions
src/app/api/protein/[identifier]/route.ts - Refactor to use shared query functions
src/app/documentation/page.tsx          - Add link to API reference
```

## Implementation Order

1. **Extract shared query logic** into `src/lib/domain-queries.ts`
2. **Refactor existing internal routes** to use shared functions (verify nothing breaks)
3. **Implement v1 endpoints** using shared functions
4. **Add rate limiting middleware** for `/api/v1/`
5. **Build API documentation page** with interactive examples
6. **Update Apache proxy** to route `/ecod/api/` to the Next.js app
7. **Shut down FastAPI** on leda, archive `~/work/api/`

## Migration Checklist

- [ ] Shared query module extracted and tested
- [ ] Internal routes refactored (no regressions)
- [ ] v1 endpoints implemented and manually tested
- [ ] Rate limiting working
- [ ] API documentation page live
- [ ] Apache proxy updated
- [ ] FastAPI process stopped
- [ ] `~/work/api/` archived

## Open Questions

1. **`seqid_range` availability** - The FastAPI spec includes `seqid_range` and
   `unp_range` but the actual implementation hardcodes `seqid_range = range` and
   `unp_range = NULL`. Do we have real seqid/unp range data in the database, or should
   we just expose `range` (PDB range)?

2. **Batch endpoints** - Should we support batch lookups (e.g., POST with multiple
   UniProt accessions)? Not in scope for initial migration, but worth considering.

3. **Search via API** - The internal `/api/search` endpoint could be useful for
   programmatic users. Defer to a future iteration.

4. **Domain file coverage** - Pre-cut PDB files cover ~59% of domains, FASTA ~67%.
   The v1 file endpoints should document this and return clean 404s for missing files.
