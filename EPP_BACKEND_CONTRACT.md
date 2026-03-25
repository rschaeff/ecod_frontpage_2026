# EPP Backend Contract

EPP (ECOD Predicted Proteins) is a **sequence accession scheme** for predicted
proteins that have no UniProt or UniParc entry. It provides stable, citable
identifiers for sequences that exist in no authoritative database.

EPP is NOT a structure registry. Predicted structures (for EPP proteins, UniParc
sequences, or any other source) are managed by the separate predicted structures
system — see `PREDICTED_STRUCTURES_CONTRACT.md`.

## Connection

```
host: dione
port: 45000
database: ecod_protein
user: ecod
password: ***SCRUBBED***
schema: epp
```

## Table: `epp.proteins`

```
epp_id              SERIAL PRIMARY KEY
epp_accession       TEXT UNIQUE NOT NULL    -- 'EPP00000001'
sequence            TEXT NOT NULL           -- amino acid sequence
sequence_length     INTEGER NOT NULL
sequence_md5        TEXT NOT NULL           -- hex MD5 of sequence

project             TEXT NOT NULL           -- 'archaea_2026'
original_id         TEXT NOT NULL           -- 'ENA|JAEOSI010000027|JAEOSI010000027.1_5'
source              TEXT NOT NULL           -- 'Prodigal'
genome_accession    TEXT                    -- 'GCA_016840425.1'
contig_accession    TEXT                    -- 'JAEOSI010000027'
organism_name       TEXT                    -- 'Candidatus Wukongarchaeum yapensis'
phylum              TEXT                    -- 'Asgardarchaeota'
quality_tier        TEXT                    -- 'HIGH' or 'MEDIUM'

assigned_at         TIMESTAMPTZ
deprecated_at       TIMESTAMPTZ             -- NULL if active
superseded_by       TEXT                    -- new accession if deprecated
deprecation_reason  TEXT
```

29,326 rows. All currently `deprecated_at IS NULL` (active).

## Indexes

- `epp_accession` (unique) — primary lookup
- `sequence_md5` — reverse lookup by sequence
- `genome_accession` — browse by genome
- `original_id` — reverse lookup by internal ID
- `project` — filter by project
- Partial index on `epp_accession WHERE deprecated_at IS NULL`

## Scope

EPP accessions are assigned ONLY to proteins where:
1. The protein has no UniProt accession, AND
2. The protein has no UniParc accession, AND
3. We used this sequence as input to structure prediction

Proteins with UniProt or UniParc accessions use those identifiers — never EPP.
EPP is the accession of last resort.

## Queries for the API routes

### `GET /api/epp/[accession]` — single record

```sql
SELECT epp_id, epp_accession, sequence, sequence_length, sequence_md5,
       project, original_id, source,
       genome_accession, contig_accession, organism_name, phylum, quality_tier,
       assigned_at, deprecated_at, superseded_by, deprecation_reason
FROM epp.proteins
WHERE epp_accession = $1
```

The API response also includes a `structures` array queried from the predicted
structures registry (see `PREDICTED_STRUCTURES_CONTRACT.md`) using
`seq_source='epp'` and `seq_accession` = the EPP accession.

### `GET /api/epp/[accession]/fasta` — FASTA format

Same query, format response as:

```
>{epp_accession} {organism_name} | {genome_accession} | {source}
{sequence in 80-char lines}
```

Content-Type: `text/plain`

### `GET /api/epp/by-md5/[md5]` — reverse lookup

```sql
SELECT epp_accession, sequence_length, organism_name, phylum,
       CASE WHEN deprecated_at IS NULL THEN 'active' ELSE 'deprecated' END as status
FROM epp.proteins
WHERE sequence_md5 = $1
ORDER BY epp_id
```

Can return multiple rows (unlikely but possible if identical sequences from different contigs).

## External link construction

From the record fields, build these links for the response:

| Field | URL |
|-------|-----|
| `contig_accession` | `https://www.ebi.ac.uk/ena/browser/view/{contig_accession}` |
| `genome_accession` | `https://www.ncbi.nlm.nih.gov/datasets/genome/{genome_accession}` |
| `contig_accession` | `https://www.ncbi.nlm.nih.gov/nuccore/{contig_accession}` |

Only include links where the field is not NULL.

## Response JSON shape

### `GET /api/epp/[accession]`

```json
{
  "accession": "EPP00010092",
  "sequence": "MCKICG...",
  "sequenceLength": 97,
  "sequenceMd5": "a1b2c3...",
  "project": "archaea_2026",
  "provenance": {
    "originalId": "ENA|JAEOSI010000027|JAEOSI010000027.1_5",
    "source": "Prodigal",
    "genomeAccession": "GCA_016840425.1",
    "contigAccession": "JAEOSI010000027",
    "organismName": "Candidatus Wukongarchaeum yapensis",
    "phylum": "Asgardarchaeota",
    "qualityTier": "HIGH"
  },
  "status": "active",
  "assignedAt": "2026-03-19T22:05:00Z",
  "externalLinks": {
    "enaContig": "https://www.ebi.ac.uk/ena/browser/view/JAEOSI010000027",
    "ncbiAssembly": "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_016840425.1",
    "ncbiNuccore": "https://www.ncbi.nlm.nih.gov/nuccore/JAEOSI010000027"
  },
  "structures": []
}
```

The `structures` array is populated from the predicted structures registry.
See `PREDICTED_STRUCTURES_CONTRACT.md` for the structure response shape.

### Deprecated records

For deprecated records, add:

```json
{
  "status": "deprecated",
  "deprecation": {
    "date": "2026-06-15T00:00:00Z",
    "supersededBy": "Q9HPL2",
    "reason": "Accessioned in UniProt as Q9HPL2"
  }
}
```
