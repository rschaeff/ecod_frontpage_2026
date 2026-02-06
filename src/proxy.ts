import { NextRequest, NextResponse } from 'next/server';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

// Clean up old buckets every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  windowMs: number;
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  if (pathname.startsWith('/api/blast/submit') || pathname.startsWith('/api/foldseek/submit')) {
    return { maxTokens: 5, refillRate: 5 / 60, windowMs: 60000 };
  }
  if (pathname.startsWith('/api/search')) {
    return { maxTokens: 30, refillRate: 30 / 60, windowMs: 60000 };
  }
  return { maxTokens: 60, refillRate: 60 / 60, windowMs: 60000 };
}

function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true, retryAfter: 0 };
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / config.refillRate);
    return { allowed: false, retryAfter };
  }

  bucket.tokens -= 1;
  return { allowed: true, retryAfter: 0 };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Periodic cleanup of old buckets
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > CLEANUP_INTERVAL) {
        buckets.delete(key);
      }
    }
  }

  const ip = getClientIP(request);
  const config = getRateLimitConfig(pathname);
  const bucketKey = `${ip}:${pathname.split('/').slice(0, 4).join('/')}`;

  const { allowed, retryAfter } = checkRateLimit(bucketKey, config);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
