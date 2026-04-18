# Deficiency: Incorrect and Inconsistent FASTA Headers in Derived Domain Files

## Summary

Pre-cut domain FASTA files (`.fa`) in `af2_pdb_d/` have incorrect
`assignment:` fields in their headers. Approximately 85% of files contain
`assignment:NO_X_ID` regardless of whether the domain has a valid ECOD
classification. The remaining ~15% have correct dot-separated F-group IDs
(e.g., `assignment:531.3.1.1`). This makes the FASTA headers unreliable as
a source of classification information and produces confusing output when
served via the bulk FASTA API endpoints.

## Current Header Format

```
>{ecod_domain_id} uid:{zero_padded_uid} range:{range} assignment:{value}
```

### Examples

Domains with real classifications that incorrectly show `NO_X_ID`:

```
>e1nykA1 uid:000001006 range:A:46-130,A:175-201 assignment:NO_X_ID
>e2e7zA4 uid:001685572 range:A:4-61 assignment:NO_X_ID
>e5vswB1 uid:002083261 range:B:6-52,B:179-236 assignment:NO_X_ID
```

Domains with correct assignments (minority):

```
>e3hjlA1 uid:002028014 range:A:5-101 assignment:531.3.1.1
>e5edfA1 uid:002028017 range:A:44-267 assignment:881.6.1.1
>e5u30A4 uid:002028027 range:A:625-805 assignment:5012.1.1.1
```

## Root Cause

The FASTA generation pipeline appears to write the `assignment:` field at
file creation time. If the domain's X-group assignment is not yet resolved
when the file is generated, it writes `NO_X_ID`. The files are not
regenerated when classifications are later assigned or updated.

## Impact

- **Bulk FASTA downloads** (`/api/v1/domains/unclassified/fasta`,
  `/api/v1/domains/unclassified/{groupId}/fasta`) serve these files
  verbatim, producing headers that misrepresent domain classification
  status.
- **Downstream consumers** parsing FASTA headers for classification
  metadata will get incorrect or missing assignments for the majority of
  domains.
- The `assignment:` field is not useful in its current state — it is wrong
  for ~85% of domains and uses a non-standard label (`NO_X_ID`) that
  doesn't map to any ECOD convention.

## Recommended Fix

Regenerate all `.fa` files with correct, current classification from the
database. Two sub-issues to address:

### 1. Populate assignment from current database state

Query `domain.fid` (or `domain.tid` for domains without F-group) to get
the current classification and write it into the header. For truly
unclassified domains (those in `.0` F-groups), a consistent placeholder
like `unclassified` or the literal fid (e.g., `1001.1.1.0`) would be
more informative than `NO_X_ID`.

### 2. Ensure headers stay current on reclassification

Either:
- Regenerate FASTA files as part of the classification update pipeline
- Or decouple the header from classification entirely (e.g., use only
  `uid` and `ecod_domain_id` in the header, and let consumers look up
  classification via the API)

The second approach is more robust — the FASTA header would contain stable
identifiers, and classification (which changes over time) would come from
the authoritative source (the database / API).

### Suggested header format (option A — with classification)

```
>{ecod_domain_id} uid:{uid} range:{range} fid:{fid} {x_group_name}
```

### Suggested header format (option B — stable identifiers only)

```
>{ecod_domain_id} uid:{uid} range:{range}
```

## Scope

- ~1.8M `.fa` files in `af2_pdb_d/`
- ~85% have incorrect `assignment:NO_X_ID`
- ~15% have correct F-group assignments
- All files need regeneration for consistency regardless of which format
  is chosen

## Affected Systems

- FASTA generation pipeline (primary fix location)
- Bulk FASTA API endpoints (serve files verbatim — no frontend fix needed)
- Any downstream tools parsing FASTA headers from ECOD distributions

## Data Locations

- Derived files: `/data/ECOD0/html/af2_pdb_d/{mid}/{padded_uid}/{padded_uid}.fa`
- Production (sangala): `/data/ECOD/html/af2_pdb_d/`
- Classification source: `domain.fid` / `domain.tid` in `ecod_af2_pdb` database
