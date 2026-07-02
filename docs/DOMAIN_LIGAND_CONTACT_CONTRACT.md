# Domain–ligand contact data contract (for the interactions pipeline)

**Audience:** the ECOD **interactions** instance (`~/work/interactions_2026`), which computes
atomic contacts from mmCIF and maps them to ECOD domains.
**Consumer:** the ECOD **frontpage** instance. Source of truth for the *shape* below is the
**production** database on **sangala** that the frontend reads.
**Status:** the frontend's compound pages (`/compound/[compId]`) are built and live, but their
domain-contact features are **dark** because the one join table they depend on is empty. This
contract specifies exactly what the interactions instance must produce to light them up, and
lists the details that still need to be decided.

---

## 0. TL;DR — the one thing we need

Populate **`public.domain_ligand_contact`** on `sangala:45000 / ecod_af2_pdb`: one row per
(ECOD domain × bound-ligand instance) pair that are within **4 Å**, carrying the minimum
atomic distance. Everything else the compound page needs already exists. That's the whole ask.

The frontend does **not** need your `fgroup_ligand_stats` / `compound_search_index` /
`domain_interfaces` tables — see §7.

---

## 1. Separation of concerns

- **You (interactions) own:** reading coordinates, computing which domain residues are within a
  cutoff of which ligand atoms, and emitting contact edges. This is your domain expertise.
- **We (frontend) own:** the compound UI, and the three tables below on sangala. We already load
  the ligand dictionary and every physical ligand instance from the PDB (see §3). We derive
  per-family ("top-binding F-groups") stats *at query time* from the contact table — you don't
  precompute them.
- **The boundary is `domain_ligand_contact`.** You produce its rows (keyed as in §5); the
  sync/load step writes them to sangala (§6). We never reach into your dione schema; you never
  render UI.

---

## 2. Where it lives

- DB: `sangala:45000` / database `ecod_af2_pdb` / schema `public` (the DB the frontend reads,
  user `ecodweb`, read-only for us).
- ECOD version on this DB: **v295** (the live `domain` table). Note this is **not** v293 — see
  §8.1, this is the single most important open detail.

---

## 3. What already exists (do NOT reproduce these)

Two tables are fully populated by an existing (non-interactions) pipeline. Treat them as fixed
inputs you must key against, not things to rebuild:

### `ligand_compound` — the chemical dictionary (CCD mirror)
~**49,897** rows. `comp_id` (PK), `name`, `formula`, `type`, `pdbx_type`, `formula_weight`,
`is_metal`, `is_buffer`, `release_status`, `updated_at`. The frontend uses `is_buffer` to
de-emphasise crystallisation additives in the UI, so you do **not** need to pre-filter buffers
out (see §8.4).

### `pdb_ligand_instance` — every physical ligand occurrence
~**2,733,530** rows (non-polymer 2.52M + branched/glycan 211k), across **46,208** distinct
`comp_id`s. This is the set of ligand instances you compute contacts *against*.

| column | type | meaning |
|---|---|---|
| `id` | bigint PK | **surrogate — regenerated on reload, do not persist across syncs** (§8.6) |
| `pdb_id` | char | lowercase PDB id, e.g. `6kv9` |
| `chain_id` | varchar | **auth** chain id (matches ECOD chain naming), e.g. `A`; up to 4 chars |
| `pdbnum` | int | ligand residue number (auth numbering for non-polymer); range seen −4…17802 |
| `ins_code` | char | insertion code; **empty string `''` when none** (only ~309 rows use one) |
| `comp_id` | varchar | FK → `ligand_compound.comp_id` |
| `entity_id` | int | mmCIF entity id |
| `entity_type` | varchar | `non-polymer` or `branched` |

**Natural key (unique constraint):** `(pdb_id, chain_id, pdbnum, ins_code, comp_id)`. This is the
key you must emit so we can resolve your contacts to `instance_id` at load time (§5, §6).

---

## 4. The target table — what you deliver into

`public.domain_ligand_contact` (currently **0 rows**):

```sql
CREATE TABLE public.domain_ligand_contact (
    uid               integer                  NOT NULL REFERENCES domain(uid) ON DELETE CASCADE,
    instance_id       bigint                   NOT NULL REFERENCES pdb_ligand_instance(id) ON DELETE CASCADE,
    min_dist_angstrom real                     NOT NULL,
    computed_at       timestamptz              NOT NULL DEFAULT now(),
    PRIMARY KEY (uid, instance_id)
);
```

- **Grain (fixed by the PK):** exactly **one row per (domain `uid`, ligand `instance_id`)**.
  `min_dist_angstrom` is the **minimum** distance over all atom pairs between that domain's atoms
  and that ligand instance's atoms.
