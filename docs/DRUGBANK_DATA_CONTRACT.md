# DrugBank / DrugDomain data contract (for the frontend)

**Audience:** the frontend instance, to build a DrugDomain visualization on the domain page (and
optionally drug- and ligand-centric views).
**Producer:** the ECOD version/sync instance. Source of truth = `ecod_commons` on dione; this
contract describes the **production** copy on **sangala** that the frontend reads.
**Status:** the four prod tables are populated by the v295 release sync's `drugbank` phase (the
LAST phase). During a sync they may be transiently empty/partial; treat empty as "not yet synced",
not "no data". Expected post-v295 counts are at the bottom.

---

## 0. Where it lives / how to read it
- DB: `sangala:45000` / database `ecod_af2_pdb` / schema `public` (the same DB the frontend already
  uses; `.env.production` user `ecodweb`, read-only).
- Four tables, two populations × two shapes:
  - `ecod_drugbank_pdb`       — base rows, experimental (PDB) domains
  - `ecod_drugbank_pdb_agg`   — one row per domain, comma-rolled (PDB)
  - `ecod_drugbank_afdb`      — base rows, predicted (AlphaFold) domains
  - `ecod_drugbank_afdb_agg`  — one row per domain, comma-rolled (AFDB)
- No views are exposed for these (just the four tables).

The data is DrugDomain (Kirill Gusev / UCF) cross-references: for each ECOD domain, the DrugBank
drugs and/or bound PDB ligands associated with that domain's UniProt entry, plus a deep link into
the DrugDomain web resource.

---

## 1. Join key — everything hangs off `domain.uid`
Both base tables have `uid integer NOT NULL` with FK `REFERENCES domain(uid)`. Join drugbank → the
existing `domain` table on `uid`. `ecod_domain_id` mirrors `domain.id` (the human-readable id, e.g.
`e6kv9A1`). A domain has DrugDomain data iff a row exists; most domains have none.

```sql
-- does this domain have DrugDomain data? (PDB example)
SELECT * FROM ecod_drugbank_pdb_agg WHERE uid = $1;
```

---

## 2. Base tables — one row per (domain × drug-or-ligand cross-reference)

### `ecod_drugbank_pdb` (experimental / PDB domains)
| column | type | meaning |
|---|---|---|
| `id` | int PK | surrogate row id (not stable across syncs — do not persist) |
| `uid` | int FK→domain.uid | the ECOD domain |
| `ecod_domain_id` | text | domain id (= `domain.id`), e.g. `e6kv9A1` |
| `pdb_id` | text | source PDB id, e.g. `6kv9` |
| `unp_acc` | text | UniProt accession of the domain's protein, e.g. `A0A003` |
| `drugbank_acc` | text **NULLABLE** | DrugBank accession, e.g. `DB14128`. **NULL ⇒ ligand-only** (a bound PDB ligand that is not a DrugBank drug) — see §4 |
| `ligand_pdb` | text | PDB chemical component id of the bound ligand, e.g. `NAD`, `UGA` |
| `drugdomain_acc` | text | trailing path segment of `drugdomain_link` (= `ligand_pdb` for ligand refs, = `drugbank_acc` for drug refs) |
| `drugdomain_link` | text | deep link into DrugDomain (see §5) |

### `ecod_drugbank_afdb` (predicted / AlphaFold domains)
Identical **except** `pdb_id` is replaced by:
| `source_id` | text | AFDB model id, e.g. `A5X5Y0_F1` |

For AFDB rows, `ligand_pdb` is typically empty and `drugbank_acc` is set (DrugBank-based refs);
`drugdomain_acc = drugbank_acc`.

### Example base rows
```
-- PDB, drug refs (one domain, two drugs/ligands):
uid=2552715 e6kv9A1 6kv9 A0A003 drugbank=DB14128 ligand=NAD drugdomain_acc=NAD
uid=2552715 e6kv9A1 6kv9 A0A003 drugbank=DB03041 ligand=UGA drugdomain_acc=UGA
-- PDB, ligand-only (drugbank_acc NULL):
uid=3037062 e7uw1R1 7uw1  drugbank=NULL ligand=OIY drugdomain_acc=OIY
-- AFDB, drug ref:
uid=3540443 A5X5Y0_F1_nD1 source_id=A5X5Y0_F1 A5X5Y0 drugbank=DB00898 ligand= drugdomain_acc=DB00898
```

---

## 3. Aggregate tables — one row per domain (use these for the domain page)
`ecod_drugbank_pdb_agg` / `ecod_drugbank_afdb_agg` collapse the base rows to **one row per
`(uid, ecod_domain_id, pdb_id|source_id, unp_acc)`**. The four payload columns become **`text`,
comma-joined** (Postgres `string_agg(..., ',' ORDER BY ...)`), index-aligned across columns:

| column | shape |
|---|---|
| `uid`, `ecod_domain_id`, `pdb_id`/`source_id`, `unp_acc` | scalar (group key) |
| `drugbank_acc` | `DB14128,DB03041` (comma-joined; **may contain nothing for the all-NULL ligand-only case**) |
| `drugdomain_link` | `url1,url2` |
| `ligand_pdb` | `NAD,UGA` |
| `drugdomain_acc` | `NAD,UGA` |

⚠️ The comma-joined lists are **positionally aligned by the agg ordering, not zipped per original
row.** Each column is independently `string_agg`-ordered, so index *i* of `drugbank_acc` does NOT
reliably correspond to index *i* of `ligand_pdb`. **If you need correct per-reference tuples
(drug↔ligand↔link together), read the base table, not the agg.** Use the agg only for cheap
"does it have data / how many / quick chips" rendering.

