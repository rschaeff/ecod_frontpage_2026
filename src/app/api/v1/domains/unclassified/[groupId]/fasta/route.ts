import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { getUnclassifiedUids, getDomainDataPath } from '@/lib/domain-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  if (!groupId || !/^\d+(\.\d+)*$/.test(groupId)) {
    return NextResponse.json(
      { error: 'Invalid ECOD group ID. Expected dot-separated numbers (e.g., 1, 1.2, 1.2.3)' },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const noPfamOnly = searchParams.get('no_pfam_only') === 'true';

  try {
    const uids = await getUnclassifiedUids(groupId, { noPfamOnly });

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
          controller.enqueue(encoder.encode(`# No FASTA files found for unclassified domains in group ${groupId}\n`));
        }

        controller.close();
      },
    });

    const filterLabel = noPfamOnly ? 'no_pfam' : 'unclassified';

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="ecod_${filterLabel}_${groupId}.fasta"`,
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
