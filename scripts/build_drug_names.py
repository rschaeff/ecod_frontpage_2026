#!/usr/bin/env python3
"""Build a DrugBank drug-name lookup for the PDB ligands ECOD links to DrugBank.

ECOD stores DrugBank accessions (from DrugDomain) but not drug names, so pages
showed the PDB chemical name ("4-(4-METHYL-PIPERAZIN-1-YLMETHYL)-N-...") where a
reader expects "Imatinib". DrugBank's own vocabulary download now needs an
account, so the names come from the RCSB PDB Data API, which carries DrugBank's
identifier and name for each chemical component (drugbank.drugbank_info).

Reads the database only. Writes a JSON file loaded by src/lib/drug-names.ts:
  {"meta": {...}, "byLigand": {"STI": {"drugbankId": "DB00619", "name": "Imatinib"}},
   "byDrugbank": {"DB00619": "Imatinib"}}

Usage:
  python3 scripts/build_drug_names.py --out data/drug_names.json
Connection: libpq environment (PGHOST, PGPORT, PGUSER, PGDATABASE; ~/.pgpass),
defaulting to the production database. Network: data.rcsb.org (honours
http(s)_proxy).
"""
import argparse, json, os, sys, time, urllib.request
from datetime import date

import psycopg2

RCSB = "https://data.rcsb.org/graphql"
BATCH = 200
QUERY = """query ($ids: [String!]!) {
  chem_comps(comp_ids: $ids) {
    chem_comp { id }
    drugbank { drugbank_info { drugbank_id name } }
  }
}"""


def fetch(ids):
    body = json.dumps({"query": QUERY, "variables": {"ids": ids}}).encode()
    req = urllib.request.Request(RCSB, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["data"]["chem_comps"] or []
        except Exception as e:  # transient network / rate limit
            if attempt == 3:
                raise
            print(f"  retry after {e}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    conn = psycopg2.connect(host=os.environ.get("PGHOST", "sangala"),
                            port=os.environ.get("PGPORT", "45000"),
                            user=os.environ.get("PGUSER", "ecod"),
                            dbname=os.environ.get("PGDATABASE", "ecod_af2_pdb"))
    cur = conn.cursor()
    cur.execute("""SELECT DISTINCT ligand_pdb FROM (
                     SELECT ligand_pdb, drugbank_acc FROM ecod_drugbank_pdb
                     UNION ALL SELECT ligand_pdb, drugbank_acc FROM ecod_drugbank_afdb) x
                   WHERE ligand_pdb IS NOT NULL AND drugbank_acc IS NOT NULL""")
    codes = sorted(r[0] for r in cur.fetchall())
    print(f"{len(codes)} ligand codes with a DrugBank accession", file=sys.stderr)

    by_ligand, by_db = {}, {}
    for i in range(0, len(codes), BATCH):
        for cc in fetch(codes[i:i + BATCH]):
            info = ((cc or {}).get("drugbank") or {}).get("drugbank_info") or {}
            comp = ((cc or {}).get("chem_comp") or {}).get("id")
            if comp and info.get("drugbank_id") and info.get("name"):
                by_ligand[comp] = {"drugbankId": info["drugbank_id"], "name": info["name"]}
                by_db.setdefault(info["drugbank_id"], info["name"])
        print(f"  {min(i + BATCH, len(codes))}/{len(codes)}", file=sys.stderr)

    out = {"meta": {"source": "RCSB PDB Data API, drugbank.drugbank_info (DrugBank names)",
                    "generated": date.today().isoformat(), "ligands": len(by_ligand),
                    "drugs": len(by_db), "queried": len(codes)},
           "byLigand": by_ligand, "byDrugbank": by_db}
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {a.out}: {len(by_ligand)} ligand codes, {len(by_db)} DrugBank names", file=sys.stderr)


if __name__ == "__main__":
    main()