Recommended: domain page calls the **base** table and groups client-side (or via a small query)
so each chip carries the correct `{drugbank_acc, ligand_pdb, drugdomain_link}` triple.

---

## 4. The NULL `drugbank_acc` case (large — design for it)
~**510k of ~957k** PDB rows have `drugbank_acc IS NULL`. These are **bound-ligand cross-references**
(the domain's structure has this PDB ligand, surfaced by DrugDomain) that are **not** mapped to a
DrugBank drug. They still carry `ligand_pdb` + a DrugDomain link. For the UI:
- Treat "DrugBank drugs" (`drugbank_acc IS NOT NULL`) and "ligands" (`drugbank_acc IS NULL`) as two
  visually distinct categories, or two tabs/sections.
- `ligand_pdb` values include crystallization additives (e.g. `EDO`, `GOL`) — DrugDomain includes
  them faithfully; you may want a de-emphasis/filter for common cryo/buffer ligands.

---

## 5. `drugdomain_link` URL patterns
Base host: `https://drugdomain.cs.ucf.edu`. Two observed shapes, keyed off the domain's `unp_acc`:
- **ligand:** `https://drugdomain.cs.ucf.edu/domains/{unp_acc}/molecule/{ligand_pdb}`
- **drugbank:** `https://drugdomain.cs.ucf.edu/domains/{unp_acc}/drugbank/{drugbank_acc}`

`drugdomain_acc` is just the final path segment, convenient as the visible chip label. Use the
stored `drugdomain_link` verbatim for the href (don't reconstruct it).

External resources you can also deep-link:
- DrugBank drug page: `https://go.drugbank.com/drugs/{drugbank_acc}` (e.g. `DB14128`)
- PDB ligand (RCSB) page: `https://www.rcsb.org/ligand/{ligand_pdb}` (e.g. `NAD`)

---

## 6. Cardinality (for layout decisions)
- PDB: ~957k base rows across ~512k distinct domains (~1.9 refs/domain avg; **up to 20** on a
  single domain). ~510k rows are ligand-only (`drugbank_acc` NULL).
- AFDB: ~16.5k base rows across ~4k distinct domains.
- So a domain page should handle 0, 1, or up to ~20 chips; group drugs vs ligands; collapse/expand
  for the long tail.

---

## 7. Not to be confused with `domain.ligand` / `domain.ligand_pdbnum`
The `domain` table has its own `ligand` (comma-separated 3-letter codes) and `ligand_pdbnum`
(chain:resnum contact list) columns. Those are the **4 Å structural-contact ligand annotation**
(legacy v291-style, populated by a different pipeline), describing what is physically near the
domain in its own structure. **DrugBank/DrugDomain is a separate, UniProt-level cross-reference**
(what drugs/ligands are associated with this domain's protein across DrugDomain), and the two will
not be 1:1. Present them as distinct features (or clearly labeled subsections).

---

## 8. Recommended query patterns
```sql
-- Domain page: correctly-tupled references (PDB). Order drugs first, then ligand-only.
SELECT drugbank_acc, ligand_pdb, drugdomain_acc, drugdomain_link
FROM ecod_drugbank_pdb
WHERE uid = $1
ORDER BY (drugbank_acc IS NULL), drugbank_acc, ligand_pdb;

-- Same for predicted domains:
SELECT drugbank_acc, ligand_pdb, drugdomain_acc, drugdomain_link
FROM ecod_drugbank_afdb WHERE uid = $1 ORDER BY drugbank_acc;

-- Has-data badge (cheap), either population:
SELECT EXISTS (SELECT 1 FROM ecod_drugbank_pdb_agg  WHERE uid=$1)
    OR EXISTS (SELECT 1 FROM ecod_drugbank_afdb_agg WHERE uid=$1);

-- Drug-centric ("which domains bind DB14128"):
SELECT uid, ecod_domain_id, pdb_id, unp_acc FROM ecod_drugbank_pdb WHERE drugbank_acc = $1;

-- Ligand-centric ("which domains see NAD"):
SELECT uid, ecod_domain_id, pdb_id FROM ecod_drugbank_pdb WHERE ligand_pdb = $1;
```
Add app-side indexes if you query by `drugbank_acc`/`ligand_pdb` a lot (base tables currently only
have the PK + the `uid` FK; no btree on `uid`/`drugbank_acc`/`ligand_pdb` yet — tell the version
instance if you need them created on prod).

---

## 9. Stability / contract guarantees
- **Stable to join on:** `uid` (FK to `domain.uid`), `ecod_domain_id`, `unp_acc`, `pdb_id`/`source_id`,
  `drugbank_acc`, `ligand_pdb`, `drugdomain_link`, `drugdomain_acc`.
- **Do NOT persist** the base-table `id` (surrogate, regenerated every full sync; the whole table is
  cleared + reloaded each release).
- The tables are fully rebuilt on each release sync (TRUNCATE + reload filtered to current prod
  `domain` uids). Rows pointing at domains obsoleted since the last DrugDomain drop are dropped
  (~1k), so coverage tracks the live domain set.
- Column set is considered stable; new columns may be appended (don't `SELECT *` into fixed structs).

## 10. Expected counts after the v295 sync completes
- `ecod_drugbank_pdb` ≈ **957,178** rows / ~512k domains
- `ecod_drugbank_afdb` ≈ **15,873** rows / ~4k domains
- `*_agg` ≈ one row per distinct domain key (~512k / ~4k)
If you see 0 rows, the sync's drugbank phase hasn't run yet — check with the version instance.

---
*Questions / need indexes or a convenience view on prod (e.g. a unified `v_domain_drugdomain`)?
Ask the ECOD version/sync instance — those are cheap to add on sangala.*
