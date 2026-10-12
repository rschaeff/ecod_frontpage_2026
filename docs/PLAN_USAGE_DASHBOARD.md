# Spec: internal ECOD usage dashboard

Status: proposed (2026-10-12). Reads the `ecod_usage` database described in
[USAGE_TRACKING.md](USAGE_TRACKING.md). Nothing in this spec changes the public site.

## Purpose

A small internal website for looking at ECOD usage:

- **Grant writing:** visitors, downloads, searches, jobs and API use over a chosen period,
  exportable as tables.
- **Nick's map:** where users are in the world.
- **Operations:** watch automated traffic (crawler fleets, scanners) without reading raw logs.

Users are the lab: a handful of people, read-only. It is not a public feature.

## Hard constraints

1. **Not part of the frontpage, and not reachable from outside the firewall.** It is a
   separate app, in a separate directory, on a separate port. It must never be routed
   through the prodata reverse proxy (`20.71.0.1`), which is what publishes `/ecod`.
2. **Read-only.** It connects with its own Postgres role that has `SELECT` on the usage
   views and nothing else. It never writes events, never touches `usage_salt`, and has
   no access to `ecod_af2_pdb`.
3. **No personal data to show.** The database holds no IPs or user agents by design.
   The dashboard must not add any, e.g. no reverse-DNS or WHOIS lookups on anything.
4. **Lightweight.** Flask, server-rendered Jinja pages, two small vendored JS libraries
   (charts, map). No build step, no npm, no CDN at runtime, so it works on an isolated host.
5. **Attribution.** Location data is DB-IP City Lite (CC BY 4.0). Every page or export
   that shows locations carries "IP Geolocation by DB-IP" with a link to https://db-ip.com.
   Map tiles carry their own provider's attribution.

## Where it runs

**Recommended:** a host inside the firewall, bound to an internal-only address. Check with
Ming which address is not reachable from outside. Sangala has `10.95.0.1` and `20.95.0.1`
(internal) and `129.112.32.95` (campus-routable, so **do not bind there**).

**Fallback:** bind to `127.0.0.1` and reach it over an SSH tunnel
(`ssh -L 5050:127.0.0.1:5050 sangala`, then open `http://localhost:5050`). This needs no
firewall change at all and is the safest default.

**Python environment:** leda's Anaconda (Python 3.11, Flask 3.1, psycopg2 2.9) does
**not exist on sangala**. Ship a pinned `requirements.txt` and create a venv on whichever
host runs it, so the app does not depend on a cluster-specific Python.

**Process:** a `start.sh {start|stop|restart|status}` modelled on
`/data/ECOD/html/ecod_app/start.sh`: PID file, log file, and an HTTP probe after start.
Serve with `waitress` (pure Python, a single dependency) rather than Flask's dev server.
No cron or systemd is assumed, since both need Ming.

## Database access

New role, created once by the database owner (rschaeff, over the local socket):

```sql
CREATE ROLE usage_reader LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE ecod_usage TO usage_reader;
GRANT USAGE ON SCHEMA public TO usage_reader;
GRANT SELECT ON usage_event_classified, usage_daily, usage_monthly, usage_geo_monthly,
                usage_rollup_daily, usage_rollup_geo TO usage_reader;   -- rollups: see Performance
```

Configuration comes from environment variables (`USAGE_DB_HOST/PORT/NAME/USER/PASSWORD`),
the same names the report script uses, with a `.env` file kept mode 600 and out of git.

## Pages

Every page has a **date range** (presets: last 7 days, 30 days, this month, last month,
last 12 months, grant year from a chosen start date, custom) and a **traffic toggle**:
*people* (default), *automated*, *both*. "People" means the `human` flag from
`usage_event_classified`: the visitor loaded at least one page in a real browser that day.

### 1. Overview (`/`)

- Headline numbers for the range: human visitor-days, page views, release downloads,
  per-domain file downloads, BLAST jobs, Foldseek jobs, searches, public API calls,
  countries reached.
- The same numbers for the previous period of equal length, with the change.
- A small daily sparkline per number.
- One line on automated volume ("plus 412,000 automated requests"), linking to page 6.

### 2. Map (`/map`): for Nick

The centrepiece. A world map of where people use ECOD.

- **Bubbles per city**, sized by visitor-days on a square-root scale (so a big city does
  not swamp everything), coloured by the dominant activity (browsing / downloading /
  running jobs). Hover shows city, country, visitor-days, page views, downloads, jobs.
- **Country shading** (choropleth) as an alternative view, switchable, for when
  city-level points get too dense.
- **Side table:** top countries and cities, sortable, with share of total.
- **Filters:** date range, activity kind (any / page views / downloads / jobs), and the
  traffic toggle. With *automated* selected, the map shows where crawler traffic comes
  from (mostly datacentres), which also answers "where is the fleet coming from" at
  city/country level without ever needing IPs.
- **Animation (nice to have):** a month-by-month play button for talks and slides.
- **Export:** the visible data as CSV, and the map as a PNG for grant documents, both
  with the DB-IP credit embedded.

