# Usage tracking

Anonymous, cookieless usage statistics for grant reporting. Public notice: `/privacy`.

## What is counted

| kind | source | notes |
|---|---|---|
| `pageview` | `UsageBeacon` (client) → `POST /api/usage` | every route change, incl. client-side nav; keyword searches are page views of `/search` |
| `search` | `proxy.ts` | advanced search, and `/api/search` called from outside the app |
| `blast`, `foldseek` | `proxy.ts` | job submissions (POST only; polling is not counted) |
| `api` | `proxy.ts` | public `/api/v1/*` |
| `file` | `proxy.ts` | per-domain PDB/FASTA, EPP FASTA, predicted models |
| `bulk_download` | `/api/download/[...file]` | distribution page links go through this 302, so copied-into-wget links count too |

`proxy.ts` skips requests without `X-Forwarded-For`/`X-Real-IP`: those are the app's own
server-side self-fetches, already counted as the page view. `is_bot` marks automated
clients (crawlers, wget, python, ...). They are kept, because pipelines are real usage,
but they are reported separately from human visitors.

**Not counted:** downloads from old direct `.../ecod/distributions/<file>` URLs (cited in
papers and scripts). The legacy Apache serves those, so its access logs are the only source.

## Privacy model

No cookies, no browser storage, no third parties. IPs are never stored. `visitor` is
`sha256(daily salt | ip | UA)[:16]`. The salt is random, shared through `usage_salt`, and
deleted after the following day, so visitors are unlinkable across days, and the
statistics give daily uniques only. Paths only (no query strings). Referrer is reduced to host.
Location (optional) is a local GeoIP lookup that keeps country, city and coordinates rounded to 0.1°.

## Setup

1. Create a dedicated database (keeps history off the release-sync path), as a superuser:
   `CREATE DATABASE ecod_usage OWNER ecodweb;` then `psql -d ecod_usage -f sql/usage_tracking.sql`.
2. In prod `.env.production`: `USAGE_DB_NAME=ecod_usage` (other `USAGE_DB_*` fall back to `DB_*`).
3. Optional geography: download a City-level `.mmdb`. Either DB-IP "IP to City Lite"
   (CC BY 4.0, no account, monthly; attribution required) or MaxMind GeoLite2-City
   (free license key). Then set `GEOIP_DB=/path/to/file.mmdb`. The file is reloaded when it changes.
4. `USAGE_TRACKING=off` disables recording (e.g. for dev).

If the tables are missing, flushes fail quietly (one log line per 10 min) and the site is unaffected.

## Reporting

    source ~/.bashrc
    USAGE_DB_NAME=ecod_usage USAGE_DB_PASSWORD=... scripts/usage_report.py --since 2026-11-01
    scripts/usage_report.py --since 2026-11-01 --geo-csv locations.csv   # for a map

Views: `usage_daily`, `usage_monthly`, `usage_geo_monthly`.
