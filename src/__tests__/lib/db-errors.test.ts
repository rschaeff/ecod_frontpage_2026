import { describe, it, expect } from 'vitest';
import { isUpstreamUnavailable, errorInit } from '@/lib/db-errors';

/** Shape of the errors `pg` actually throws: an Error with a `code` property. */
function pgError(message: string, code?: string): Error {
  const e = new Error(message) as Error & { code?: string };
  if (code) e.code = code;
  return e;
}

describe('isUpstreamUnavailable', () => {
  it('recognises the socket errors seen during the dione outage', () => {
    // The real one: EPP database unreachable for a week in September 2026.
    expect(isUpstreamUnavailable(pgError('connect ECONNREFUSED 129.112.32.24:45000', 'ECONNREFUSED'))).toBe(true);
    for (const code of ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']) {
      expect(isUpstreamUnavailable(pgError('socket failure', code)), code).toBe(true);
    }
  });

  it('recognises PostgreSQL connection/shutdown SQLSTATEs', () => {
    for (const code of ['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '57P01', '57P02', '57P03', '53300']) {
      expect(isUpstreamUnavailable(pgError('server side', code)), code).toBe(true);
    }
  });

  it('recognises pool failures that carry no code, by message', () => {
    expect(isUpstreamUnavailable(pgError('Connection terminated unexpectedly'))).toBe(true);
    expect(isUpstreamUnavailable(pgError('timeout exceeded when trying to connect'))).toBe(true);
    expect(isUpstreamUnavailable(pgError('Client has encountered a connection error and is not queryable'))).toBe(true);
  });

  it('does NOT treat ordinary query bugs as unavailability', () => {
    // These must stay 500 — they are our fault, not the database being down.
    expect(isUpstreamUnavailable(pgError('syntax error at or near "SELCT"', '42601'))).toBe(false);
    expect(isUpstreamUnavailable(pgError('relation "domian" does not exist', '42P01'))).toBe(false);
    expect(isUpstreamUnavailable(pgError('column "uid" does not exist', '42703'))).toBe(false);
    expect(isUpstreamUnavailable(pgError('duplicate key value violates unique constraint', '23505'))).toBe(false);
    expect(isUpstreamUnavailable(new TypeError('x.map is not a function'))).toBe(false);
  });

  it('is safe on non-error values', () => {
    for (const v of [null, undefined, 'ECONNREFUSED', 42, {}, []]) {
      expect(isUpstreamUnavailable(v)).toBe(false);
    }
  });
});

describe('errorInit', () => {
  it('returns 503 with Retry-After when a dependency is down', () => {
    const init = errorInit(pgError('connect ECONNREFUSED 129.112.32.24:45000', 'ECONNREFUSED'));
    expect(init.status).toBe(503);
    expect(init.headers?.['Retry-After']).toBe('30');
  });

  it('returns a bare 500 for everything else', () => {
    const init = errorInit(pgError('syntax error', '42601'));
    expect(init.status).toBe(500);
    expect(init.headers).toBeUndefined();
  });
});
