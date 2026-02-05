# ECOD Database Schema Reference

**Database**: PostgreSQL
**Host**: `asteria:45000`
**Database Name**: `ecod_af2_pdb`
**Web User**: `ecodweb` (read-only)

---

## Core Tables

### domain

Primary table for all ECOD domains.

| Column | Type | Description |
|--------|------|-------------|
| `uid` | INTEGER | Unique identifier (primary key) |
| `ecod_domain_id` | VARCHAR | ECOD domain ID (e.g., `e1a1bA20`) |
| `f_id` | VARCHAR | Family ID in hierarchy |
| `t_id` | VARCHAR | Topology ID |
| `h_id` | VARCHAR | Homology ID |
| `x_id` | VARCHAR | X-group ID |
| `a_id` | VARCHAR | Architecture ID |
| `unp_acc` | VARCHAR | UniProt accession |
| `range` | VARCHAR | Domain range specification |
| `is_representative` | BOOLEAN | Whether domain is family representative |

### cluster

Hierarchical classification nodes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR | Cluster ID (e.g., `1.2.3`) |
| `parent_id` | VARCHAR | Parent cluster ID |
| `level` | CHAR(1) | Hierarchy level (A/X/H/T/F) |
| `name` | VARCHAR | Cluster name |
| `description` | TEXT | Extended description |
| `domain_count` | INTEGER | Number of domains |

### domain_pdb

Links domains to PDB experimental structures.

| Column | Type | Description |
|--------|------|-------------|
| `uid` | INTEGER | Domain UID (FK to domain) |
| `pdb_id` | CHAR(4) | PDB identifier |
| `chain_id` | VARCHAR | Chain identifier |
| `pdb_range` | VARCHAR | Range in PDB numbering |

### pdb_chain_info

Metadata about PDB chains.

| Column | Type | Description |
|--------|------|-------------|
| `pdb_id` | CHAR(4) | PDB identifier |
| `chain_id` | VARCHAR | Chain identifier |
| `entity_id` | INTEGER | Entity ID |
| `unp_acc` | VARCHAR | UniProt accession |
| `resolution` | FLOAT | Structure resolution (Å) |
| `method` | VARCHAR | Experimental method |
| `title` | TEXT | Structure title |
| `deposition_date` | DATE | PDB deposition date |

### unp_info

UniProt protein information.

| Column | Type | Description |
|--------|------|-------------|
| `unp_acc` | VARCHAR | UniProt accession (PK) |
| `unp_id` | VARCHAR | UniProt ID |
| `protein_name` | TEXT | Protein name |
| `gene_name` | VARCHAR | Gene name |
| `organism` | VARCHAR | Source organism |
| `tax_id` | INTEGER | NCBI taxonomy ID |
| `sequence` | TEXT | Amino acid sequence |
| `length` | INTEGER | Sequence length |

### special

Special domain categories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Special category ID |
| `name` | VARCHAR | Category name |
| `description` | TEXT | Category description |

---

## Key Views

### view_dom_clsrel_clsname

Main joined view for domain display with classification names.

```sql
-- Likely structure (inferred from usage)
SELECT
    d.uid,
    d.ecod_domain_id,
    d.range,
    d.unp_acc,
    c_f.id as f_id,
    c_f.name as f_name,
    c_t.id as t_id,
    c_t.name as t_name,
    c_h.id as h_id,
    c_h.name as h_name,
    c_x.id as x_id,
    c_x.name as x_name,
    c_a.id as a_id,
    c_a.name as a_name
FROM domain d
JOIN cluster c_f ON d.f_id = c_f.id
JOIN cluster c_t ON d.t_id = c_t.id
JOIN cluster c_h ON d.h_id = c_h.id
JOIN cluster c_x ON d.x_id = c_x.id
JOIN cluster c_a ON d.a_id = c_a.id;
```

### view_dom_clsrel_pdbinfo

Domain view with PDB structure information.

```sql
-- Likely structure (inferred from usage)
SELECT
    d.*,
    dp.pdb_id,
    dp.chain_id,
    dp.pdb_range,
    pci.resolution,
    pci.method,
    pci.title as pdb_title,
    pci.deposition_date
FROM domain d
JOIN domain_pdb dp ON d.uid = dp.uid
JOIN pdb_chain_info pci ON dp.pdb_id = pci.pdb_id
    AND dp.chain_id = pci.chain_id;
```

### view_dom_clsrel_csminfo

