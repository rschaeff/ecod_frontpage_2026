/**
 * Anonymous, cookieless usage statistics (for grant reporting).
 *
 * Server-only. Nothing is stored on the visitor's device, so no consent banner is
 * needed under the ePrivacy rules; the IP address is processed only transiently
 * under legitimate interest (GDPR Art. 6(1)(f)) and is never written anywhere.
 * See sql/usage_tracking.sql for the schema and /privacy for the public notice.
 *
 * Location: when GEOIP_DB points at a City-level .mmdb (DB-IP "IP to City Lite",
 * CC BY 4.0, or MaxMind GeoLite2-City), each IP is looked up at flush time and
 * only country, city and coordinates rounded to 0.1 degree (~10 km, the city
 * centroid, not the visitor) are kept. Without it the location columns stay null.
 *
 * Recording never blocks or fails a request: events are buffered in memory and
 * flushed in batches, and a flush that fails is logged and dropped.
 */
import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';
import maxmind, { CityResponse, Reader } from 'maxmind';

export type UsageKind =
  | 'pageview'      // a page shown in a browser (client beacon)
  | 'search'        // advanced search, or /api/search called from outside the app
  | 'blast'         // BLAST job submitted
  | 'foldseek'      // Foldseek job submitted
  | 'api'           // public /api/v1 call
  | 'file'          // per-domain / per-protein file download (PDB, FASTA, model)
  | 'structure_view' // the same files fetched by the in-page 3D viewer
  | 'bulk_download'; // release file from the distribution page

export interface UsageInput {
  kind: UsageKind;
  path: string;
  detail?: string | null;
  ip: string;
  userAgent: string;
  referrer?: string | null;
  host?: string | null;
}

interface Buffered extends UsageInput {
  ts: Date;
}

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_BATCH = 200;
const MAX_BUFFER = 10_000;

const site = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';

let buffer: Buffered[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing = false;
let lastErrorLog = 0;
let pool: Pool | null = null;
const salts = new Map<string, string>();
let geoReader: Promise<Reader<CityResponse> | null> | null = null;

export function usageEnabled(): boolean {
  return process.env.USAGE_TRACKING !== 'off';
}

function getPool(): Pool {
  if (!pool) {
    const env = process.env;
    pool = new Pool({
      host: env.USAGE_DB_HOST || env.DB_HOST || 'sangala',
      port: parseInt(env.USAGE_DB_PORT || env.DB_PORT || '45000'),
      database: env.USAGE_DB_NAME || env.DB_NAME || 'ecod_af2_pdb',
      user: env.USAGE_DB_USER || env.DB_USER || 'ecodweb',
      password: env.USAGE_DB_PASSWORD || env.DB_PASSWORD,
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
    });
    pool.on('error', (err) => console.error('Usage DB pool error:', err.message));
  }
  return pool;
}

/** First hop of X-Forwarded-For, as the rate limiter uses. */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip');
}

/**
 * Next's server fills in X-Forwarded-For from the socket when it is absent, so the
 * app's own server-side fetches arrive with a loopback address, while real
 * traffic carries the client address set by the reverse proxy.
 */
export function isLoopback(ip: string | null): boolean {
  if (!ip) return true;
  const a = ip.replace(/^::ffff:/, '');
  return a === '::1' || a.startsWith('127.');
}

const BOT_RE =
  /bot|crawl|spider|slurp|scrap|headless|lighthouse|preview|monitor|uptime|curl|wget|python|java\/|go-http|libwww|httpclient|okhttp|axios|node-fetch|undici|perl|ruby|^r |httr|bioconductor|postman|insomnia/i;

/**
 * Declared automated client (crawler, script, pipeline). Empty UAs count as
 * automated. Clients that fake a browser are not caught here; reports separate them
 * by whether the visitor ever ran a page (usage_event_classified in the SQL).
 *
 * Do not use Sec-Fetch-* headers for any of this: the site is served over plain
 * HTTP, and browsers send them only to HTTPS origins, so no real visitor has them.
 */
