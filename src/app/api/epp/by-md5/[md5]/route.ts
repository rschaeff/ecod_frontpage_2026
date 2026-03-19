import { NextRequest, NextResponse } from 'next/server';
import { getProteinsByMd5 } from '@/lib/epp-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ md5: string }> }
) {
  const { md5 } = await params;

  if (!md5 || !/^[a-f0-9]{32}$/i.test(md5)) {
    return NextResponse.json(
      { error: 'Invalid MD5 hash. Expected 32 hex characters.' },
      { status: 400 }
    );
  }

  try {
    const rows = await getProteinsByMd5(md5.toLowerCase());

    return NextResponse.json({
      md5: md5.toLowerCase(),
      count: rows.length,
      proteins: rows.map(r => ({
        accession: r.epp_accession,
        sequenceLength: r.sequence_length,
        organismName: r.organism_name,
        phylum: r.phylum,
        status: r.status,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('EPP MD5 lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to search by MD5' },
      { status: 500 }
    );
  }
}
