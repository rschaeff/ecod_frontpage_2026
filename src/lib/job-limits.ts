import type { NextRequest } from 'next/server';

/**
 * Per-IP concurrent search-job cap.
 *
 * BLAST and Foldseek submits each spawn a detached, multi-threaded child process
 * directly on the web host, with no queue behind them. Without a cap, a single
 * client can hold an unbounded number of them open (a Foldseek job may run for
 * 30 minutes) and saturate the machine. This module bounds the number of jobs
 * one client may have in flight at a time.
 *
 * BLAST and Foldseek share a single pool, so the cap bounds total load per client
 * rather than load per search type.
 *
 * State is in-process and deliberately so: the app runs as a single `node
 * server.js` (see start.sh), and a restart clearing the counters is the correct
 * behaviour — the child processes die with it.
 */

const DEFAULT_MAX_CONCURRENT = 3;

/**
 * Entries older than this are treated as finished even if `release` was never
 * called, so a missed release cannot lock a client out permanently. Must exceed
 * the longest job timeout (Foldseek: 30 min).
 */
const STALE_AFTER_MS = 35 * 60 * 1000;

export function maxConcurrentPerIp(): number {
  const parsed = parseInt(process.env.MAX_CONCURRENT_JOBS_PER_IP || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT;
}

/**
 * The app sits behind an Apache reverse proxy, so the socket address is always
 * the proxy. Trust the first hop in X-Forwarded-For, falling back to X-Real-IP.
 * Clients that present neither share the 'unknown' bucket, which is intentional:
 * an unattributable flood is still rate-limited, just collectively.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

interface ActiveJob {
  jobId: string;
  startedAt: number;
}

const activeJobs = new Map<string, ActiveJob[]>();

function livingJobs(ip: string, now: number): ActiveJob[] {
  const current = activeJobs.get(ip);
  if (!current) return [];
  return current.filter((job) => now - job.startedAt < STALE_AFTER_MS);
}

/** Number of jobs this client currently has in flight. */
export function activeCount(ip: string): number {
  return livingJobs(ip, Date.now()).length;
}

/**
 * Reserve a slot. Returns ok:false when the client is already at the limit;
 * callers should respond 429 and must not spawn anything.
 */
export function tryAcquire(
  ip: string,
  jobId: string
): { ok: boolean; active: number; limit: number } {
  const now = Date.now();
  const limit = maxConcurrentPerIp();
  const living = livingJobs(ip, now);

  if (living.length >= limit) {
    activeJobs.set(ip, living);
    return { ok: false, active: living.length, limit };
  }

  living.push({ jobId, startedAt: now });
  activeJobs.set(ip, living);
  return { ok: true, active: living.length, limit };
}

/** Free a slot. Safe to call more than once, and for unknown ip/jobId pairs. */
export function release(ip: string, jobId: string): void {
  const current = activeJobs.get(ip);
  if (!current) return;

  const remaining = current.filter((job) => job.jobId !== jobId);
  if (remaining.length > 0) {
    activeJobs.set(ip, remaining);
  } else {
    activeJobs.delete(ip);
  }
}

/** Test-only: drop all tracked state. */
export function resetJobLimits(): void {
  activeJobs.clear();
}