export function isBot(userAgent: string): boolean {
  return !userAgent.trim() || BOT_RE.test(userAgent);
}

/** Origin header names this site (works over HTTP, unlike Sec-Fetch-Site). */
export function isOwnOrigin(origin: string | null, ownHost?: string | null): boolean {
  if (!origin) return false;
  try {
    const h = new URL(origin).hostname.toLowerCase();
    return OWN_HOSTS.has(h) || (!!ownHost && h === ownHost.split(':')[0].toLowerCase());
  } catch {
    return false;
  }
}

/** Request made by the in-page 3D viewer, which lives at <basePath>/viewer/. */
export function isViewerReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    return new URL(referrer).pathname.includes('/viewer/');
  } catch {
    return false;
  }
}

// Public host names of this site. The Host header behind the reverse proxy is the
// internal one (localhost:3004), so it alone cannot tell our own pages apart.
const OWN_HOSTS = new Set(
  (process.env.USAGE_OWN_HOSTS || 'prodata.swmed.edu').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
);

/** Host of an external referrer; null for none, malformed, or same-site. */
export function referrerHost(referrer: string | null | undefined, ownHost?: string | null): string | null {
  if (!referrer) return null;
  try {
    const h = new URL(referrer).hostname.toLowerCase();
    if (!h || OWN_HOSTS.has(h)) return null;
    const own = ownHost?.split(':')[0].toLowerCase();
    return own && h === own ? null : h.slice(0, 255);
  } catch {
    return null;
  }
}

// Top-level routes of the app (src/app); a page view for anything else is not ours.
const PAGE_ROUTES = new Set([
  '', 'compound', 'distribution', 'documentation', 'domain', 'epp', 'group',
  'news', 'pdb', 'privacy', 'protein', 'search', 'tree',
]);

/** A path the beacon may report: a known route, plain identifier characters only. */
export function isPageviewPath(path: string): boolean {
  if (path.length > 256 || !/^\/[A-Za-z0-9._:\/-]*$/.test(path)) return false;
  return PAGE_ROUTES.has(path.split('/')[1]);
}

