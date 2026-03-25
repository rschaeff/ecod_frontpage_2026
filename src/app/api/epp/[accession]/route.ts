import { NextRequest, NextResponse } from 'next/server';
import { getProteinByAccession, formatProteinResponse } from '@/lib/epp-db';
import { getStructures, formatStructureInfo } from '@/lib/predicted-structures';

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

  try {
    const row = await getProteinByAccession(acc);

    if (!row) {
      return NextResponse.json(
        { error: `Protein ${acc} not found` },
        { status: 404 }
      );
    }

    const structures = await getStructures('epp', acc);
    const response = formatProteinResponse(row);
    response.structures = structures.map(formatStructureInfo);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('EPP lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch protein' },
      { status: 500 }
    );
  }
}
