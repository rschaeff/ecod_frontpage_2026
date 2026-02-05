import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainResult {
  uid: number;
  id: string;
  type: string;
  range: string;
  source_id: string | null;
  unp_acc: string | null;
  fid: string | null;
  tid: string | null;
  is_rep: boolean | null;
  organism_name: string | null;
  superkingdom: string | null;
  protein_name: string | null;
}

interface CountResult {
  count: string;
}

interface SummaryResult {
  superkingdom: string | null;
  count: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Filters
  const superkingdoms = searchParams.getAll('superkingdom');
  const phylum = searchParams.get('phylum');
  const taxClass = searchParams.get('class');
  const order = searchParams.get('order');
  const family = searchParams.get('family');
  const genus = searchParams.get('genus');
  const keyword = searchParams.get('keyword');
  const ecodClass = searchParams.get('ecod_class');
  const structureSource = searchParams.get('structure_source') || 'all';

  try {
    // Build WHERE clause
    const conditions: string[] = ['(d.is_obsolete IS NULL OR d.is_obsolete = false)'];
    const params: string[] = [];
    let paramIndex = 1;

    // Superkingdom filter (multiple selection)
    if (superkingdoms.length > 0) {
      const placeholders = superkingdoms.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`t.superkingdom IN (${placeholders})`);
      params.push(...superkingdoms);
    }

    // Lower taxonomy filters
    if (phylum) {
      conditions.push(`t.phylum = $${paramIndex++}`);
      params.push(phylum);
    }
    if (taxClass) {
      conditions.push(`t.class = $${paramIndex++}`);
      params.push(taxClass);
    }
    if (order) {
      conditions.push(`t."order" = $${paramIndex++}`);
      params.push(order);
    }
    if (family) {
      conditions.push(`t.family = $${paramIndex++}`);
      params.push(family);
    }
    if (genus) {
      conditions.push(`t.genus = $${paramIndex++}`);
      params.push(genus);
    }

    // Keyword filter (protein name or organism name)
    if (keyword) {
      conditions.push(`(u.full_name ILIKE $${paramIndex} OR t.organism_name ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    // ECOD classification filter
    if (ecodClass) {
      conditions.push(`(d.fid LIKE $${paramIndex} OR d.tid LIKE $${paramIndex})`);
      params.push(`${ecodClass}%`);
      paramIndex++;
    }

    // Structure source filter
    if (structureSource === 'experimental') {
      conditions.push(`d.type = 'experimental structure'`);
    } else if (structureSource === 'predicted') {
      conditions.push(`d.type = 'computed structural model'`);
    }

    // Check if any taxonomy filter is applied (requires JOIN to taxonomy)
    const hasTaxonomyFilter = superkingdoms.length > 0 || phylum || taxClass || order || family || genus;

    if (!hasTaxonomyFilter && !keyword && !ecodClass && structureSource === 'all') {
      return NextResponse.json({
        success: true,
        data: {
          domains: [],
          total: 0,
          page,
          totalPages: 0,
          summary: [],
          message: 'Please select at least one filter criterion',
        },
      });
    }

    const whereClause = conditions.join(' AND ');

    // Build JOIN clause
    const joins = `
      ${hasTaxonomyFilter || keyword ? 'JOIN taxonomy t ON d.tax_id = t.tax_id' : 'LEFT JOIN taxonomy t ON d.tax_id = t.tax_id'}
      LEFT JOIN unp_info u ON d.unp_acc = u.unp_acc
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT d.uid) as count
      FROM domain d
      ${joins}
      WHERE ${whereClause}
    `;
    const countResult = await query<CountResult>(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0');

    // Get results
    const resultsQuery = `
      SELECT DISTINCT
        d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc,
        d.fid, d.tid, d.is_rep,
        t.organism_name, t.superkingdom,
        u.full_name as protein_name
      FROM domain d
      ${joins}
      WHERE ${whereClause}
      ORDER BY t.superkingdom NULLS LAST, d.uid
      LIMIT ${limit} OFFSET ${offset}
    `;
    const domains = await query<DomainResult>(resultsQuery, params);

    // Get taxonomy summary for results
    const summaryQuery = `
      SELECT t.superkingdom, COUNT(DISTINCT d.uid) as count
      FROM domain d
      ${joins}
      WHERE ${whereClause}
      GROUP BY t.superkingdom
      ORDER BY count DESC
    `;
    const summary = await query<SummaryResult>(summaryQuery, params);

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
          fid: d.fid,
          tid: d.tid,
          isRep: d.is_rep,
          organism: d.organism_name,
          superkingdom: d.superkingdom,
          proteinName: d.protein_name,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: summary.map(s => ({
          superkingdom: s.superkingdom,
          count: parseInt(s.count),
        })),
      },
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SEARCH_ERROR', message: 'Advanced search failed' },
      },
      { status: 500 }
    );
  }
}