Domain view with computed structural model (AlphaFold) information.

```sql
-- Likely structure (inferred from usage)
SELECT
    d.*,
    csm.af_id,
    csm.version,
    csm.mean_plddt,
    u.protein_name,
    u.organism
FROM domain d
JOIN computed_structure_model csm ON d.uid = csm.uid
JOIN unp_info u ON d.unp_acc = u.unp_acc;
```

---

## Common Query Patterns

### Get domains for a cluster (with pagination)

```sql
SELECT
    uid,
    ecod_domain_id,
    unp_acc,
    range,
    COUNT(*) OVER() as total_count
FROM view_dom_clsrel_clsname
WHERE f_id = $1
ORDER BY ecod_domain_id
LIMIT 20 OFFSET $2;
```

### Get cluster children

```sql
SELECT
    id,
    name,
    level,
    domain_count
FROM cluster
WHERE parent_id = $1
ORDER BY id;
```

### Search by keyword (full-text)

```sql
SELECT
    uid,
    ecod_domain_id,
    ts_headline(name, plainto_tsquery($1)) as name_highlight
FROM view_dom_clsrel_clsname
WHERE to_tsvector('english', name || ' ' || description) @@ plainto_tsquery($1)
LIMIT 20;
```

### Get domain details by UID

```sql
SELECT *
FROM view_dom_clsrel_pdbinfo
WHERE uid = $1;

-- Or for computed models
SELECT *
FROM view_dom_clsrel_csminfo
WHERE uid = $1;
```

### Search by UniProt accession

```sql
SELECT uid, ecod_domain_id, f_name, range
FROM view_dom_clsrel_clsname
WHERE unp_acc = $1
ORDER BY ecod_domain_id;
```

### Search by PDB ID

```sql
SELECT
    d.uid,
    d.ecod_domain_id,
    dp.chain_id,
    dp.pdb_range
FROM domain d
JOIN domain_pdb dp ON d.uid = dp.uid
WHERE dp.pdb_id = $1
ORDER BY dp.chain_id, d.ecod_domain_id;
```

---

## Index Recommendations for NextJS App

Based on query patterns, ensure these indexes exist:

```sql
-- Primary lookups
CREATE INDEX idx_domain_uid ON domain(uid);
CREATE INDEX idx_domain_ecod_id ON domain(ecod_domain_id);
CREATE INDEX idx_domain_unp_acc ON domain(unp_acc);

-- Hierarchy navigation
CREATE INDEX idx_domain_f_id ON domain(f_id);
CREATE INDEX idx_cluster_parent ON cluster(parent_id);
CREATE INDEX idx_cluster_level ON cluster(level);

-- PDB lookups
CREATE INDEX idx_domain_pdb_pdb_id ON domain_pdb(pdb_id);
CREATE INDEX idx_domain_pdb_uid ON domain_pdb(uid);

-- Full-text search
CREATE INDEX idx_cluster_name_fts ON cluster USING gin(to_tsvector('english', name));
```

---

## Data Volume Estimates

| Table | Estimated Rows | Notes |
|-------|----------------|-------|
| domain | ~2-5 million | Growing with new structures |
| cluster | ~100,000 | Hierarchical nodes |
| domain_pdb | ~1-2 million | PDB-linked domains |
| unp_info | ~500,000 | UniProt entries |
| pdb_chain_info | ~1 million | PDB chain metadata |

---

## TypeScript Types (for Prisma/Drizzle)

```typescript
interface Domain {
  uid: number;
  ecodDomainId: string;
  fId: string;
  tId: string;
  hId: string;
  xId: string;
  aId: string;
  unpAcc: string | null;
  range: string;
  isRepresentative: boolean;
}

interface Cluster {
  id: string;
  parentId: string | null;
  level: 'A' | 'X' | 'H' | 'T' | 'F';
  name: string;
  description: string | null;
  domainCount: number;
}

interface DomainPdb {
  uid: number;
  pdbId: string;
  chainId: string;
  pdbRange: string;
}

interface PdbChainInfo {
  pdbId: string;
  chainId: string;
  entityId: number;
  unpAcc: string | null;
  resolution: number | null;
  method: string;
  title: string;
  depositionDate: Date;
}

interface UnpInfo {
  unpAcc: string;
  unpId: string;
  proteinName: string;
  geneName: string | null;
  organism: string;
  taxId: number;
  sequence: string;
  length: number;
}
```

---

*Schema documentation for ECOD NextJS/React migration*
