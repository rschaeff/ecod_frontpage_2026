# Plan: Stable Schema for Ligand & Drug Data

## Background

Ligand and drug-association data currently lives in three disconnected places,
each loaded by an ad-hoc process:

1. **`domain.ligand` / `domain.ligand_pdbnum`** (TEXT, comma-joined)
   — populated by running `single_annotate_ecod_ligand.pl` per domain, which
   writes `.ligand_contact.txt` text files under `/data/ecod/domain_data/`,
   then a Perl aggregator inlines them as XML nodes and a SQL loader unpacks
   the XML back into two CSV columns. Runs on `ecod.domain`, syncs to
   `ecod_af2_pdb.domain` via a manual one-shot UPDATE JOIN
   (see `DEFICIENCY_LIGAND_DATA.md`, `DEFICIENCY_LIGAND_ANNOTATION_BACKLOG.md`).
2. **`ecod_drugbank_pdb` / `ecod_drugbank_afdb`** — loaded by
   `~/work/drugdomain_ecod_update/drugdomain_updater.py` from TSV drops
   (`drugdomain_known_pdb_for_ecod_v292_0.txt`, etc.) produced offline by the
   DrugDomain group at UCF. File format has no PDB residue numbers and no
   contact distances; it's a domain↔DrugBank mapping with a `Ligand_PDB`
   3-letter code column.
3. **Nowhere** — PDB-level ligand inventory (what ligands exist in
   `1j4r`, independent of any ECOD domain) is never stored. Consumers who
   need it today re-parse PDBml on demand.

This is fragile: coverage drifts each refresh, the CSV columns lose the
distinction between "annotator ran and found nothing" vs. "annotator never
ran," residue-level context (chain, seqid) is only available for the ECOD
subset, and DrugBank/DrugDomain linkage has to re-derive the comp_id ↔ uid
join on every refresh.

## Goal

Replace the text-file + two-CSV-column + separate-drugbank-table layout with
a normalized schema in `ecod_af2_pdb` that:

- Stores a **PDB-level ligand inventory** independently of ECOD
  (so PDB pages can show ligands for chains/entries with no annotated
  domain yet, and the domain annotator consumes an already-parsed table).
- Stores **domain↔ligand contacts** as first-class rows with residue-level
  detail and provenance, not a CSV string.
- Stores a **ligand compound dictionary** (3-letter chem comp ID → name,
  formula, type) once, cross-referenced to DrugBank.
- Records **annotation status per domain** so "no ligands" is distinguishable
  from "never annotated."
- Is populated as a step in the regular `pdb_update_2026` sync, not
  out-of-band.

## Proposed Schema

All tables in `ecod_af2_pdb`. Names follow existing convention
(`ecod_drugbank_pdb` etc.).

### `ligand_compound` — canonical dictionary
One row per PDB chemical component ID.
```sql
CREATE TABLE ligand_compound (
  comp_id       VARCHAR(5) PRIMARY KEY,        -- PDB 3-letter code (HET code), e.g. 'ATP'
  name          TEXT,                          -- "ADENOSINE-5'-TRIPHOSPHATE"
  formula       TEXT,                          -- "C10 H16 N5 O13 P3"
  type          VARCHAR(32),                   -- NON-POLYMER / L-PEPTIDE LINKING / etc. (chem_comp.type)
  is_cofactor   BOOLEAN DEFAULT FALSE,         -- curated flag (ATP, NAD, FAD, heme, metals...)
  is_buffer     BOOLEAN DEFAULT FALSE,         -- EDO, GOL, PEG, SO4, etc. — common crystallization junk
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```
Loaded once from the PDB Chemical Component Dictionary (CCD), refreshed on each sync.

### `drugdomain_annotation` — DrugBank / DrugDomain cross-reference
One row per (unp_acc, drugbank_acc) pair from a DrugDomain release.
```sql
CREATE TABLE drugdomain_annotation (
  unp_acc           VARCHAR(16) NOT NULL,
  drugbank_acc      VARCHAR(16) NOT NULL,
  comp_id           VARCHAR(5)  REFERENCES ligand_compound(comp_id),   -- NULL when DrugDomain reports "n/a"
  drugdomain_link   TEXT        NOT NULL,      -- stored verbatim — URL format varies by version and by whether comp_id is known
  drugdomain_version VARCHAR(16) NOT NULL,     -- e.g. 'v2.0'
  ecod_version      VARCHAR(16) NOT NULL,      -- e.g. 'v292' — DrugDomain releases are pinned to an ECOD version
  loaded_at         TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (unp_acc, drugbank_acc, drugdomain_version)
);
CREATE INDEX idx_dda_comp ON drugdomain_annotation(comp_id) WHERE comp_id IS NOT NULL;
CREATE INDEX idx_dda_unp  ON drugdomain_annotation(unp_acc);
```
Key points that drove this shape (vs. the earlier `(comp_id, drugbank_acc)` draft):
- The `drugdomain_link` URL is `{unp_acc}_{identifier}.html` — it varies
  by UniProt, and the identifier is sometimes the DrugBank ID and
  sometimes the 3-letter comp_id. Not a pure function of
  `(comp_id, drugbank_acc)`. Store the link verbatim; do not regenerate.