/** Path only, never the query string or fragment, bounded in length. */
export function cleanPath(path: string): string {
  const p = path.split(/[?#]/)[0] || '/';
  return p.slice(0, 512);
}

export function visitorHash(salt: string, ip: string, userAgent: string): string {
  return createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex').slice(0, 16);
}

export interface GeoLocation {
  country: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
}

const NO_GEO: GeoLocation = { country: null, city: null, lat: null, lon: null };

function round1(x: number | undefined): number | null {
  return typeof x === 'number' ? Math.round(x * 10) / 10 : null;
}

export function geoFromRecord(r: CityResponse | null | undefined): GeoLocation {
  if (!r) return NO_GEO;
  return {
    country: r.country?.iso_code ?? r.registered_country?.iso_code ?? null,
    city: r.city?.names?.en ?? null,
    lat: round1(r.location?.latitude),
    lon: round1(r.location?.longitude),
  };
}

/** Lazily opened once; a missing or unreadable file disables geo, not tracking. */
function getGeoReader(): Promise<Reader<CityResponse> | null> {
  if (!geoReader) {
    const file = process.env.GEOIP_DB;
    geoReader = file
      ? maxmind.open<CityResponse>(file, { watchForUpdates: true, watchForUpdatesNonPersistent: true })
          .catch((err) => {
            console.error(`GeoIP database ${file} unavailable, locations disabled:`, err.message);
            return null;
          })
      : Promise.resolve(null);
  }
  return geoReader;
}

async function locate(ip: string): Promise<GeoLocation> {
  const reader = await getGeoReader();
  if (!reader || !maxmind.validate(ip)) return NO_GEO;
  try {
    return geoFromRecord(reader.get(ip));
  } catch {
    return NO_GEO;
  }
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The salt for a UTC day, shared by every process through usage_salt so a restart
 * mid-day does not split one visitor into two. Salts older than yesterday are
 * deleted (yesterday's survives only so events buffered across midnight can still
 * be flushed), which makes older hashes permanently unlinkable.
 */
async function saltFor(day: string): Promise<string> {
  const cached = salts.get(day);
  if (cached) return cached;
  const db = getPool();
  await db.query(
    'INSERT INTO usage_salt (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING',
    [day, randomBytes(32).toString('hex')]
  );
  const { rows } = await db.query<{ salt: string }>('SELECT salt FROM usage_salt WHERE day = $1', [day]);
  await db.query("DELETE FROM usage_salt WHERE day < (now() AT TIME ZONE 'UTC')::date - 1");
  for (const k of salts.keys()) if (k < day) salts.delete(k);
  salts.set(day, rows[0].salt);
  return rows[0].salt;
}

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer;
  buffer = [];
  try {
    const values: (string | boolean | number | Date | null)[] = [];
    const tuples: string[] = [];
    for (const e of batch) {
      const salt = await saltFor(utcDay(e.ts));
      const geo = await locate(e.ip);
      const n = values.length;
      tuples.push(`(${Array.from({ length: 12 }, (_, i) => `$${n + i + 1}`).join(',')})`);
      values.push(
        e.ts,
        site,
        e.kind,
        cleanPath(e.path),
        e.detail ? e.detail.slice(0, 256) : null,
        visitorHash(salt, e.ip, e.userAgent),
        isBot(e.userAgent),
        referrerHost(e.referrer, e.host),
        geo.country,
        geo.city,
        geo.lat,
        geo.lon,
      );
    }
    await getPool().query(
      `INSERT INTO usage_event (ts, site, kind, path, detail, visitor, is_bot, referrer_host,
                                country, city, lat, lon)
       VALUES ${tuples.join(',')}`,
      values
    );
  } catch (err) {
    // At most one log line per 10 minutes, so a missing table cannot flood the log.
    if (Date.now() - lastErrorLog > 600_000) {
      lastErrorLog = Date.now();
      console.error(`Usage flush failed, dropped ${batch.length} events:`, err instanceof Error ? err.message : err);
    }
  } finally {
    flushing = false;
  }
}

/** Queue one event. Never throws, never awaits the database. */
export function recordUsage(input: UsageInput): void {
  if (!usageEnabled()) return;
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ ...input, ts: new Date() });
  if (buffer.length >= FLUSH_BATCH) {
    void flush();
  } else if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, FLUSH_INTERVAL_MS);
    timer.unref?.();
  }
}

/**
 * Which tracked category an /api request belongs to, or null for traffic that is
 * not counted on its own (the app's internal data fetches are already counted as
 * the page view that triggered them; job polling would inflate everything).
 * `pathname` excludes the basePath, as request.nextUrl.pathname does.
 */
export function classifyApiRequest(pathname: string, method: string): { kind: UsageKind; detail?: string } | null {
  if (method === 'POST' && pathname === '/api/blast/submit') return { kind: 'blast' };
  if (method === 'POST' && pathname === '/api/foldseek/submit') return { kind: 'foldseek' };
  if (method !== 'GET') return null;
  if (pathname === '/api/search/advanced') return { kind: 'search', detail: 'advanced' };
  if (pathname === '/api/search') return { kind: 'search', detail: 'api' };
  if (pathname.startsWith('/api/v1/') && pathname !== '/api/v1/health') {
    return { kind: 'api', detail: pathname.split('/').slice(3, 5).join('/') };
  }
  if (/^\/api\/domain\/[^/]+\/(pdb|fasta)$/.test(pathname)) return { kind: 'file', detail: pathname.split('/').pop() };
  if (/^\/api\/epp\/[^/]+\/fasta$/.test(pathname)) return { kind: 'file', detail: 'epp_fasta' };
  if (/^\/api\/structures\/[^/]+\/[^/]+\/download$/.test(pathname)) return { kind: 'file', detail: 'model' };
  return null;
}
