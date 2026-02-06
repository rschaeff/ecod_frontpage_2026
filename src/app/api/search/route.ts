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
}

interface ClusterResult {
  id: string;
  type: string;
  name: string;
  parent: string | null;
}

// Detect search type from query
function detectSearchType(q: string): 'uid' | 'domain_id' | 'unp_acc' | 'pdb_id' | 'cluster_id' | 'keyword' {
  // Domain ID: starts with 'e' followed by 4 chars + more
  if (/^e[0-9a-z]{4}/i.test(q)) {
    return 'domain_id';
  }

  // Cluster ID: number WITH dots (e.g., 1.2.3) - must have at least one dot
  if (/^\d+\.\d+(\.\d+)*$/.test(q)) {
    return 'cluster_id';
  }

  // UID: pure number without dots (any length, will be validated)
  if (/^\d+$/.test(q)) {
    return 'uid';
  }

  // PDB ID: 4 characters starting with digit
  if (/^[0-9][a-z0-9]{3}$/i.test(q)) {
    return 'pdb_id';
  }

  // UniProt accession pattern
  if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]$/i.test(q) ||
      /^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/i.test(q)) {
    return 'unp_acc';
  }

  return 'keyword';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q')?.trim();
  const page = parseInt(searchParams.get('page') || '1');
  const safeLimit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '20'), 100));
  const safeOffset = Math.max(0, (page - 1) * safeLimit);

  if (!q) {
    return NextResponse.json({
      success: true,
      data: { domains: [], clusters: [], total: 0, page, totalPages: 0 },
    });
  }

  const searchType = detectSearchType(q);

  try {
    let domains: DomainResult[] = [];
    let clusters: ClusterResult[] = [];
    let total = 0;

    switch (searchType) {
      case 'uid': {
        // Direct UID lookup
        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE uid = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [parseInt(q)]);
        total = domains.length;
        break;
      }

      case 'domain_id': {
        // Domain ID lookup
        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE id = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [q]);
        total = domains.length;
        break;
      }

      case 'cluster_id': {
        // Redirect to cluster - also search for domains in that cluster
        clusters = await query<ClusterResult>(`
          SELECT id, type, name, parent
          FROM cluster
          WHERE id = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [q]);

        // Get domains in this cluster hierarchy
        // Level by dots: 0=X, 1=H, 2=T, 3+=F
        const dotCount = (q.match(/\./g) || []).length;

        // For X/H groups (0-1 dots): search tid LIKE pattern (T-groups under this)
        // For T groups (2 dots): search fid LIKE pattern (F-groups under this)
        // For F groups (3+ dots): search fid exact match
        const isFamily = dotCount >= 3;
        const isTopology = dotCount === 2;
        const column = isFamily || isTopology ? 'fid' : 'tid';
        const pattern = isFamily ? q : `${q}.%`;

        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM domain
          WHERE ${column} ${isFamily ? '= $1' : 'LIKE $1'}
            AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [pattern]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE ${column} ${isFamily ? '= $1' : 'LIKE $1'}
            AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY is_rep DESC NULLS LAST, uid
          LIMIT $2 OFFSET $3
        `, [pattern, safeLimit, safeOffset]);
        break;
      }

      case 'pdb_id': {
        // PDB ID search via source_id (case-insensitive)
        const pdbLower = q.toLowerCase();

        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM domain
          WHERE source_id ILIKE $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [`${pdbLower}%`]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE source_id ILIKE $1 AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY source_id, uid
          LIMIT $2 OFFSET $3
        `, [`${pdbLower}%`, safeLimit, safeOffset]);
        break;
      }

      case 'unp_acc': {
        // UniProt accession search
        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM domain
          WHERE unp_acc = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [q.toUpperCase()]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE unp_acc = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY uid
          LIMIT $2 OFFSET $3
        `, [q.toUpperCase(), safeLimit, safeOffset]);
        break;
      }

      case 'keyword':
      default: {
        // Search clusters by name
        clusters = await query<ClusterResult>(`
          SELECT id, type, name, parent
          FROM cluster
          WHERE (name ILIKE $1 OR pfam_acc ILIKE $1)
            AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY type, id
          LIMIT 50
        `, [`%${q}%`]);

        // Search domains via unp_info join for protein names
        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count
          FROM domain d
          LEFT JOIN unp_info u ON d.unp_acc = u.unp_acc
          WHERE (u.full_name ILIKE $1 OR u.gene_name ILIKE $1 OR d.id ILIKE $1)
            AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
        `, [`%${q}%`]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.fid, d.tid, d.is_rep
          FROM domain d
          LEFT JOIN unp_info u ON d.unp_acc = u.unp_acc
          WHERE (u.full_name ILIKE $1 OR u.gene_name ILIKE $1 OR d.id ILIKE $1)
            AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
          ORDER BY d.is_rep DESC NULLS LAST, d.uid
          LIMIT $2 OFFSET $3
        `, [`%${q}%`, safeLimit, safeOffset]);
        break;
      }
    }

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
        })),
        clusters: clusters.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          parent: c.parent,
        })),
        searchType,
        query: q,
        total,
        page,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SEARCH_ERROR', message: 'Search failed' },
      },
      { status: 500 }
    );
  }
}
