# Predicted Structures Registry — Backend Contract

A source-agnostic registry for predicted protein structures. Structures are keyed
by the sequence's authoritative accession (EPP, UniParc, UniProt) and the
prediction method, independent of any one accession scheme.

## Design rationale

Structure prediction is orthogonal to sequence accession. We store structures
for proteins from multiple sources and multiple prediction pipelines:

| Source | Accession format | Example | Has own sequence record? |
|--------|-----------------|---------|--------------------------|
| EPP | `EPP00000001` | Prodigal ORFs with no public record | Yes (`epp.proteins`) |
| UniParc | `UPI0000000001` | Sequences with UniParc but no UniProt | No (external) |
| UniProt | `P00519` | Proteins with full UniProt entries | No (external) |

We also store structures we did not predict ourselves (e.g., AFDB downloads).
The `project` column distinguishes our predictions from external sources.

EPP is a sequence accession scheme (see `EPP_BACKEND_CONTRACT.md`). This registry
is a structure storage system. They are independent: an EPP protein may or may not
have a predicted structure, and a predicted structure may or may not come from an
EPP protein.

## Connection

Same database as EPP:

```
host: dione
port: 45000
database: ecod_protein
user: ecod
password: ***SCRUBBED***
schema: predicted_struct
```

## Schema: `predicted_struct`

Dedicated schema for predicted structure metadata. Separate from `epp` (sequence
accessions) and `ecod_commons` (ECOD classification) to maintain orthogonality.

## Table: `predicted_struct.structures`

### DDL

```sql
CREATE SCHEMA predicted_struct;

CREATE TABLE predicted_struct.structures (
    structure_id    SERIAL PRIMARY KEY,
    seq_source      TEXT NOT NULL,                  -- 'epp', 'uniparc', 'uniprot'
    seq_accession   TEXT NOT NULL,                  -- 'EPP00010092', 'UPI000000001A', 'P00519'
    method          TEXT NOT NULL,                  -- 'alphafold2', 'alphafold3', 'esmfold', 'colabfold'
    method_version  TEXT,                           -- 'v1', 'v2.3', etc.
    format          TEXT NOT NULL DEFAULT 'cif',    -- 'pdb' or 'cif'
    cif_path        TEXT,                           -- absolute path to structure file on disk
    pae_path        TEXT,                           -- absolute path to PAE JSON
    mean_plddt      REAL,                           -- average per-residue pLDDT (0-100)
    ptm_score       REAL,                           -- pTM score (ColabFold/AF only)
    file_size_bytes INTEGER,
    project         TEXT,                           -- provenance: who produced this structure
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE (seq_source, seq_accession, method)
);

CREATE INDEX idx_ps_source_acc ON predicted_struct.structures(seq_source, seq_accession);
CREATE INDEX idx_ps_accession ON predicted_struct.structures(seq_accession);
CREATE INDEX idx_ps_method ON predicted_struct.structures(method);
CREATE INDEX idx_ps_project ON predicted_struct.structures(project);
```

### Column notes

| Column | Notes |
|--------|-------|
| `seq_source` | Lowercase source type. Values: `epp`, `uniparc`, `uniprot`. Determines how to link back to the sequence record. |
| `seq_accession` | The accession in the source database. Case-sensitive. For EPP: `EPP########`. For UniParc: `UPI##########`. For UniProt: standard accession. |
| `method` | Lowercase prediction method. Current values: `alphafold2`, `alphafold3`, `esmfold`, `colabfold`. |
| `method_version` | Free text version string. NULL if unknown. |
| `format` | File format on disk: `pdb` or `cif`. Determines Content-Type when served. |
| `cif_path` | Absolute filesystem path to the structure file. Files live in pipeline output directories (not a separate sharded tree). |
| `pae_path` | Absolute path to the PAE (predicted aligned error) JSON. NULL if not available (e.g., AFDB v6 PAEs, AlphaFold 3 confidence files). |
| `mean_plddt` | Mean of per-residue pLDDT scores. Extracted from B-factor column (PDB) or CIF _ma_qa_metric_global (mmCIF). |
| `ptm_score` | Predicted TM-score. Available from ColabFold and AlphaFold, not ESMFold. |
| `file_size_bytes` | Size of the structure file on disk. NULL if not yet computed. |
| `project` | Provenance: which pipeline or source produced this structure. See below. |

### `project` column: provenance tracking

The `project` column distinguishes who produced a structure:

| `project` | `method` | Meaning |
|-----------|----------|---------|
| `archaea_2026` | `alphafold3` | Our AF3 predictions for the archaea project |
| `afdb_v6` | `alphafold2` | Downloaded from AlphaFold Database v6 (EBI) |

Future projects would add rows like `bacteria_2027` (our predictions) or
`afdb_v7` (a new AFDB release). The same protein can have structures from
multiple methods and multiple projects.

### Why `cif_path` instead of derived paths?

Structure files live in pipeline output directories with their own naming
conventions (e.g., `/data/ecod/archaea/structures/af3_tier1/.../..._model.cif`).
Storing the actual path avoids maintaining a parallel sharded directory tree and
keeps files in place where pipeline tools expect them.

## Current contents

194,053 structures (as of 2026-03-24):

