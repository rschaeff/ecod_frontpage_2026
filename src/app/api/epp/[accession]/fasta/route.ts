import { NextRequest, NextResponse } from 'next/server';
import { getProteinByAccession, formatFasta } from '@/lib/epp-db';

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

    return new NextResponse(formatFasta(row), {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `inline; filename="${acc}.fasta"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('EPP FASTA error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch protein sequence' },
      { status: 500 }
    );
  }
}
