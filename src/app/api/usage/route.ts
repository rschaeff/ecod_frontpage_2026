import { NextRequest } from 'next/server';
import { clientIp, hasSecFetch, isPageviewPath, recordUsage } from '@/lib/usage';

/**
 * Page-view beacon from UsageBeacon. Accepts only a path and the document
 * referrer; everything else is derived server-side. Always 204 so a tracking
 * problem is never visible to the visitor.
 *
 * Only same-origin beacons with a real route path are recorded. On day one a
 * vulnerability scanner POSTed here directly, and its injection probes made up
 * most of the "page views". Browsers mark sendBeacon from our own pages
 * Sec-Fetch-Site: same-origin; a direct POST from elsewhere does not.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return new Response(null, { status: 204 });
  }
  try {
    const body = JSON.parse(await request.text()) as { path?: unknown; referrer?: unknown };
    const ip = clientIp(request.headers) ?? '127.0.0.1';
    if (typeof body.path === 'string' && isPageviewPath(body.path)) {
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
