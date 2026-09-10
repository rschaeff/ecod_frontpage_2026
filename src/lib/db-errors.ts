/**
 * Distinguishing "the database is unreachable" from "something went wrong".
 *
 * These two deserve different HTTP statuses. A 500 says the request was broken;
 * a 503 says the service is temporarily unable to answer and the caller should
 * retry. Returning 500 for a database outage tells monitoring and API consumers
 * that the application is buggy, when in fact a dependency is down.
 *
 * This mattered: the EPP database on dione:45000 was unreachable for a week in
 * September 2026 and nothing noticed, because every failure looked alike.
 */

/**
 * libpq/Node socket-level failures, plus the PostgreSQL SQLSTATE classes that
 * mean the server is up but refusing or dropping work. Class 08 is
 * "connection exception"; 57Pxx is shutdown/startup; 53300 is the connection
 * limit, which is transient in the same way.
 */
const UNAVAILABLE_CODES = new Set([
  // Node / libuv socket errors
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
  'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN',
  // PostgreSQL SQLSTATE — class 08, connection exception
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
  // operator intervention / not accepting connections
  '57P01', '57P02', '57P03',
  // too many connections
  '53300',
]);

/**
 * `pg` reports pool exhaustion and mid-query disconnects as plain Errors with
 * no code, so the message is the only signal available for those.
 */
const UNAVAILABLE_MESSAGES = [
  'connection terminated',
  'connection ended',
  'timeout exceeded when trying to connect',
  'server closed the connection',
  'client has encountered a connection error',
  'called end on pool more than once',
];

/** True when the failure means a backing service is unreachable, not that we have a bug. */
export function isUpstreamUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const { code, message } = error as { code?: unknown; message?: unknown };

  if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) return true;

  if (typeof message === 'string') {
    const lower = message.toLowerCase();
    return UNAVAILABLE_MESSAGES.some((m) => lower.includes(m));
  }

  return false;
}

/**
 * ResponseInit for an error response, chosen from the failure itself. Drop-in
 * for a hardcoded `{ status: 500 }` in a route's catch block:
 *
 *   return NextResponse.json({ ... }, errorInit(error));
 *
 * Retry-After is advisory; it gives well-behaved clients and monitors a hint
 * rather than leaving them to guess.
 */
export function errorInit(error: unknown): { status: number; headers?: Record<string, string> } {
  return isUpstreamUnavailable(error)
    ? { status: 503, headers: { 'Retry-After': '30' } }
    : { status: 500 };
}
