import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainRow {
  uid: number;
  id: string;
  type: string;
  range: string;
  source_id: string | null;
  unp_acc: string | null;
  is_rep: boolean | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clusterId = searchParams.get('cluster');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  if (!clusterId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'MISSING_PARAM', message: 'cluster parameter is required' },
      },
      { status: 400 }
    );
  }

  try {
    // Determine which column to filter on based on cluster ID format
    // F-groups have 3 dots (e.g., "1.1.1.1"), T-groups have 2 dots, etc.
    const dotCount = (clusterId.match(/\./g) || []).length;
    let filterColumn: string;

    if (dotCount === 3) {
      filterColumn = 'fid';
    } else if (dotCount === 2) {
      filterColumn = 'tid';
    } else if (dotCount === 1) {
      // H-group - need to filter by tid prefix
      filterColumn = 'tid';
    } else {
      // X-group or special
      filterColumn = 'tid';
    }

    // Get total count
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM domain
      WHERE ${filterColumn} ${dotCount <= 1 ? 'LIKE $1' : '= $1'}
        AND (is_obsolete IS NULL OR is_obsolete = false)
    `, [dotCount <= 1 ? `${clusterId}.%` : clusterId]);

    const total = parseInt(countResult[0]?.count || '0');

    // Get domains
    const domains = await query<DomainRow>(`
      SELECT uid, id, type::text, range, source_id, unp_acc, is_rep
      FROM domain
      WHERE ${filterColumn} ${dotCount <= 1 ? 'LIKE $1' : '= $1'}
        AND (is_obsolete IS NULL OR is_obsolete = false)
      ORDER BY is_rep DESC NULLS LAST, uid
      LIMIT $2 OFFSET $3
    `, [dotCount <= 1 ? `${clusterId}.%` : clusterId, limit, offset]);

    return NextResponse.json({
      success: true,
      data: {
        domains: domains.map(d => ({
          uid: d.uid,
          id: d.id,
          type: d.type,
          range: d.range,
          sourceId: d.source_id,
          unpAcc: d.unp_acc,
          isRep: d.is_rep,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DOMAINS_ERROR', message: 'Failed to fetch domains' },
      },
      { status: 500 }
    );
  }
}
