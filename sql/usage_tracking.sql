-- Anonymous usage statistics for ECOD (grant reporting).
--
-- Intended to live in its OWN database (e.g. `ecod_usage`), not in ecod_af2_pdb:
-- the release sync rewrites that database, and usage history must survive it.
-- The app reaches it through USAGE_DB_* env vars, which fall back to DB_*.
--
-- Privacy model (see /privacy):
--   * No cookies or browser storage; nothing is written to the visitor's device.
--   * Raw IP addresses and user agents are never stored. `visitor` is
--     sha256(daily_salt || ip || user_agent) truncated to 16 hex chars.
--   * The salt is random, lives one UTC day in usage_salt, and is then deleted,
--     after which no hash can be linked back to an IP, or to the same visitor on
--     another day. Unique visitors are therefore countable per day only.
--   * Only the path is stored, never the query string (searches can contain
--     user-supplied sequences). The referrer is reduced to its host name.
--   * Location is looked up from the IP at write time (local GeoIP file, no
--     third-party call) and only country, city and the city's coordinates rounded
--     to 0.1 degree are kept.

CREATE TABLE IF NOT EXISTS usage_event (
    id            bigserial   PRIMARY KEY,
    ts            timestamptz NOT NULL DEFAULT now(),
    site          text        NOT NULL,           -- basePath of the instance, '' for root
    kind          text        NOT NULL,           -- pageview | search | blast | foldseek | api | file | structure_view | bulk_download
    path          text        NOT NULL,
    detail        text,                           -- kind-specific, e.g. file name for bulk_download
    visitor       char(16)    NOT NULL,           -- daily-salted hash; unlinkable after the day ends
    is_bot        boolean     NOT NULL DEFAULT false,
    referrer_host text,
    country       char(2),                        -- ISO 3166-1 alpha-2
    city          text,
    lat           real,                           -- city centroid, 0.1 degree
    lon           real
);

CREATE INDEX IF NOT EXISTS usage_event_ts_idx   ON usage_event (ts);
CREATE INDEX IF NOT EXISTS usage_event_kind_idx ON usage_event (kind, ts);

CREATE TABLE IF NOT EXISTS usage_salt (
    day  date PRIMARY KEY,
    salt text NOT NULL
);

-- Who counts as a person. is_bot (user agent and Sec-Fetch headers) is not enough:
-- on day one a crawler fleet sent full browser headers while fetching files, and
-- never ran JavaScript. So an event is `human` only when its visitor also fired
-- at least one browser page view (which needs JavaScript) that day. Everything
-- else is "automated": crawlers, scripts, pipelines, API clients. That is real
-- usage, reported separately.
DROP VIEW IF EXISTS usage_daily, usage_monthly, usage_geo_monthly, usage_event_classified;
CREATE VIEW usage_event_classified AS
SELECT e.*,
       (e.ts AT TIME ZONE 'UTC')::date AS day,
       NOT e.is_bot AND EXISTS (
           SELECT 1 FROM usage_event p
           WHERE p.kind = 'pageview' AND NOT p.is_bot AND p.visitor = e.visitor
             AND (p.ts AT TIME ZONE 'UTC')::date = (e.ts AT TIME ZONE 'UTC')::date
       ) AS human
FROM usage_event e;

-- One row per UTC day and kind, humans only. `visitors` is distinct daily hashes.
CREATE VIEW usage_daily AS
SELECT day, site, kind,
       count(*)                AS events,
       count(DISTINCT visitor) AS visitors
FROM usage_event_classified
WHERE human
GROUP BY 1, 2, 3;

-- Monthly roll-up for reports. `visitor_days` sums daily uniques (a visitor seen on
-- 3 days counts 3); true monthly uniques are deliberately not recoverable.
-- `automated_events` covers everything not counted as a person (see above).
CREATE VIEW usage_monthly AS
SELECT date_trunc('month', day)::date AS month, site, kind,
       count(*) FILTER (WHERE human)     AS events,
       count(*) FILTER (WHERE NOT human) AS automated_events,
       count(DISTINCT day::text || visitor) FILTER (WHERE human) AS visitor_days
FROM usage_event_classified
GROUP BY 1, 2, 3;

-- Map / grant table: where human visitors come from, by month.
CREATE VIEW usage_geo_monthly AS
SELECT date_trunc('month', day)::date AS month,
       country, city, lat, lon,
       count(*) AS events,
       count(DISTINCT day::text || visitor) AS visitor_days
FROM usage_event_classified
WHERE human AND country IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX IF NOT EXISTS usage_event_pageview_idx ON usage_event (visitor, ts) WHERE kind = 'pageview';

-- The app role only needs to insert events and manage the salt.
-- GRANT INSERT, SELECT ON usage_event TO ecodweb;
-- GRANT USAGE ON SEQUENCE usage_event_id_seq TO ecodweb;
-- GRANT SELECT, INSERT, DELETE ON usage_salt TO ecodweb;
-- GRANT SELECT ON usage_event_classified, usage_daily, usage_monthly, usage_geo_monthly TO ecodweb;
