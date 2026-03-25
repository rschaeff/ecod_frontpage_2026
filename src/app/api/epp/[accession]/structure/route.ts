import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { getBestStructure } from '@/lib/predicted-structures';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accession: string }> }
) {
  const { accession } = await params;

  if (!accession || !/^EPP\d{8}$/i.test(accession)) {
    return NextResponse.json(
      { error: 'Invalid EPP accession. Expected format: EPP00000001' },
      { status: 400 }
    );
  }

  const acc = accession.toUpperCase();
  const method = request.nextUrl.searchParams.get('method') || undefined;

  try {
    const structure = await getBestStructure('epp', acc, method);

    if (!structure) {
      return NextResponse.json(
        { error: method
            ? `No ${method} structure found for ${acc}`
            : `No predicted structure found for ${acc}` },
        { status: 404 }
      );
    }

    if (!structure.cif_path || !existsSync(structure.cif_path)) {
      return NextResponse.json(
        { error: 'Structure file not found on disk' },
        { status: 404 }
      );
    }

    const data = readFileSync(structure.cif_path, 'utf-8');
    const stat = statSync(structure.cif_path);

    const contentType = structure.format === 'cif' || structure.format === 'mmcif'
      ? 'chemical/x-cif'
      : 'chemical/x-pdb';

    const ext = structure.format === 'cif' || structure.format === 'mmcif' ? 'cif' : 'pdb';

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${acc}_${structure.method}.${ext}"`,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('EPP structure error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch structure' },
      { status: 500 }
    );
  }
}