| `seq_source` | `method` | `project` | Count | Avg pLDDT |
|---|---|---|---|---|
| epp | alphafold3 | archaea_2026 | 28,287 | 83.3 |
| uniparc | alphafold2 | afdb_v6 | 22,512 | 83.0 |
| uniparc | alphafold3 | archaea_2026 | 44,519 | 82.2 |
| uniprot | alphafold2 | afdb_v6 | 49,350 | 85.5 |
| uniprot | alphafold3 | archaea_2026 | 49,385 | 85.5 |

71,862 proteins have both AF2 (AFDB) and AF3 (our prediction) structures.

## API routes

### `GET /api/structures/[source]/[accession]` — list structures

Returns all predicted structures for a sequence, ordered by confidence.

```sql
SELECT method, method_version, format, mean_plddt, ptm_score, file_size_bytes,
       project, (pae_path IS NOT NULL) as has_pae
FROM predicted_struct.structures
WHERE seq_source = $1 AND seq_accession = $2
ORDER BY mean_plddt DESC NULLS LAST
```

**Response:**

```json
{
  "seqSource": "uniparc",
  "seqAccession": "UPI000000001A",
  "structures": [
    {
      "method": "alphafold3",
      "methodVersion": null,
      "format": "cif",
      "meanPlddt": 87.4,
      "ptmScore": 0.874,
      "fileSizeBytes": 52100,
      "project": "archaea_2026",
      "hasPae": true,
      "downloadUrl": "/api/structures/uniparc/UPI000000001A/download?method=alphafold3"
    },
    {
      "method": "alphafold2",
      "methodVersion": null,
      "format": "cif",
      "meanPlddt": 85.1,
      "ptmScore": null,
      "fileSizeBytes": 48200,
      "project": "afdb_v6",
      "hasPae": true,
      "downloadUrl": "/api/structures/uniparc/UPI000000001A/download?method=alphafold2"
    }
  ]
}
```

### `GET /api/structures/[source]/[accession]/download?method=X` — file download

Serves the structure file. If `?method=` is omitted, serves the best available
(highest mean_plddt).

```sql
SELECT cif_path, format, method
FROM predicted_struct.structures
WHERE seq_source = $1 AND seq_accession = $2
  AND ($3 IS NULL OR method = $3)
ORDER BY mean_plddt DESC NULLS LAST
LIMIT 1
```

Content-Type: `chemical/x-cif` (CIF) or `chemical/x-pdb` (PDB).

### Backward compatibility: `GET /api/epp/[accession]/structure`

The EPP structure endpoint queries `predicted_struct.structures` with
`seq_source='epp'` internally.

## Consuming from other pages

### EPP detail page (`/epp/[accession]`)

The `structures` array in the EPP API response is populated from
`predicted_struct.structures WHERE seq_source='epp'`.

### Domain detail page (`/domain/[uid]`)

For domains on proteins with predicted structures (EPP or UniParc), the domain
page can optionally show or link to the predicted full-length structure. This
requires knowing the `seq_source` and `seq_accession`:

- EPP domains: `source_id` matches `EPP########` -> `seq_source='epp'`
- UniParc domains: `source_id` matches `UPI##########` -> `seq_source='uniparc'`
- UniProt domains: standard accession -> `seq_source='uniprot'`

### Protein page (`/protein/[identifier]`)

For any identifier, the protein page can check `predicted_struct.structures` for
available structures and show a viewer or download link.

## Population

### Adding new structures

```sql
INSERT INTO predicted_struct.structures
    (seq_source, seq_accession, method, format, cif_path, pae_path,
     mean_plddt, ptm_score, project)
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (seq_source, seq_accession, method) DO UPDATE SET
    cif_path = EXCLUDED.cif_path,
    pae_path = EXCLUDED.pae_path,
    mean_plddt = EXCLUDED.mean_plddt,
    ptm_score = EXCLUDED.ptm_score,
    file_size_bytes = EXCLUDED.file_size_bytes,
    project = EXCLUDED.project,
    created_at = now();
```

### Verification

```sql
SELECT seq_source, method, project, COUNT(*),
       ROUND(AVG(mean_plddt)::numeric, 1) as avg_plddt,
       COUNT(*) FILTER (WHERE pae_path IS NOT NULL) as with_pae
FROM predicted_struct.structures
GROUP BY seq_source, method, project
ORDER BY seq_source, method;
```

## Migration history

- **2026-03-24**: Created `predicted_struct` schema. Populated from
  `epp.structures` (28,287 AF3 rows) + `archaea.target_proteins` (UniParc:
  44,519 AF3 + 22,512 AF2; UniProt: 49,385 AF3 + 49,350 AF2). Dropped
  `epp.structures`.

## Implementation sequence

1. ~~Create table~~ Done (2026-03-24)
2. ~~Migrate data from `epp.structures`~~ Done
3. ~~Populate UniParc and UniProt structures~~ Done
4. ~~Populate AFDB structures~~ Done
5. ~~Drop `epp.structures`~~ Done
6. **Update frontend code** — Change `epp-db.ts` to query `predicted_struct.structures`
   instead of `epp.structures`. The API response shape stays identical.
7. **Add new API routes** — `GET /api/structures/[source]/[accession]` and
   `/download` for the general-purpose endpoints.
8. **Wire up viewers** — Mol* viewer on EPP, domain, and protein pages.

## Environment variables

None required. File paths are stored in `cif_path`/`pae_path` columns directly.
