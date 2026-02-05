import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SuperkingdomCount {
  superkingdom: string | null;
  count: string;
}

interface TaxonomyOption {
  value: string;
  count: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const level = searchParams.get('level'); // phylum, class, order, family, genus
  const superkingdoms = searchParams.getAll('superkingdom');
  const parentLevel = searchParams.get('parentLevel');
  const parentValue = searchParams.get('parentValue');

  try {
    // If no level specified, return superkingdom counts
    if (!level) {
      const results = await query<SuperkingdomCount>(`
        SELECT t.superkingdom, COUNT(*) as count
        FROM domain d
        JOIN taxonomy t ON d.tax_id = t.tax_id
        WHERE t.superkingdom IS NOT NULL
          AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
        GROUP BY t.superkingdom
        ORDER BY count DESC
      `);

      return NextResponse.json({
        success: true,
        data: {
          superkingdoms: results.map(r => ({
            name: r.superkingdom,
            count: parseInt(r.count),
          })),
        },
      });
    }

    // Build query for cascading taxonomy options
    const conditions: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    // Filter by superkingdom(s)
    if (superkingdoms.length > 0) {
      const placeholders = superkingdoms.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`t.superkingdom IN (${placeholders})`);
      params.push(...superkingdoms);
    }

    // Filter by parent taxonomy level
    if (parentLevel && parentValue) {
      const col = parentLevel === 'order' ? '"order"' : parentLevel;
      conditions.push(`t.${col} = $${paramIndex++}`);
      params.push(parentValue);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} AND`
      : 'WHERE';

    // Column name (order is reserved keyword)
    const col = level === 'order' ? '"order"' : level;

    const results = await query<TaxonomyOption>(`
      SELECT DISTINCT t.${col} as value, COUNT(*) as count
      FROM taxonomy t
      JOIN domain d ON d.tax_id = t.tax_id
      ${whereClause} t.${col} IS NOT NULL
        AND t.${col} != ''
        AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
      GROUP BY t.${col}
      ORDER BY count DESC
      LIMIT 100
    `, params);

    return NextResponse.json({
      success: true,
      data: {
        options: results.map(r => ({
          value: r.value,
          count: parseInt(r.count),
        })),
      },
    });
  } catch (error) {
    console.error('Taxonomy API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'TAXONOMY_ERROR', message: 'Failed to fetch taxonomy data' },
      },
      { status: 500 }
    );
  }
}
