import { NextRequest, NextResponse } from 'next/server';
import { getDomainsByPfam, DomainWithClassification } from '@/lib/domain-queries';
import { lookupPfam } from '@/lib/pfam-clans';

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
  { params }: { params: Promise<{ acc: string }> }
) {
  const { acc } = await params;

  if (!acc || !/^PF\d{5}$/i.test(acc)) {
    return NextResponse.json(
      { error: 'Invalid Pfam accession. Expected format: PF##### (e.g., PF00077)' },
      { status: 400 }
    );
  }

  const pfamAcc = acc.toUpperCase();

  try {
    const pfamInfo = lookupPfam(pfamAcc);
    const domains = await getDomainsByPfam(pfamAcc);

    // Collect unique F-groups
    const fgroups = new Map<string, string>();
    for (const d of domains) {
      if (d.fid && d.classification.family) {
        fgroups.set(d.fid, d.classification.family.name);
      }
    }

    return NextResponse.json({
      pfam_acc: pfamAcc,
      pfam_id: pfamInfo?.id || null,
      pfam_description: pfamInfo?.description || null,
      clan: pfamInfo?.clan || null,
      fgroup_count: fgroups.size,
      fgroups: Array.from(fgroups.entries()).map(([id, name]) => ({ id, name })),
      domain_count: domains.length,
      domains: domains.map(formatDomain),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('v1 Pfam lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
