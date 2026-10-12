import { NextRequest } from 'next/server';
import { clientIp, isOwnOrigin, isPageviewPath, recordUsage } from '@/lib/usage';

/**
 * Page-view beacon from UsageBeacon. Accepts only a path and the document
 * referrer; everything else is derived server-side. Always 204 so a tracking
 * problem is never visible to the visitor.
 *
 * Only beacons from our own pages with a real route path are recorded. On day one
 * a vulnerability scanner POSTed here directly, and its injection probes made up
 * most of the "page views". Browsers send Origin on every POST, sendBeacon
 * included; Sec-Fetch-Site would be stronger but is sent only over HTTPS, and
 * this site is HTTP, so requiring it silently dropped every real page view.
 */
export async function POST(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const site = request.headers.get('sec-fetch-site');
  if (site ? site !== 'same-origin' : !isOwnOrigin(request.headers.get('origin'), host)) {
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
        referrer: typeof body.referrer === 'string' ? body.referrer : null,
        host,
      });
    }
  } catch {
    // malformed beacon: ignore
  }
  return new Response(null, { status: 204 });
}
