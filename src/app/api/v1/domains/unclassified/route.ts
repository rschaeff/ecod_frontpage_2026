import { NextRequest, NextResponse } from 'next/server';
import { getUnclassifiedDomains, DomainWithClassification } from '@/lib/domain-queries';

function formatDomain(d: DomainWithClassification) {
  return {
    uid: d.uid,
    ecod_domain_id: d.id,
    type: d.type,
    source_id: d.source_id,
    uniprot_acc: d.unp_acc,
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '100'), 1000));
  const offset = (page - 1) * limit;
  const noPfamOnly = searchParams.get('no_pfam_only') === 'true';

  try {
    const { domains, total, fgroups } = await getUnclassifiedDomains(null, {
      noPfamOnly,
      limit,
      offset,
    });

    return NextResponse.json({
      group_id: null,
      group_level: 'global',
      filter: noPfamOnly ? 'no_pfam_only' : 'unclassified',
      filter_description: noPfamOnly
        ? 'All domains in F-groups with no Pfam mapping'
        : 'All domains in .0 (placeholder) F-groups or F-groups with no Pfam mapping',
      unclassified_fgroup_count: fgroups.length,
      unclassified_fgroups: fgroups,
      domain_count: total,
      page,
      page_size: limit,
      total_pages: Math.ceil(total / limit),
      domains: domains.map(formatDomain),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('v1 Global unclassified lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unclassified domains' },
      { status: 500 }
    );
  }
}
