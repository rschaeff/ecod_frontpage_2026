import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { getUnclassifiedUids, getDomainDataPath } from '@/lib/domain-queries';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const noPfamOnly = searchParams.get('no_pfam_only') === 'true';

  try {
    const uids = await getUnclassifiedUids(null, { noPfamOnly });

    if (uids.length === 0) {
      return new NextResponse('', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let written = 0;

        for (const uid of uids) {
          const faPath = getDomainDataPath(uid, 'fa');
          if (!existsSync(faPath)) continue;

          try {
            const content = await readFile(faPath, 'utf-8');
            controller.enqueue(encoder.encode(content));
            if (!content.endsWith('\n')) {
              controller.enqueue(encoder.encode('\n'));
            }
            written++;
          } catch {
            // Skip unreadable files
          }
        }

        if (written === 0) {
          controller.enqueue(encoder.encode('# No FASTA files found for unclassified domains\n'));
        }

        controller.close();
      },
    });

    const filterLabel = noPfamOnly ? 'no_pfam' : 'unclassified';

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="ecod_${filterLabel}_domains.fasta"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
        'X-Domain-Count': uids.length.toString(),
      },
    });
  } catch (error) {
    console.error('Unclassified FASTA error:', error);
    return NextResponse.json(
      { error: 'Failed to generate FASTA' },
      { status: 500 }
    );
  }
}