- Some DrugDomain rows have `comp_id = 'n/a'` (predicted/unmapped
  binding), so `comp_id` must be nullable.
- Each DrugDomain release is pinned to one ECOD version; when our ECOD
  version moves past theirs, stale rows must be identifiable by
  `ecod_version`. Keeping `drugdomain_version` in the PK lets us
  stage-load a new release before cutting over.

**Deriving the domain↔drug mapping**: join
`domain → drugdomain_annotation` on `unp_acc`, optionally narrowed by
`comp_id` via `domain_ligand_contact → pdb_ligand_instance`. This
replaces the denormalized per-UID rows in `ecod_drugbank_pdb`.

### `pdb_ligand_instance` — PDB-level inventory
One row per ligand atom group in a PDB entry. PDB-level — no ECOD coupling.
```sql
CREATE TABLE pdb_ligand_instance (
  id            BIGSERIAL PRIMARY KEY,
  pdb_id        CHAR(4) NOT NULL,
  chain_id      VARCHAR(4) NOT NULL,           -- author_asym_id
  pdbnum        INTEGER NOT NULL,              -- author_seq_id
  ins_code      CHAR(1),                       -- insertion code (rare but real)
  comp_id       VARCHAR(5) NOT NULL REFERENCES ligand_compound(comp_id),
  entity_id     INTEGER,                       -- PDBml entity
  UNIQUE (pdb_id, chain_id, pdbnum, ins_code, comp_id)
);
CREATE INDEX idx_pli_pdb ON pdb_ligand_instance(pdb_id);
CREATE INDEX idx_pli_comp ON pdb_ligand_instance(comp_id);
```
Populated by parsing PDBml once per PDB entry during the `pdb_update_2026`
refresh. Cheap — one pass over non-polymer `_atom_site` groups.

### `domain_ligand_contact` — domain↔ligand edge
One row per (domain, ligand instance) pair within the 4 Å cutoff.
```sql
CREATE TABLE domain_ligand_contact (
  uid           INTEGER NOT NULL REFERENCES domain(uid) ON DELETE CASCADE,
  instance_id   BIGINT  NOT NULL REFERENCES pdb_ligand_instance(id) ON DELETE CASCADE,
  min_dist_ang  REAL,                          -- optional: min heavy-atom distance; useful for ranking
  computed_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (uid, instance_id)
);
CREATE INDEX idx_dlc_uid ON domain_ligand_contact(uid);
```
Populated per-domain by the annotator. Replaces the CSV columns.

### `domain_ligand_status` — annotation provenance
One row per domain that has been considered by the annotator.
```sql
CREATE TABLE domain_ligand_status (
  uid             INTEGER PRIMARY KEY REFERENCES domain(uid) ON DELETE CASCADE,
  annotated_at    TIMESTAMPTZ NOT NULL,
  annotator_ver   VARCHAR(16) NOT NULL,        -- e.g. 'py-annotate-1.0'
  cutoff_angstrom REAL NOT NULL DEFAULT 4.0,
  n_contacts      INTEGER NOT NULL             -- 0 = ran and found nothing
);
```
Distinguishes "ran, no ligands" from "never ran." Drives the backlog query:
`WHERE uid NOT IN (SELECT uid FROM domain_ligand_status)`.

### Compatibility view
Keeps existing callers working while consumers migrate:
```sql
CREATE VIEW v_domain_ligand_legacy AS
SELECT d.uid,
       string_agg(DISTINCT li.comp_id, ',' ORDER BY li.comp_id) AS ligand,
       string_agg(li.chain_id || ':' || li.pdbnum, ',' ORDER BY li.chain_id, li.pdbnum) AS ligand_pdbnum
FROM domain d
LEFT JOIN domain_ligand_contact dlc ON dlc.uid = d.uid
LEFT JOIN pdb_ligand_instance   li  ON li.id = dlc.instance_id
GROUP BY d.uid;
```

