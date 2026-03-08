import { NextRequest, NextResponse } from 'next/server';
import { getDomainByUid } from '@/lib/domain-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  const uidNum = parseInt(uid);
  if (isNaN(uidNum) || uidNum < 0) {
    return NextResponse.json(
      { error: 'Invalid UID. Must be a non-negative integer.' },
      { status: 400 }
    );
  }

  try {
    const domain = await getDomainByUid(uidNum);

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const basePath = process.env.BASE_PATH || '';

    return NextResponse.json({
      uid: domain.uid,
      ecod_domain_id: domain.id,
      type: domain.type,
      source_id: domain.source_id,
      uniprot_acc: domain.unp_acc,
      chain_id: domain.chain_id,
      range: domain.range,
      classification: {
        architecture: domain.classification.architecture,
        x_group: domain.classification.xGroup,
        h_group: domain.classification.hGroup,
        t_group: domain.classification.tGroup,
        family: domain.classification.family,
      },
      is_representative: domain.is_rep,
      is_manual: domain.is_manual,
      files: {
        pdb: `${basePath}/api/v1/domains/${domain.uid}/pdb`,
        fasta: `${basePath}/api/v1/domains/${domain.uid}/fasta`,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('v1 domain lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domain' },
      { status: 500 }
    );
  }
}
