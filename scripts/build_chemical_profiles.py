#!/usr/bin/env python3
"""Build per-X-group chemical profiles of ligand binding for the group pages.

For each ECOD X-group, from DrugDomain cross-references (ecod_drugbank_pdb) and a
ClassyFire classification of PDB ligands:

  * proteins     number of distinct UniProt accessions with at least one domain
                 in the X-group bound to a classified, non-buffer ligand
  * superclasses number of distinct ClassyFire superclasses among those ligands
  * per20        expected number of superclasses among 20 proteins drawn at random
                 from the X-group (exact rarefaction; X-groups with >= 20 proteins),
                 i.e. chemical diversity at equal sampling depth, and its
                 percentile among all such X-groups
  * enrichment   for each superclass, proteins observed vs expected
                 (expected = proteins x overall fraction of X-group-protein pairs
                 carrying the superclass), Fisher's exact test (two-sided) on the
                 2x2 table of this X-group's pairs vs all others, Benjamini-Hochberg
                 q over every tested cell; cells with expected < MIN_EXPECTED are
                 reported but not tested

This is the method of the ECOD 2027 paper's Figures 4 and 5, with one difference:
buffers and crystallization additives are excluded using ECOD's own ligand flags
(ligand_compound.is_buffer) rather than the BioLiP2 artifact list, so values differ
slightly from the published figures.

Reads the database only. Writes a JSON file loaded by src/lib/chemical-profiles.ts.

Usage:
  python3 scripts/build_chemical_profiles.py \\
      --classyfire data/ligand_classyfire.txt --out data/chemical_profiles.json \\
      --release v295.2
Connection: standard libpq environment (PGHOST, PGPORT, PGUSER, PGDATABASE; password
from ~/.pgpass), defaulting to the production database.
"""
import argparse, collections, csv, json, math, os, sys
from datetime import date

import psycopg2
from scipy.stats import fisher_exact

K = 20              # rarefaction depth (proteins)
MIN_EXPECTED = 5.0  # cells with a smaller expected count are not tested


def log_comb(n, k):
    if k < 0 or k > n:
        return float("-inf")
    return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)


def rarefied(n, counts, k):
    """Expected number of superclasses among k of n proteins (hypergeometric)."""
    base = log_comb(n, k)
    e = 0.0
    for ns in counts:
        miss = log_comb(n - ns, k) - base
        e += 1.0 - (math.exp(miss) if miss > float("-inf") else 0.0)
    return e


def bh(pvals):
    """Benjamini-Hochberg q-values, in input order."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    q = [0.0] * m
    prev = 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        prev = min(prev, pvals[i] * m / rank)
        q[i] = prev
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--classyfire", required=True, help="TSV with pdb_ligand_id and superclass columns")
    ap.add_argument("--out", required=True)
    ap.add_argument("--release", required=True)
    a = ap.parse_args()

    sc = {r["pdb_ligand_id"]: r["superclass"]
          for r in csv.DictReader(open(a.classyfire), delimiter="\t") if r["superclass"]}

    conn = psycopg2.connect(host=os.environ.get("PGHOST", "sangala"),
                            port=os.environ.get("PGPORT", "45000"),
                            user=os.environ.get("PGUSER", "ecod"),
                            dbname=os.environ.get("PGDATABASE", "ecod_af2_pdb"))
    cur = conn.cursor()
    cur.execute("""
        SELECT split_part(d.fid, '.', 1) AS x, db.unp_acc, db.ligand_pdb
        FROM ecod_drugbank_pdb db
        JOIN domain d ON d.uid = db.uid
        LEFT JOIN ligand_compound lc ON lc.comp_id = db.ligand_pdb
        WHERE db.unp_acc IS NOT NULL AND db.ligand_pdb IS NOT NULL
          AND NOT COALESCE(d.is_obsolete, false)
          AND NOT COALESCE(lc.is_buffer, false)""")
    units = collections.defaultdict(lambda: collections.defaultdict(set))  # x -> acc -> {s}
    for x, acc, lig in cur.fetchall():
        s = sc.get(lig)
        if s:
            units[x][acc].add(s)
    cur.execute("SELECT id, name FROM cluster WHERE type = 'X'")
    xname = dict(cur.fetchall())

    N = sum(len(v) for v in units.values())
    tot = collections.Counter(s for v in units.values() for ss in v.values() for s in ss)
    frac = {s: tot[s] / N for s in tot}
    print(f"{len(units)} X-groups, {N:,} X-group-protein pairs, {len(tot)} superclasses", file=sys.stderr)

    profiles, cells = {}, []
    for x, accs in units.items():
        n = len(accs)
        obs = collections.Counter(s for ss in accs.values() for s in ss)
        rows = []
        for s in sorted(tot):
            o, e = obs.get(s, 0), n * frac[s]
            row = {"superclass": s, "observed": o, "expected": round(e, 2),
                   "ratio": round(o / e, 3) if e else None, "q": None, "tested": e >= MIN_EXPECTED}
            if row["tested"]:
                table = [[o, n - o], [tot[s] - o, (N - n) - (tot[s] - o)]]
                cells.append((x, len(rows), fisher_exact(table, alternative="two-sided")[1]))
            if o or row["tested"]:
                rows.append(row)
        profiles[x] = {"name": xname.get(x), "proteins": n, "superclasses": len(obs),
                       "per20": round(rarefied(n, obs.values(), K), 2) if n >= K else None,
                       "per20Percentile": None, "enrichment": rows}

    for (x, i, _), qv in zip(cells, bh([c[2] for c in cells])):
        profiles[x]["enrichment"][i]["q"] = float(f"{qv:.3g}")

    ranked = sorted((p["per20"], x) for x, p in profiles.items() if p["per20"] is not None)
    for rank, (_, x) in enumerate(ranked):
        profiles[x]["per20Percentile"] = round(100 * rank / (len(ranked) - 1), 1)

    out = {"meta": {"release": a.release, "generated": date.today().isoformat(),
                    "pairs": N, "xGroups": len(profiles), "rarefiedXGroups": len(ranked),
                    "k": K, "minExpected": MIN_EXPECTED,
                    "per20Median": ranked[len(ranked) // 2][0] if ranked else None,
                    "testedCells": len(cells)},
           "profiles": profiles}
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {a.out}: {len(profiles)} X-groups, {len(ranked)} with >= {K} proteins, "
          f"{len(cells):,} tested cells", file=sys.stderr)


if __name__ == "__main__":
    main()