## Retirement Path for Old Artifacts

| Old | Replaced by | When to remove |
|---|---|---|
| `domain.ligand` (TEXT) | `domain_ligand_contact` + view | After frontend cuts over; keep ≥1 release |
| `domain.ligand_pdbnum` (TEXT) | same | same |
| `.ligand_contact.txt` files under `/data/ecod/domain_data/` | annotator writes direct to staging table | After new annotator is default |
| `ecod_drugbank_pdb.{ligand_pdb, drugbank_acc, drugdomain_link}` | join: `domain × drugdomain_annotation` on `unp_acc`, optionally narrowed by `comp_id` via `domain_ligand_contact` | After DrugDomain loader rewritten |
| `ecod_drugbank_afdb` | deferred — feed from `DrugDomain_v*_data_AlphaFill.txt` into a separate `predicted_ligand_instance` table (see Follow-ups) | Defer — out of scope for this plan |

## Pipeline Integration

Fold into `~/work/pdb_update_2026/` as a standard step (not an ad-hoc
follow-up). Ordering:

1. **Refresh CCD** → upsert `ligand_compound` from
   `components.cif.gz`. One pass, ~40K rows.
2. **Per new/updated PDB entry**: parse PDBml once, upsert rows into
   `pdb_ligand_instance` keyed on `(pdb_id, chain_id, pdbnum, comp_id)`.
   Delete instances for entries that went obsolete.
3. **Per new/updated domain**: compute 4 Å contacts against
   `pdb_ligand_instance` rows for that `pdb_id`. Replace the Perl
   `single_annotate_ecod_ligand.pl` with a Python script that writes
   directly to `domain_ligand_contact` + `domain_ligand_status`.
   Dispatch on SLURM array jobs (per CLAUDE.md).
