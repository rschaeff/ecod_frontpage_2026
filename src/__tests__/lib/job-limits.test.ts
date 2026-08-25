import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getClientIp,
  tryAcquire,
  release,
  activeCount,
  maxConcurrentPerIp,
  resetJobLimits,
} from '@/lib/job-limits';

function req(headers: Record<string, string>): never {
  // Only .headers.get() is exercised by getClientIp.
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as never;
}

describe('getClientIp', () => {
  it('takes the first hop of X-Forwarded-For', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' })))
      .toBe('203.0.113.7');
  });

  it('trims whitespace', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '  203.0.113.7 ' }))).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP', () => {
    expect(getClientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('falls back to a shared bucket when neither header is present', () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });

  it('does not treat an empty X-Forwarded-For as an identity', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '', 'x-real-ip': '203.0.113.9' })))
      .toBe('203.0.113.9');
  });
});

describe('maxConcurrentPerIp', () => {
  const original = process.env.MAX_CONCURRENT_JOBS_PER_IP;
  afterEach(() => {
    if (original === undefined) delete process.env.MAX_CONCURRENT_JOBS_PER_IP;
    else process.env.MAX_CONCURRENT_JOBS_PER_IP = original;
  });

  it('defaults to 3', () => {
    delete process.env.MAX_CONCURRENT_JOBS_PER_IP;
    expect(maxConcurrentPerIp()).toBe(3);
  });

  it('honours the env override', () => {
    process.env.MAX_CONCURRENT_JOBS_PER_IP = '5';
    expect(maxConcurrentPerIp()).toBe(5);
  });

  it('ignores junk and non-positive values', () => {
    for (const bad of ['abc', '0', '-2', '']) {
      process.env.MAX_CONCURRENT_JOBS_PER_IP = bad;
      expect(maxConcurrentPerIp()).toBe(3);
    }
  });
});

describe('concurrency cap', () => {
  const IP = '203.0.113.7';
  const OTHER = '198.51.100.4';

  beforeEach(() => {
    resetJobLimits();
    process.env.MAX_CONCURRENT_JOBS_PER_IP = '2';
  });
  afterEach(() => {
    delete process.env.MAX_CONCURRENT_JOBS_PER_IP;
    resetJobLimits();
  });

  it('allows jobs up to the limit and refuses the next', () => {
    expect(tryAcquire(IP, 'a').ok).toBe(true);
    expect(tryAcquire(IP, 'b').ok).toBe(true);

    const denied = tryAcquire(IP, 'c');
    expect(denied.ok).toBe(false);
    expect(denied.active).toBe(2);
    expect(denied.limit).toBe(2);
    expect(activeCount(IP)).toBe(2);
  });

  it('frees a slot on release', () => {
    tryAcquire(IP, 'a');
    tryAcquire(IP, 'b');
    expect(tryAcquire(IP, 'c').ok).toBe(false);

    release(IP, 'a');
    expect(activeCount(IP)).toBe(1);
    expect(tryAcquire(IP, 'c').ok).toBe(true);
  });

  it('isolates clients from each other', () => {
    tryAcquire(IP, 'a');
    tryAcquire(IP, 'b');
    expect(tryAcquire(IP, 'c').ok).toBe(false);

    // A saturated neighbour must not affect this client.
    expect(tryAcquire(OTHER, 'x').ok).toBe(true);
    expect(activeCount(OTHER)).toBe(1);
  });

  it('tolerates duplicate and unknown releases', () => {
    tryAcquire(IP, 'a');
    release(IP, 'a');
    release(IP, 'a');
    release(IP, 'never-existed');
    release('192.0.2.1', 'nor-this');
    expect(activeCount(IP)).toBe(0);
  });

  it('expires stale entries so a missed release cannot lock a client out', () => {
    const realNow = Date.now;
    try {
      let t = 1_000_000;
      Date.now = () => t;

      tryAcquire(IP, 'a');
      tryAcquire(IP, 'b');
      expect(tryAcquire(IP, 'c').ok).toBe(false);

      // Past the 35-minute stale window, with release never called.
      t += 36 * 60 * 1000;
      expect(activeCount(IP)).toBe(0);
      expect(tryAcquire(IP, 'c').ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('does not expire entries that are merely long-running', () => {
    const realNow = Date.now;
    try {
      let t = 1_000_000;
      Date.now = () => t;

      tryAcquire(IP, 'a');
      // A Foldseek job may legitimately run for 30 minutes.
      t += 29 * 60 * 1000;
      expect(activeCount(IP)).toBe(1);
    } finally {
      Date.now = realNow;
    }
  });
});