Implementation: Leaflet 1.9 (vendored). Data comes from a JSON endpoint
(`/api/geo?from=&to=&kind=&traffic=`) that aggregates `usage_rollup_geo`. Coordinates are
already rounded to 0.1° (city centroid) in the database; the map never shows anything
finer. Base map: OpenStreetMap tiles (internal browsers have internet access; the
attribution "© OpenStreetMap contributors" is required). If the host must be fully
offline, fall back to a vendored low-detail world GeoJSON with no tiles.

Data note: locations exist only for events after GeoIP went live (2026-10-12, server
restart pending); earlier events have no location and are counted as "unknown".

### 3. Trends (`/trends`)

- Daily, weekly or monthly line charts per kind, people versus automated stacked.
- Release markers: vertical lines on release dates (from `releases.json`), to show
  download spikes after a release.

### 4. Content (`/content`)

- Top pages by page views, grouped by route type: domain pages, tree, search, groups,
  PDB/protein pages, documentation.
- Top domains, top PDB entries, top groups (from paths).
- Search usage by type: keyword (page views of `/search`), advanced, BLAST, Foldseek.

### 5. Downloads (`/downloads`)

- Release files by download count, grouped by release and file family (domains table,
  F40/F70/F99, BLAST/Foldseek/HH-suite databases).
- Per-domain file downloads (PDB vs FASTA) by people versus automated.
- Note on the page: old direct `/ecod/distributions/...` links bypass the counter and are
  not included (see USAGE_TRACKING.md).

### 6. Automated traffic (`/automated`)

For spotting crawler fleets and scanners.

- Requests per hour, distinct clients per hour (daily visitor hashes), declared bots
  versus clients disguised as browsers.
- What they fetch: kind and route mix, and coverage (distinct domains fetched over time).
- Where from: countries and cities (same data as the map, automated only).
- Beacon junk: page views rejected or with unknown routes, if we later log a counter.

### 7. Grant report (`/report`)

A printable one-page summary for a chosen period, in sentences and tables ready to paste:
"Between 1 Nov 2026 and 31 Oct 2027, ECOD was used by people in N countries, who made
N visits and downloaded N release files ...", plus the monthly table and the map image.
Includes the DB-IP credit and a short methods note (how people are counted, what is
excluded). Export as CSV and print-to-PDF.

## Performance

`usage_event_classified` decides `human` with a correlated `EXISTS` per row. That is fine
today (10 ms on ~20,000 rows), but the crawler fleet alone adds ~100,000 rows a day, so raw
queries will slow down within weeks. The dashboard must read **rollups**, not raw events:

- `usage_rollup_daily (day, site, kind, human, route, detail, events, visitors)`
- `usage_rollup_geo (day, site, kind, human, country, city, lat, lon, events, visitors)`

Built per UTC day from `usage_event_classified`, upserted for "today" and "yesterday" on
each refresh (late-flushed events land in yesterday), and immutable after that.

**Who refreshes them without cron:** the dashboard process itself. A background thread
refreshes at startup and hourly. This needs `INSERT/UPDATE/DELETE` on the two rollup tables
only, so give the refresh its own role (`usage_rollup`) rather than widening `usage_reader`.
If the dashboard is down, rollups simply catch up when it restarts. The same thread can
also run `scripts/update_geoip.sh` monthly, removing the other cron job Ming would
otherwise need. It needs write access to `/data/ECOD/html/geoip`, so it must run as a user
that has it.

**Retention:** raw events are only needed to rebuild rollups. Keep 13 months of raw events
and the rollups forever; the refresh thread deletes raw rows older than that. Decide
before the table reaches tens of millions of rows.

## Layout of the code

Separate from the frontpage repo, or in a top-level `usage_dashboard/` directory of it
that the Next build ignores. Either way it is deployed on its own:

```
usage_dashboard/
  app.py              Flask app factory, routes
  queries.py          all SQL, parameterised, one function per panel
  rollup.py           rollup refresh + retention + optional GeoIP refresh thread
  templates/          base.html + one template per page
  static/             vendored leaflet/, chart.js, world.geojson, app.css
  requirements.txt    flask, psycopg2-binary, waitress (pinned)
  start.sh            start|stop|restart|status
  README.md           setup, roles, tunnel instructions
  tests/              query tests against a throwaway schema
```

## Out of scope

- Any public exposure, user accounts, or per-user views (no auth beyond network
  location, so the internal-only binding is what protects it).
- Real-time streaming; hourly freshness is enough.
- Storing anything new about visitors. If more detail is ever wanted (e.g. IPs for abuse
  investigation), that is a change to the public privacy notice first, not a dashboard feature.

## Open questions

1. **Host and address:** leda, sangala, or another internal machine, and which
   address is internal-only? (Ming)
2. **Tiles:** may browsers on the internal network fetch OpenStreetMap tiles, or must the
   map be fully offline?
3. **Repo:** inside this repo as `usage_dashboard/`, or its own repo?
4. **Retention:** is 13 months of raw events right, given grant periods?
5. **Grant periods:** which date ranges to preset on the report page (e.g. NIH budget
   period start dates)?

## Suggested build order

1. Roles, rollup tables and the refresh thread (everything else depends on them).
2. Map page (Nick's priority), with the CSV/PNG export and attribution.
3. Overview and grant report.
4. Trends, content, downloads, automated traffic.
