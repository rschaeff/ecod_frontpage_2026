import { NextRequest, NextResponse } from 'next/server';
import { clientIp, hasSecFetch, recordUsage } from '@/lib/usage';

// Same target the distribution index publishes; the release files themselves are
// still served by the legacy Apache tree.
const BASE_URL = 'http://prodata.swmed.edu/ecod/distributions';
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

/**
 * Counting redirect for release files. The distribution page links here instead of
 * straight to the file, so a download is counted whether it is clicked in a
 * browser or the link is copied into wget/curl. Only names that look like files
 * under the distributions tree are accepted, and the destination is always that
 * tree, so this cannot be used as an open redirect.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;
  if (!file.length || !file.every((s) => SEGMENT.test(s))) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }
  const name = file.join('/');
  recordUsage({
    kind: 'bulk_download',
    path: '/distribution',
    detail: name,
    ip: clientIp(request.headers) ?? '127.0.0.1',
    userAgent: request.headers.get('user-agent') ?? '',
    secFetch: hasSecFetch(request.headers),
    referrer: request.headers.get('referer'),
    host: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
  });
  return NextResponse.redirect(`${BASE_URL}/${name}`, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  });
}
