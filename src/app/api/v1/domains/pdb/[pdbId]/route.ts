import { NextRequest, NextResponse } from 'next/server';
import { getDomainsByPdb, DomainWithClassification } from '@/lib/domain-queries';

function formatDomain(d: DomainWithClassification) {
  // Extract chain from source_id (e.g., "1opk_A" -> "A")
  const chainId = d.source_id?.split('_')[1] || d.chain_id;

  return {
    uid: d.uid,
    ecod_domain_id: d.id,
    type: d.type,
    source_id: d.source_id,
    chain_id: chainId,
    range: d.range,
    classification: {
      architecture: d.classification.architecture,
      x_group: d.classification.xGroup,
      h_group: d.classification.hGroup,
      t_group: d.classification.tGroup,
      family: d.classification.family,
    },
    is_representative: d.is_rep,
    is_manual: d.is_manual,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pdbId: string }> }
) {
  const { pdbId } = await params;

  if (!pdbId || !/^[0-9a-zA-Z]{4}$/.test(pdbId)) {
    return NextResponse.json(
      { error: 'Invalid PDB ID. Must be 4 alphanumeric characters.' },
      { status: 400 }
    );
  }

  try {
    const domains = await getDomainsByPdb(pdbId);

    return NextResponse.json({
      pdb_id: pdbId.toUpperCase(),
      domain_count: domains.length,
      domains: domains.map(formatDomain),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('v1 PDB lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
