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
    kind          text        NOT NULL,           -- pageview | search | blast | foldseek | api | file | bulk_download
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

-- One row per UTC day and kind, humans only. `visitors` is distinct daily hashes.
CREATE OR REPLACE VIEW usage_daily AS
SELECT (ts AT TIME ZONE 'UTC')::date AS day,
       site,
       kind,
       count(*)                AS events,
       count(DISTINCT visitor) AS visitors
FROM usage_event
WHERE NOT is_bot
GROUP BY 1, 2, 3;

-- Monthly roll-up for reports. `visitor_days` sums daily uniques (a visitor seen on
-- 3 days counts 3); true monthly uniques are deliberately not recoverable.
-- `bot_events` is kept separate: programmatic access (pipelines, wget of
-- distributables) is real usage worth reporting, but not as "visitors".
CREATE OR REPLACE VIEW usage_monthly AS
SELECT date_trunc('month', ts AT TIME ZONE 'UTC')::date AS month,
       site,
       kind,
       count(*) FILTER (WHERE NOT is_bot) AS events,
       count(*) FILTER (WHERE is_bot)     AS bot_events,
       count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor)
             FILTER (WHERE NOT is_bot)    AS visitor_days
FROM usage_event
GROUP BY 1, 2, 3;

-- The app role only needs to insert events and manage the salt.
-- GRANT INSERT, SELECT ON usage_event TO ecodweb;
-- GRANT USAGE ON SEQUENCE usage_event_id_seq TO ecodweb;
-- GRANT SELECT, INSERT, DELETE ON usage_salt TO ecodweb;

-- Map / grant table: where human visitors come from, by month.
CREATE OR REPLACE VIEW usage_geo_monthly AS
SELECT date_trunc('month', ts AT TIME ZONE 'UTC')::date AS month,
       country, city, lat, lon,
       count(*) AS events,
       count(DISTINCT (ts AT TIME ZONE 'UTC')::date::text || visitor) AS visitor_days
FROM usage_event
WHERE NOT is_bot AND country IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;
