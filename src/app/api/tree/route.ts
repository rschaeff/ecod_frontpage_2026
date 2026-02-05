import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ClusterRow {
  id: string;
  type: string;
  name: string;
  parent: string | null;
  domain_number: number | null;
  child_count: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parentId = searchParams.get('parent');

  try {
    let clusters: ClusterRow[];

    if (!parentId) {
      // Fetch root level - Architectures (type = 'A')
      clusters = await query<ClusterRow>(`
        SELECT
          c.id,
          c.type,
          c.name,
          c.parent,
          c.domain_number,
          (SELECT COUNT(*) FROM cluster WHERE parent = c.id)::text as child_count
        FROM cluster c
        WHERE c.type = 'A' AND (c.is_obsolete IS NULL OR c.is_obsolete = false)
        ORDER BY c.ordinal NULLS LAST, c.id
      `);
    } else {
      // Fetch children of the given parent
      clusters = await query<ClusterRow>(`
        SELECT
          c.id,
          c.type,
          c.name,
          c.parent,
          c.domain_number,
          (SELECT COUNT(*) FROM cluster WHERE parent = c.id)::text as child_count
        FROM cluster c
        WHERE c.parent = $1 AND (c.is_obsolete IS NULL OR c.is_obsolete = false)
        ORDER BY c.ordinal NULLS LAST, c.id
      `, [parentId]);
    }

    // Transform to tree nodes
    const nodes = clusters.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name || `Unnamed ${c.type}-group`,
      parent: c.parent,
      domainCount: c.domain_number,
      childCount: parseInt(c.child_count) || 0,
      hasChildren: parseInt(c.child_count) > 0,
    }));

    return NextResponse.json({
      success: true,
      data: nodes,
    });
  } catch (error) {
    console.error('Error fetching tree:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TREE_ERROR',
          message: 'Failed to fetch tree data',
        },
      },
      { status: 500 }
    );
  }
}
