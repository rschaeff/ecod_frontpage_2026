import { NextRequest, NextResponse } from 'next/server';
import { getStructures, formatStructureInfo, isValidSource } from '@/lib/predicted-structures';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string; accession: string }> }
) {
  const { source, accession } = await params;

  if (!isValidSource(source)) {
    return NextResponse.json(
      { error: `Invalid source "${source}". Must be one of: epp, uniparc, uniprot` },
      { status: 400 }
    );
  }

  if (!accession) {
    return NextResponse.json(
      { error: 'Accession is required' },
      { status: 400 }
    );
  }

  try {
    const structures = await getStructures(source, accession);

    return NextResponse.json({
      seqSource: source,
      seqAccession: accession,
      structureCount: structures.length,
      structures: structures.map(formatStructureInfo),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Structures lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch structures' },
      { status: 500 }
    );
  }
}
