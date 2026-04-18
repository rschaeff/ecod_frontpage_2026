# Deficiency: Ligand Annotation Backlog for New Domains

## Summary

After the Phase 1 sync from `ecod.domain` → `ecod_af2_pdb.domain` on
2026-04-17, 564,341 experimental-structure domains have ligand data
populated. However, **~66,024 newer experimental-structure domains** in
`ecod_af2_pdb` were added after the last `ecod.domain` refresh and have
never been run through the ligand annotation pipeline. These domains will
display no ligand information in the frontend until annotated.

## Coverage Status (sangala, 2026-04-17)

| Dataset | Count |
|---|---|
| `ecod_af2_pdb.domain` experimental structures (active) | 1,146,444 |
| Currently populated with `ligand` / `ligand_pdbnum` | 564,341 |
| In `ecod.domain` but without ligand data (never computed) | ~516,000 |
| In `ecod_af2_pdb` but **not in `ecod.domain`** (newer, post-last-sync) | **66,024** |

The ~516K unannotated domains already present in `ecod.domain` may not
have ligands (annotator ran, found none within 4Å) — this is expected.
The 66K newer domains need the annotator to run at all.

## Pipeline (per `~/lib/ECOD/Update.pm`)

**Per-domain annotator:**
```
/data/ecod/database_versions/bin/single_annotate_ecod_ligand.pl <uid> <pdb> <seqid_range>
```

- Parses PDBML for non-polymer entities
- Computes 4Å contacts between domain residues and ligand atoms
- Writes output to:
  `/data/ecod/domain_data/{short_uid}/{uid}/{uid}.ligand_contact.txt`
- File format (one line): `<uid> <pdb> <seqid_range> <comp_ids_csv> <pdbnum_csv>`
  - Example: `002966532 7nu0 A:635-814 ATP,EDO A:1001,A:1002`
- If no contacts: first line is `# No ligand contacts found with ligand inclusion distance 4.0`

**Aggregate load** (in `Update.pm` `ligand_annotation` sub):
- Walks each domain's `.ligand_contact.txt`
- Adds `<ligand_str>` and `<ligand_pdbnum_str>` XML nodes to the ECOD master XML
- Separate load step pushes these into `ecod.domain.{ligand, ligand_pdbnum}`

## Recommended Fix

### Step 1: Enumerate the 66K newer domains
```sql
-- In ecod_af2_pdb, find experimental domains not yet in ecod
COPY (
  SELECT d.uid, d.source_id, d.range
  FROM domain d
  WHERE d.type = 'experimental structure'
    AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    AND d.ligand IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM dblink(...) ...
    )
) TO '/tmp/annotate_backlog.tsv';
```

(Or simpler: list the 66K UIDs already computed in `/tmp/drugdomain/` on
leda during Phase 1 prep.)

### Step 2: Run annotator on leda's SLURM cluster
Per CLAUDE.md: leda has an active SLURM cluster and parallel work should
use slurm, not head-node parallel invocations. Chunk the 66K UIDs into
SLURM array jobs. Each job processes N UIDs, invoking
`single_annotate_ecod_ligand.pl` for each.

Estimated runtime per domain: seconds (PDBML parse + coord distance).
Total wall time with modest parallelism (100 slots × 660 per slot):
probably under an hour.

### Step 3: Parse `.ligand_contact.txt` files → DB
After SLURM completes, scan the output files and load into
`ecod_af2_pdb.domain` directly, bypassing the XML roundtrip. Same pattern
as the Phase 1 sync: staging table + `UPDATE JOIN`.

### Step 4: Make this part of the regular pipeline
The recurrence of this drift — first documented in
`DEFICIENCY_LIGAND_DATA.md` on 2026-02-05 and re-emerged during the
asteria → sangala migration — indicates the `ecod_af2_pdb` refresh
pipeline needs to include ligand annotation as a standard step, not an
ad-hoc sync.

## Related

- `docs/DEFICIENCY_LIGAND_DATA.md` — original 2026-02-05 report documenting
  the first sync from `ecod.domain`
- `docs/DEFICIENCY_FASTA_HEADERS.md` — similar pipeline-refresh-drift issue
- `~/lib/ECOD/Update.pm` lines 2757–2856 — canonical annotation routines
- `/data/ecod/database_versions/bin/single_annotate_ecod_ligand.pl` —
  per-domain entry point

## Affected Systems

- Ligand display in frontend domain/PDB pages (silent gap for 66K domains)
- Any tool querying `ecod_af2_pdb.domain.ligand` expects complete coverage
- Drug-ligand cross-reference analyses may undercount contacts

## Notes

- Must run the annotator on **sangala** or leda — requires local access to
  `/data/ecod/domain_data/` (output path) and PDBml files
- The Perl dependency stack (`~/lib/Domains::Range`, `Domains::PDBml`,
  `XML::LibXML`) needs to be present on the compute node