4. **Refresh DrugDomain cross-ref** → fetch the latest
   `DrugDomain_v{N}_data_PDBs_ECODv{M}.txt` from
   `https://drugdomain.cs.ucf.edu/download/` (canonical public source,
   replaces Kirill's ad-hoc file drops in `~/work/drugdomain_ecod_update/`).
   Stage-load into `drugdomain_annotation` keyed by
   `(unp_acc, drugbank_acc, drugdomain_version)`. Keep a filesystem
   fallback path so the pipeline works offline / during upstream outages.
   DrugDomain releases are pinned to an ECOD version (v2.0 → ECODv292);
   when our ECOD version moves ahead, annotations are correctly tagged
   as stale rather than silently wrong — UI can show "drug annotations
   last refreshed for ECOD v292".

Every step is idempotent (upsert semantics). A re-run with no new PDB/no new
domains is a no-op.

## Migration Steps (ordered, reversible)

1. **Create new tables** alongside existing ones — no drops yet.
2. **Backfill `ligand_compound`** from CCD.
3. **Backfill `pdb_ligand_instance`** by parsing PDBml for every entry in
   `pdb_chain_info` (~200K structures, SLURM array, hours).
4. **Backfill `domain_ligand_contact`** by:
   - Reparsing existing `.ligand_contact.txt` files under
     `/data/ecod/domain_data/` → fast, avoids recomputing the 564K already done.
   - Running the new annotator on the 66K backlog per
     `DEFICIENCY_LIGAND_ANNOTATION_BACKLOG.md`.
   - Running on all ~516K "no ligand data" domains to populate
     `domain_ligand_status` with `n_contacts = 0` so future queries can
     trust the status table.
5. **Backfill `drugdomain_annotation`** by fetching the latest
   `DrugDomain_v2.0_data_PDBs_ECODv292.txt` from
   `https://drugdomain.cs.ucf.edu/download/` and parsing its 7-column
   TSV (UID, Domain_id, PDB, UniProt, DrugBank, Ligand_PDB,
   DrugDomain_link). Tag every row with
   `drugdomain_version='v2.0'`, `ecod_version='v292'`. Existing
   `ecod_drugbank_pdb` contents can be discarded — the website is the
   source of truth and has broader coverage (174K structures,
   7.5K drugs per v2.0 release notes).
6. **Create compatibility view** `v_domain_ligand_legacy`.
7. **Migrate readers** (frontend `/api/domain/[uid]`, `/api/pdb/[pdbId]`,
   viewer code) from CSV columns to the new tables. Add a PDB-level
   ligand endpoint that was previously impossible.
8. **Deprecate** `domain.ligand` / `domain.ligand_pdbnum` — leave columns
   in place, stop writing them, drop in a later release once downstream
   (e.g. legacy PHP `/complete`) is off them.
9. **Rewrite `drugdomain_updater.py`** to fetch from the DrugDomain
   website, load `drugdomain_annotation` only; drop per-UID rows from
   `ecod_drugbank_pdb` (the `unp_acc` join replaces them). Move the
   script into `pdb_update_2026/` so it's part of the pipeline rather
   than a manual tool.

## Design Decisions (was "Open Questions")

1. **Metals** (Mg, Zn, Ca, Fe, ...): store in `pdb_ligand_instance` like
   any other non-polymer. Add `is_metal BOOLEAN` on `ligand_compound`
   derived at CCD load time (single-atom formula or curated ~30-code
   list). UI groups/sorts on the flag; annotator is indifferent.
2. **Buffer / cryoprotectant ligands** (EDO, GOL, PEG, SO4, TRS, HEPES,
   MPD, MES, DMS, ...): curated allowlist (~50 comp_ids) flagged
   `is_buffer=true`. List lives in a versioned SQL seed file. UI hides
   by default behind a toggle. Don't auto-detect — the line is fuzzy
   (acetate, glycerol, sulfate are sometimes real substrates).
3. **`min_dist_angstrom`**: add it. The annotator already computes the
   distance to decide 4 Å inclusion; ~8 MB total storage; unlocks
   distance-ranked display and post-hoc stricter filtering without
   reannotation.
4. **Residue- vs entity-level grain**: store at residue grain (one row
   per `(chain, pdbnum, comp_id)`). Matches viewer selection semantics
   and the existing `ligand_pdbnum` CSV layout. `entity_id` is on the
   row, so entity-level counts are a `COUNT(DISTINCT entity_id)` away.
5. **Source of truth for DrugDomain**: the public download endpoint at
   `https://drugdomain.cs.ucf.edu/download/`, not Kirill's file drops
   into `~/work/drugdomain_ecod_update/`. Pipeline fetches the URL;
   filesystem path is a fallback. This frees us from Kirill's release
   cadence.
6. **Staleness across ECOD versions**: DrugDomain releases are pinned
   to an ECOD version (v2.0 → ECODv292). `drugdomain_annotation` carries
   `drugdomain_version` and `ecod_version` columns so stale rows are
   identifiable and UI can disclose the lag rather than silently serve
   mismatched data. Do not attempt to re-derive DrugDomain locally.
7. **URL storage**: store `drugdomain_link` verbatim. The URL format is
   `{unp_acc}_{identifier}.html` where the identifier is sometimes the
   DrugBank ID and sometimes the 3-letter `comp_id`, and the host
   changed between v1 (`prodata.swmed.edu`) and v2
   (`drugdomain.cs.ucf.edu`). Not a pure function of
   `(comp_id, drugbank_acc)` — keying the annotation table on
   `(unp_acc, drugbank_acc)` reflects the real grain.

## Follow-ups (out of scope for this plan)

- **AF-side predicted contacts**. DrugDomain publishes
  `DrugDomain_v1.0_data_AlphaFill.txt` — AlphaFill transplants small
  molecules from homologous PDBs onto AF models. When we pick this up,
  it lands in a separate `predicted_ligand_instance` table with
  `source` + `confidence` columns, fed by the same website-fetch
  plumbing. Keep `ecod_drugbank_afdb` untouched until then.
- **PTM data**. The DrugDomain site publishes
  `AllPTMs_per_residue_with_ligs.txt` and two PDB/AlphaFill PTM files
  — post-translational modifications associated with ligand binding
  sites. Separate data class (residue × modification × ligand
  proximity), deserves its own schema. Same ingest plumbing applies.

## Affected Code

- `~/work/pdb_update_2026/` — add ligand steps to refresh pipeline.
- `~/work/drugdomain_ecod_update/drugdomain_updater.py` — rewrite target.
- `/data/ecod/database_versions/bin/single_annotate_ecod_ligand.pl` —
  replaced by Python annotator writing direct to DB.
- `~/lib/ECOD/Update.pm` (`ligand_annotation` sub, lines 2757–2856) —
  the XML-roundtrip aggregator is no longer needed.
- Frontend readers that currently split CSV strings — grep for
  `ligand.split` / `ligand_pdbnum` in `ecod_frontpage_2026/src/`.

## Related Docs
- `DEFICIENCY_LIGAND_DATA.md` — original 2026-02-05 sync report
- `DEFICIENCY_LIGAND_ANNOTATION_BACKLOG.md` — 66K-domain backlog report
- `DEFICIENCY_FASTA_HEADERS.md` — same class of pipeline-refresh-drift issue
