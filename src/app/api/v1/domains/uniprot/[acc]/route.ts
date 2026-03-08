import { NextRequest, NextResponse } from 'next/server';
import { getDomainsByUniprot, DomainWithClassification } from '@/lib/domain-queries';

function formatDomain(d: DomainWithClassification) {
  return {
    uid: d.uid,
    ecod_domain_id: d.id,
    type: d.type,
    source_id: d.source_id,
    chain_id: d.chain_id,
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
  { params }: { params: Promise<{ acc: string }> }
) {
  const { acc } = await params;

  if (!acc || acc.length < 4) {
    return NextResponse.json(
      { error: 'Invalid UniProt accession' },
      { status: 400 }
    );
  }

  try {
    const domains = await getDomainsByUniprot(acc.toUpperCase());

    return NextResponse.json({
      uniprot_acc: acc.toUpperCase(),
      domain_count: domains.length,
      domains: domains.map(formatDomain),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('v1 UniProt lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
