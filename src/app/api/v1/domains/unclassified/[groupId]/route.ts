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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  // Validate group ID format: dot-separated numbers (e.g., "1", "1.2", "1.2.3", "1.2.3.4")
  if (!groupId || !/^\d+(\.\d+)*$/.test(groupId)) {
    return NextResponse.json(
      { error: 'Invalid ECOD group ID. Expected dot-separated numbers (e.g., 1, 1.2, 1.2.3)' },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '100'), 1000));
  const offset = (page - 1) * limit;
  const noPfamOnly = searchParams.get('no_pfam_only') === 'true';

  // Determine group level for description
  const dotCount = (groupId.match(/\./g) || []).length;
  const levelNames = ['X-group', 'H-group', 'T-group', 'F-group'];
  const levelName = levelNames[dotCount] || 'group';

  try {
    const { domains, total, fgroups } = await getUnclassifiedDomains(groupId, {
      noPfamOnly,
      limit,
      offset,
    });

    return NextResponse.json({
      group_id: groupId,
      group_level: levelName,
      filter: noPfamOnly ? 'no_pfam_only' : 'unclassified',
      filter_description: noPfamOnly
        ? 'Domains in F-groups with no Pfam mapping'
        : 'Domains in .0 (placeholder) F-groups or F-groups with no Pfam mapping',
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
    console.error('v1 Unclassified lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unclassified domains' },
      { status: 500 }
    );
  }
}
