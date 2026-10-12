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
| `structure_view` | `proxy.ts` | the same files fetched by the in-page 3D viewer (Referer under `/viewer/`) |
| `bulk_download` | `/api/download/[...file]` | distribution page links go through this 302, so copied-into-wget links count too |

`proxy.ts` skips loopback clients: those are the app's own server-side self-fetches,
already counted as the page view. (Next fills in `X-Forwarded-For` from the socket when it
is absent, so "has no forwarding header" does not work as the test.) Same-site referrers are
dropped using `USAGE_OWN_HOSTS` (default `prodata.swmed.edu`), since the Host header behind
the reverse proxy is internal. `is_bot` marks automated
clients (crawlers, wget, python, ...). They are kept, because pipelines are real usage,
but they are reported separately from human visitors.

**Not counted:** downloads from old direct `.../ecod/distributions/<file>` URLs (cited in
papers and scripts). The legacy Apache serves those, so its access logs are the only source.

**Who counts as a person:** an event is `human` (view `usage_event_classified`) only if
its visitor also fired a valid browser page view that day. Day one showed why `is_bot`
alone is not enough: a crawler fleet sending full browser headers fetched ~4,000 domain
files and never ran JavaScript, and a Burp Suite scan posted injection probes to the beacon.
The beacon now accepts only requests whose `Origin` is this site, with paths of known routes.

**Do not use `Sec-Fetch-*` headers here.** The site is plain HTTP, and browsers send them only
to HTTPS origins, so no real visitor has them. A beacon check requiring `Sec-Fetch-Site`
silently dropped every page view (2026-10-12). Conversely, a client sending them over HTTP is faking.

## Privacy model

No cookies, no browser storage, no third parties. IPs are never stored. `visitor` is
`sha256(daily salt | ip | UA)[:16]`. The salt is random, shared through `usage_salt`, and
deleted after the following day, so visitors are unlinkable across days, and the
statistics give daily uniques only. Paths only (no query strings). Referrer is reduced to host.
Location (optional) is a local GeoIP lookup that keeps country, city and coordinates rounded to 0.1°.

## Setup

1. **Done 2026-10-12:** `ecod_usage` exists on sangala:45000 (the postgres17_frontend
   cluster), owned by `rschaeff`, with `sql/usage_tracking.sql` applied. `ecodweb` was granted
   only what the app needs (the GRANTs at the end of that file, plus SELECT on the views),
   and `CREATE` on `public` was revoked from PUBLIC, so the web role cannot truncate, drop
   or create anything. To recreate: connect over the local socket (`trust` in pg_hba), e.g.
   `env LD_LIBRARY_PATH=/usr/lib64 /usr/bin/psql -h /tmp -p 45000 -d postgres`.
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

Views: `usage_event_classified`, `usage_daily`, `usage_monthly`, `usage_geo_monthly`.
