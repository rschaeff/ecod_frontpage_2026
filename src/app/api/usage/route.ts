import { NextRequest } from 'next/server';
import { clientIp, hasSecFetch, recordUsage } from '@/lib/usage';

/**
 * Page-view beacon from UsageBeacon. Accepts only a path and the document
 * referrer; everything else is derived server-side. Always 204 so a tracking
 * problem is never visible to the visitor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = JSON.parse(await request.text()) as { path?: unknown; referrer?: unknown };
    const ip = clientIp(request.headers) ?? '127.0.0.1';
    if (typeof body.path === 'string' && body.path.startsWith('/')) {
      recordUsage({
        kind: 'pageview',
        path: body.path,
        ip,
        userAgent: request.headers.get('user-agent') ?? '',
        secFetch: hasSecFetch(request.headers),
        referrer: typeof body.referrer === 'string' ? body.referrer : null,
        host: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
      });
    }
  } catch {
    // malformed beacon: ignore
  }
  return new Response(null, { status: 204 });
}
