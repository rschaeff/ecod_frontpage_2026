#!/usr/bin/env python3
"""Usage summary for grant reports, from the tables in sql/usage_tracking.sql.

    source ~/.bashrc   # psycopg2
    USAGE_DB_PASSWORD=... scripts/usage_report.py --since 2026-11-01 [--until 2027-11-01] [--site /ecod]
    scripts/usage_report.py --since 2026-11-01 --geo-csv locations.csv   # for a map

Connection settings come from USAGE_DB_* (falling back to DB_*), as in the app.
"Visitor-days" sums distinct visitors per day; visitors are not linkable across
days by design, so there is no true monthly unique count.
"""
import argparse
import csv
import os
import sys

import psycopg2


def env(name, default=None):
    return os.environ.get(f"USAGE_{name}") or os.environ.get(name) or default


def connect():
    return psycopg2.connect(
        host=env("DB_HOST", "sangala"),
        port=int(env("DB_PORT", "45000")),
        dbname=env("DB_NAME", "ecod_af2_pdb"),
        user=env("DB_USER", "ecodweb"),
        password=env("DB_PASSWORD"),
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", required=True, help="start date, inclusive (YYYY-MM-DD)")
    ap.add_argument("--until", help="end date, exclusive (default: now)")
    ap.add_argument("--site", default="/ecod", help="instance basePath (default /ecod)")
    ap.add_argument("--geo-csv", help="also write per-city counts to this CSV")
    a = ap.parse_args()

    where = "site = %(site)s AND ts >= %(since)s AND (%(until)s::date IS NULL OR ts < %(until)s::date)"
    args = {"site": a.site, "since": a.since, "until": a.until}
    cur = connect().cursor()

    cur.execute(f"""
        SELECT kind,
               count(*) FILTER (WHERE NOT is_bot),
               count(*) FILTER (WHERE is_bot),
               count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor) FILTER (WHERE NOT is_bot)
        FROM usage_event WHERE {where} GROUP BY kind ORDER BY 2 DESC""", args)
    print(f"ECOD usage {a.since} .. {a.until or 'now'} (site {a.site})\n")
    print(f"{'kind':<15}{'human':>12}{'automated':>12}{'visitor-days':>14}")
    for kind, human, bot, vd in cur.fetchall():
        print(f"{kind:<15}{human:>12,}{bot:>12,}{vd:>14,}")

    cur.execute(f"""
        SELECT count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor),
               count(DISTINCT country)
        FROM usage_event WHERE {where} AND NOT is_bot""", args)
    vd, countries = cur.fetchone()
    print(f"\nHuman visitor-days (all kinds): {vd:,}   countries: {countries}")

    print("\nTop countries (visitor-days):")
    cur.execute(f"""
        SELECT coalesce(country, '??'), count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor) n
        FROM usage_event WHERE {where} AND NOT is_bot GROUP BY 1 ORDER BY n DESC LIMIT 15""", args)
    for c, n in cur.fetchall():
        print(f"  {c}  {n:>10,}")

    print("\nTop referrers:")
    cur.execute(f"""
        SELECT referrer_host, count(*) n FROM usage_event
        WHERE {where} AND referrer_host IS NOT NULL AND NOT is_bot GROUP BY 1 ORDER BY n DESC LIMIT 15""", args)
    for h, n in cur.fetchall():
        print(f"  {h:<40}{n:>10,}")

    print("\nBulk downloads by file (browser + automated):")
    cur.execute(f"""
        SELECT detail, count(*) n FROM usage_event
        WHERE {where} AND kind = 'bulk_download' GROUP BY 1 ORDER BY n DESC LIMIT 20""", args)
    for f, n in cur.fetchall():
        print(f"  {f:<60}{n:>8,}")

    if a.geo_csv:
        cur.execute(f"""
            SELECT country, city, lat, lon, count(*) events,
                   count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor) visitor_days
            FROM usage_event WHERE {where} AND NOT is_bot AND lat IS NOT NULL
            GROUP BY 1, 2, 3, 4 ORDER BY visitor_days DESC""", args)
        with open(a.geo_csv, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow([d[0] for d in cur.description])
            w.writerows(cur.fetchall())
        print(f"\nWrote {a.geo_csv}", file=sys.stderr)


if __name__ == "__main__":
    main()
