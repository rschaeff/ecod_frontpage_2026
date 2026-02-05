# Deficiency Report: Ligand Data Not Synced to af2_pdb Database

## Summary
The `ecod_af2_pdb` database was missing ligand residue data (`ligand` and `ligand_pdbnum` columns) that exists in the canonical `ecod` database. This prevented visualization of domain-associated ligands/cofactors in the new frontend.

## Background
The legacy PHP site (`/complete`) queries `ecod.domain` which contains:
- `ligand`: 3-letter PDB ligand codes (e.g., "F6F,NA,PLP")
- `ligand_pdbnum`: Chain:residue format for selection (e.g., "B:401,B:402,B:404")

This data enables Jmol/Mol* to highlight specific ligand atoms near domains using residue number selections.

## Problem
The `ecod_af2_pdb` database (used by the new NextJS frontend) did not have these columns. The DrugBank aggregate tables (`ecod_drugbank_pdb_agg`) only contain:
- `ligand_pdb`: 3-letter codes without residue information

This is insufficient for precise visualization - you can select all instances of a ligand type, but not the specific residues associated with a domain.

## Temporary Fix Applied (2026-02-05)
Ad-hoc sync performed:
```sql
-- Added columns to ecod_af2_pdb.domain
ALTER TABLE domain ADD COLUMN ligand TEXT;
ALTER TABLE domain ADD COLUMN ligand_pdbnum TEXT;

-- Synced from ecod.domain (565,907 rows exported, 564,401 matched)
UPDATE domain d SET
  ligand = li.ligand,
  ligand_pdbnum = li.ligand_pdbnum
FROM ligand_import li
WHERE d.uid = li.uid;
```

## Root Cause
The database update pipeline that populates `ecod_af2_pdb` from source data does not include ligand information. The ligand association is computed separately (by distance measure) and stored only in `ecod.domain`.

## Recommended Permanent Fix
1. **Source of Truth**: Determine where ligand-domain associations should be computed/stored
   - Currently computed for `ecod.domain` but not `ecod_af2_pdb.domain`

2. **Pipeline Update**: Add ligand columns to the database sync/update scripts:
   - Location: `~/work/2025_pdb_update/prod_sync/` or equivalent
   - Ensure new domains get ligand associations computed

3. **Consider Unification**: The split between `ecod` and `ecod_af2_pdb` databases creates data drift
   - AlphaFold domains in `ecod_af2_pdb` may never get ligand data (no PDB structures)
   - PDB domains exist in both databases but only `ecod` has complete annotations

## Data Statistics
- Total domains in `ecod_af2_pdb`: ~4.2M (1.1M PDB + 3.1M AlphaFold)
- Domains with ligand data in `ecod.domain`: 565,907
- Domains synced to `ecod_af2_pdb.domain`: 564,401
- Gap: ~1,500 domains (likely obsolete or mismatched UIDs)

## Files Affected
- Database: `asteria:45000/ecod_af2_pdb` - `domain` table
- Frontend: Viewer and API need updates to use this data (separate task)

## Related
- DrugDomain integration uses `ecod_drugbank_pdb_agg.ligand_pdb` for ligand codes
- Visualization requires `ligand_pdbnum` for residue-level selection
