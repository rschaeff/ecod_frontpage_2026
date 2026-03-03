# Deficiency: Pre-cut Domain PDB Residue Ordering

## Summary

Pre-cut domain PDB files have incorrect residue ordering when the domain
range contains PDB insertion codes listed before canonical residues. This
causes Mol* (and likely other structure viewers) to draw incorrect backbone
traces between spatially distant residues.

## Example

**Domain**: e3qvcA1 (UID 185495), PDB 3qvc chain A

**Range definitions**:
- `ecod_commons.domain_ranges`: `A:77P-119P,A:2-328` (range_type=pdb, source=ecod_rep)
- `ecod_commons.domains.range_definition`: `A:77-451` (seqres numbering)

**Problem**: The pre-cut PDB file at
`af2_pdb_d/01854/000185495/000185495.pdb` contains residues in range-segment
order:

```
A 77P → A 78P → ... → A 119P → A 2 → A 3 → ... → A 328
```

Residues 77P-119P are insertion-code residues that structurally sit between
canonical residues ~76 and ~120 in the chain. By placing them first in the
file, the backbone trace jumps from 119P back to residue 2 (the N-terminus),
producing an incorrect long-distance trace through the structure.

The correct file ordering should follow structural/sequence continuity:

```
A 2 → A 3 → ... → A 76 → A 77P → ... → A 119P → A 77 → A 78 → ... → A 328
```

Or equivalently, the segments in the range definition should be reordered
before extraction so the PDB file has spatially continuous backbone.

## Scope

This affects any domain where:
1. The range definition lists segments out of structural order, AND
2. The pre-cut PDB generation tool concatenates segments in definition order

Domains with insertion codes (e.g., `77P`, `109A`, `243A`, `278A`, `279A-C`)
are the primary cases. The example PDB also contains multiple other insertion
codes (`109A`, `109B`, `243A`, `278A`, `279A`, `279B`, `279C`) within the
second segment which are correctly ordered within that segment.

## Where the Fix Belongs

The fix should be in the **pre-cut PDB generation pipeline**, not the
frontpage viewer. Either:

1. **Reorder range segments** before extracting coordinates, so segments are
   in structural/sequence order
2. **Sort ATOM records** by sequence position after extraction, accounting
   for insertion codes
3. **Normalize the range definition** in `ecod_commons.domain_ranges` so
   segments are always listed in structural order

Option 3 is the most upstream fix and would also benefit the frontpage
viewer's context-mode highlighting (which parses range segments for
`visual.select` calls to PDBe Mol*).

## Additional Context

- The frontpage viewer's range parser (`parseRange` in `viewer/index.html`)
  drops insertion codes via `parseInt()` (e.g., `parseInt('77P')` = 77).
  This is a separate issue affecting context-view highlighting for domains
  with insertion codes, but is less critical since the domain view (pre-cut
  PDB) is the default.
- PDBe Mol*'s `visual.select` API uses integer residue numbers
  (`start_auth_residue_number`/`end_auth_residue_number`) and does not
  support insertion code selection, so context-view highlighting for these
  domains will always be approximate.

## Affected Systems

- Pre-cut PDB generation pipeline (primary fix location)
- `ecod_commons.domain_ranges` range ordering (upstream normalization)
- Frontpage viewer context-mode highlighting (secondary, separate issue)
