import { NextRequest, NextResponse } from 'next/server';
import { getDomainsByClan, DomainWithClassification } from '@/lib/domain-queries';
import { lookupClan, getPfamsByClan } from '@/lib/pfam-clans';

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

  if (!acc || !/^CL\d{4}$/i.test(acc)) {
    return NextResponse.json(
      { error: 'Invalid Pfam clan accession. Expected format: CL#### (e.g., CL0129)' },
      { status: 400 }
    );
  }

  const clanAcc = acc.toUpperCase();

  try {
    const clanInfo = lookupClan(clanAcc);
    const clanPfams = getPfamsByClan(clanAcc);

    if (clanPfams.length === 0) {
      return NextResponse.json({
        clan_acc: clanAcc,
        clan_name: null,
        pfam_count: 0,
        pfam_families: [],
        fgroup_count: 0,
        domain_count: 0,
        domains: [],
      }, {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
        },
      });
    }

    const pfamAccs = clanPfams.map(p => p.acc);
    const domains = await getDomainsByClan(pfamAccs);

    // Collect unique F-groups
    const fgroups = new Map<string, string>();
    for (const d of domains) {
      if (d.fid && d.classification.family) {
        fgroups.set(d.fid, d.classification.family.name);
      }
    }

    return NextResponse.json({
      clan_acc: clanAcc,
      clan_name: clanInfo?.name || null,
      pfam_count: clanPfams.length,
      pfam_families: clanPfams.map(p => ({
        acc: p.acc,
        id: p.id,
        description: p.description,
      })),
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
    console.error('v1 Clan lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
