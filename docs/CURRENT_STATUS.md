# ECOD NextJS Frontend - Current Status

**Date**: 2026-02-05
**Status**: Near Feature-Complete Port

---

## Feature Comparison

### Implemented Features ✓

| Feature | Legacy PHP | NextJS | Notes |
|---------|------------|--------|-------|
| Home page with stats | ✓ | ✓ | Live stats from database |
| Tree navigation | ✓ | ✓ | Lazy-loading A→X→H→T→F→domains |
| Domain detail pages | ✓ | ✓ | Both PDB and AlphaFold domains |
| 3D structure viewer | JSmol | Mol* | Upgraded to modern PDBe Mol* |
| Basic search | ✓ | ✓ | Auto-detects UID, domain ID, PDB, UniProt, keyword |
| Advanced search | ✓ | ✓ | Taxonomy filtering |
| BLAST search | ✓ | ✓ | SLURM-based job queue |
| PDB file download | ✓ | ✓ | `/api/domain/[uid]/pdb` |
| FASTA download | ✓ | ✓ | `/api/domain/[uid]/fasta` |
| DrugDomain links | ✓ | ✓ | Links to DrugBank |
| Ligand display | ✓ | ✓ | Ligand residues highlighted in viewer |
| **Protein view** | partial | ✓ | **NEW** - All domains on a chain/protein |
| **PDB view** | ✗ | ✓ | **NEW** - Full structure with all domains colored |

### Pending Features

| Feature | Legacy PHP | NextJS | Priority |
|---------|------------|--------|----------|
| Distribution page | ✓ | stub | Medium |
| Documentation page | ✓ | stub | Low |
| Domain images | ✓ | ✗ | Medium |
| PyMOL script download | ✓ | ✗ | Low |
| **Foldseek search** | ✗ | ✓ | **Complete** |

---

## Database Utilization

### Tables In Use

| Table | Rows | Used By |
|-------|------|---------|
| `domain` | 31.4M | Domain pages, search, tree |
| `cluster` | 585K | Tree navigation, classification |
| `cluster_relation` | 51K | Hierarchy joins |
| `pdb_chain_info` | 2.6M | Chain names, protein view |
| `pdb_info` | 1.5M | PDB metadata |
| `unp_info` | 5.4M | UniProt names, links |
| `taxonomy` | 29K | Advanced search filtering |
| `domain_pdb` | 16M | PDB-domain mapping |
| `info` | 16 | Stats (version, counts) |

### Unused Tables (Potential Features)

| Table | Rows | Potential Use |
|-------|------|---------------|
| `fasta` | 22.8M | Faster sequence retrieval than filesystem |
| `f_id_pfam_acc` | 0 | Pfam↔ECOD mapping (empty!) |
| `ecod_drugbank_pdb` | 7.4M | DrugDomain data (accessed via views) |
| `ecod_drugbank_afdb` | 51K | AlphaFold DrugDomain |
| `sync_log` | 4 | Internal sync tracking |

### Database Views

| View | Purpose | Used |
|------|---------|------|
| `view_dom_clsrel_clsname` | Domain+cluster+taxonomy join | ✗ |
| `view_dom_clsrel_pdbinfo` | Domain+PDB info | ✗ |
| `view_dom_clsrel_csminfo` | Domain+AlphaFold info | ✗ |
| `view_dom_clsrel_clsname_tax` | With taxonomy | ✗ |

*Note: Views exist but we use direct JOINs in queries instead*

---

## API Endpoints

### Domain APIs
- `GET /api/domain/[uid]` - Domain details + classification
- `GET /api/domain/[uid]/pdb` - Pre-cut domain PDB file
- `GET /api/domain/[uid]/fasta` - Domain FASTA sequence

### Search APIs
- `GET /api/search?q=X&page=N` - Multi-type search
- `GET /api/search/advanced` - Taxonomy-filtered search
- `POST /api/blast/submit` - Submit BLAST job
- `GET /api/blast/[jobId]` - BLAST job status/results
- `POST /api/foldseek/submit` - Submit Foldseek structural search job
- `GET /api/foldseek/[jobId]` - Foldseek job status/results

### Structure APIs
- `GET /api/protein/[identifier]` - Chain/protein domains
- `GET /api/pdb/[pdbId]` - Full PDB structure domains

### Navigation APIs
- `GET /api/tree?parentId=X` - Tree children
- `GET /api/tree/domains?clusterId=X` - Cluster domain list
- `GET /api/stats` - Database statistics
- `GET /api/taxonomy?q=X` - Taxonomy search

---

## Low-Hanging Fruit

### 1. Domain Images (Medium effort)
Pre-rendered images exist at `/data/ECOD0/html/af2_pdb_d/{mid}/{uid}/`:
- `{uid}.png` - Domain only
- `{uid}_chain.png` - Chain context
- `{uid}_pdb.png` - Full PDB context

**Action**: Add `/api/domain/[uid]/image/[type]` endpoint

### 2. Distribution Page (Medium effort)
Need to implement:
- Version history from `info` table
- Links to bulk download files at `/usr1/ECOD/html/distributions/`
- Domain set statistics (F40, F70, F99)

### 3. Sequence from Database (Low effort)
The `fasta` table has 22.8M sequences. Could be faster than filesystem reads.

**Action**: Check if `/api/domain/[uid]/fasta` should query DB vs files

### 4. PyMOL Script Generation (Low effort)
Generate `.pml` scripts for domain visualization:
```python
load structure.pdb
select domain, chain A and resi 10-50
color red, domain
```

---

## Missing Data

### Empty Tables
- `f_id_pfam_acc` - Pfam mapping table is empty (0 rows)
  - Would be useful for "Related Pfam families" feature
  - Need to sync from source database

### Incomplete Data
- `ligand`/`ligand_pdbnum` - Only synced for ~564K domains
  - Full ligand data exists in source `ecod` database

---

## Architecture Notes

### File Paths
- Domain data: `/data/ECOD0/html/af2_pdb_d/{mid}/{padded_uid}/`
- Distributions: `/usr1/ECOD/html/distributions/`
- BLAST temp: `/tmp/blast-{jobId}/`

### Key Patterns
- UID padding: `uid.toString().padStart(9, '0')`
- Mid calculation: First 5 chars of padded UID
- Source ID format: `{pdb}_{chain}` (lowercase)
- Range format: `A:1-50,A:100-150`

### Technology Stack
- Next.js 16.1.6 with App Router
- React 19
- TypeScript
- Tailwind CSS
- PostgreSQL (via pg driver)
- PDBe Mol* 3.1.3 (3D viewer)
- SLURM (job queue for BLAST)

---

## Next Priority: Foldseek Structural Search

See `docs/FOLDSEEK_PLAN.md` for implementation details.