- `uid` must be a live **v295** `domain.uid` on sangala (§8.1).
- `instance_id` must reference an existing `pdb_ligand_instance.id` (resolved from your natural
  key at load — you don't need to know the surrogate id).

---

## 5. The row shape you produce

Emit contacts keyed by **stable natural keys**, not surrogate ids. Per contact edge:

| field | source / meaning |
|---|---|
| domain identity | the ECOD domain — as **`ecod_domain_id`** (e.g. `e6kv9A1`) **and/or** v295 `uid`. Give `ecod_domain_id` at minimum; see §8.1 |
| `pdb_id` | lowercase, e.g. `6kv9` |
| `chain_id` | auth chain of the **ligand instance**, e.g. `A` |
| `pdbnum` | ligand residue number (matching `pdb_ligand_instance.pdbnum`) |
| `ins_code` | `''` if none |
| `comp_id` | ligand chemical id, e.g. `NAD` |
| `min_dist_angstrom` | min atomic distance for this domain↔instance pair (≤ cutoff) |

The `(pdb_id, chain_id, pdbnum, ins_code, comp_id)` tuple resolves to `instance_id`; the domain
identity resolves to `uid`. Rows whose ligand tuple or domain doesn't resolve on the current
prod snapshot are dropped at load with a count logged (§8.6).

---

## 6. Delivery mechanism (proposed — confirm)

Because both `pdb_ligand_instance.id` and `domain.uid` are prod surrogates that we own and
regenerate, the clean handoff is **natural-key rows, resolved at load time on sangala**:

1. You write a load-ready table or TSV — `interactions.domain_ligand_contact_staging` (or a
   `.tsv.gz`) — with the §5 columns.
2. The sync/frontend side runs the resolve+load: join staging → `pdb_ligand_instance` on the
   natural key and → `domain` on `id`/`uid`, insert into `public.domain_ligand_contact`.
3. Full rebuild each release: `TRUNCATE` + reload (the table is cheap to regenerate; nothing
   persists its surrogate ids).

This keeps you decoupled from our id churn. **Open:** whether you write directly to sangala,
hand us a TSV, or expose a table on dione we pull from (§8.7).

---

## 7. Explicitly out of scope (do not build for this contract)

- **Per-family precompute.** The compound page derives "top-binding ECOD families" live from
  `domain_ligand_contact JOIN domain ON domain.fid`. We do **not** consume `fgroup_ligand_stats`
  or `compound_search_index`. (If profiling later shows the live rollup is too slow at scale,
  we'll ask for a precomputed table in a follow-up — not now.)
- **Protein–protein domain interfaces** (`domain_interfaces`, `interface_contacts`, PISA,
  capsids). Valuable, but a separate feature with its own future contract; nothing in the current
  frontend reads them.
- **Predicted (AlphaFold) domains.** Contacts are a PDB-structure notion; only
  `type = 'experimental structure'` domains participate. Don't emit contacts for predicted
  domains.

---

## 8. Missing details — decisions/confirmations needed before you run

These are the open items. Several are yours to decide; a couple need confirmation from whoever
populated `pdb_ligand_instance`.

**8.1 Version reconciliation (blocking).** Your pipeline is ECOD **v293** on dione; the target
`domain.uid` is **v295** on sangala. `domain_ligand_contact.uid` MUST be a v295 `domain.uid`.
Preferred: compute domain membership against **v295** domain definitions directly (so identity is
native and no cross-version mapping is needed). If you instead compute on v293 and map, we need to
agree the mapping and expect coverage loss. Deliver `ecod_domain_id` so we can resolve to `uid`
regardless.

**8.2 Residue-numbering convention (confirm).** ECOD ranges use `auth_asym_id` + `label_seq_id`;
but `pdb_ligand_instance.pdbnum` for non-polymer ligands looks like **`auth_seq_id`** (ligands
usually lack `label_seq_id`). The *contact distance* is atomic so numbering doesn't affect it, but
your emitted `(chain_id, pdbnum, ins_code)` for the ligand instance MUST match how
`pdb_ligand_instance` stored it (auth chain + auth ligand number). Please confirm you reproduce
those exact values.

**8.3 Cutoff.** We label the UI "≤ 4 Å"; your `config.DISTANCE_CUTOFF = 4.0`. Confirm 4.0 Å,
all-atom, no hydrogen special-casing — and that `min_dist_angstrom` is the true minimum (not a
representative/centroid distance).

**8.4 Ligand inclusion.** Emit contacts for **all** `comp_id`s present in `pdb_ligand_instance`,
including buffers/additives and metals — the frontend flags/de-emphasises them via
`ligand_compound.is_buffer`/`is_metal`. Do **not** apply your `ligand_filter` exclusion list at
emit time (or if you do, tell us, so we don't imply coverage we don't have). Confirm whether
`branched` (glycan) instances are included.

**8.5 Overlapping domains.** ECOD domains overlap; a ligand near a shared residue should yield a
contact row for **each** overlapping domain. Confirm you emit all of them (the PK `(uid,
instance_id)` already allows it).

**8.6 Stability / refresh.** `pdb_ligand_instance.id` and `domain.uid` are regenerated on prod
reload — that's why §5/§6 key on natural keys and resolve at load. Confirm you don't persist our
surrogate ids. Expect the loader to drop-and-log rows that don't resolve against the current
snapshot (obsoleted PDBs/domains).

**8.7 Handoff location.** Direct write to sangala vs. TSV vs. dione table we pull (§6) — pick one.

**8.8 Expected magnitude (for a "done vs still-running" signal).** Give us a rough expected row
count and distinct-domain count so we can distinguish "not yet loaded" from "genuinely no
contacts" (as the DrugBank contract does). ~1.37M experimental domains and ~2.7M ligand instances
are in play; a ballpark of contact edges would help us set the "pending" UX threshold.

---

## 9. Contract stability

- **Stable to key on:** `domain.uid` / `ecod_domain_id`, and the `pdb_ligand_instance` natural key
  `(pdb_id, chain_id, pdbnum, ins_code, comp_id)`. `min_dist_angstrom` semantics as in §4.
- **Do NOT persist:** `pdb_ligand_instance.id`, `domain.uid` as long-lived references in your
  store — resolve at load.
- Target column set is stable; new columns may be appended (we won't `SELECT *` into fixed
  structs). If you need an extra field surfaced (e.g. number of contacting atom pairs), propose it
  and we'll add a column rather than overload `min_dist_angstrom`.

---

*Questions on the target shape, the natural-key resolution, or expected counts: ask the frontpage
instance. Questions on v293→v295 domain identity: that's the crux — resolve §8.1 first.*
