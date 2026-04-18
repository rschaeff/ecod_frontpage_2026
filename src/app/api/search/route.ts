import { NextRequest, NextResponse } from 'next/server';
import { query, escapeLike } from '@/lib/db';
import { lookupPfam, lookupClan, getPfamsByClan } from '@/lib/pfam-clans';

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

interface CompoundResult {
  comp_id: string;
  name: string | null;
  type: string | null;
  is_metal: boolean;
  is_buffer: boolean;
}

// Detect search type from query
function detectSearchType(q: string): 'uid' | 'domain_id' | 'unp_acc' | 'epp_acc' | 'pdb_id' | 'cluster_id' | 'pfam_acc' | 'clan_acc' | 'keyword' {
  // EPP accession: EPP followed by 8 digits
  if (/^EPP\d{8}$/i.test(q)) {
    return 'epp_acc';
  }

  // Pfam accession: PF followed by 5 digits
  if (/^PF\d{5}$/i.test(q)) {
    return 'pfam_acc';
  }

  // Pfam clan accession: CL followed by 4 digits
  if (/^CL\d{4}$/i.test(q)) {
    return 'clan_acc';
  }

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

  let searchType: ReturnType<typeof detectSearchType> | 'compound' = detectSearchType(q);

  try {
    let domains: DomainResult[] = [];
    let clusters: ClusterResult[] = [];
    let compounds: CompoundResult[] = [];
    let total = 0;

    // Compound probe: if the raw query could be a PDB CCD comp_id (1–5 char
    // alphanumeric), look it up. On hit, include the compound in the response.
    // When the detected type was 'keyword' (no better match), elevate to
    // 'compound' so the UI can render the ligand card prominently.
    const compoundCandidate = /^[A-Z0-9]{1,5}$/.test(q.toUpperCase());
    if (compoundCandidate) {
      compounds = await query<CompoundResult>(
        `SELECT comp_id, name, type, is_metal, is_buffer
         FROM ligand_compound WHERE comp_id = $1`,
        [q.toUpperCase()]
      );
      if (compounds.length > 0 && searchType === 'keyword') {
        searchType = 'compound';
      }
    }

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

      case 'epp_acc': {
        // EPP accession search — look up domains with this unp_acc
        const eppAcc = q.toUpperCase();

        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM domain
          WHERE unp_acc = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
        `, [eppAcc]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
          FROM domain
          WHERE unp_acc = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY uid
          LIMIT $2 OFFSET $3
        `, [eppAcc, safeLimit, safeOffset]);
        break;
      }

      case 'pfam_acc': {
        // Search for F-groups and domains mapped to a Pfam accession
        const pfamUpper = q.toUpperCase();
        const pfamInfo = lookupPfam(pfamUpper);

        // Find F-groups with this Pfam (pfam_acc is comma-delimited in cluster table)
        clusters = await query<ClusterResult>(`
          SELECT id, type, name, parent
          FROM cluster
          WHERE type = 'F'
            AND (',' || pfam_acc || ',' LIKE $1)
            AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY id
          LIMIT 50
        `, [`%,${pfamUpper},%`]);

        // Also try exact match for single-pfam families
        if (clusters.length === 0) {
          clusters = await query<ClusterResult>(`
            SELECT id, type, name, parent
            FROM cluster
            WHERE type = 'F'
              AND pfam_acc = $1
              AND (is_obsolete IS NULL OR is_obsolete = false)
            ORDER BY id
            LIMIT 50
          `, [pfamUpper]);
        }

        // Get all F-group IDs to find domains
        const pfamFids = clusters.map(c => c.id);

        if (pfamFids.length > 0) {
          const placeholders = pfamFids.map((_, i) => `$${i + 1}`).join(',');

          const countResult = await query<{ count: string }>(`
            SELECT COUNT(*) as count FROM domain
            WHERE fid IN (${placeholders})
              AND (is_obsolete IS NULL OR is_obsolete = false)
          `, pfamFids);
          total = parseInt(countResult[0]?.count || '0');

          domains = await query<DomainResult>(`
            SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
            FROM domain
            WHERE fid IN (${placeholders})
              AND (is_obsolete IS NULL OR is_obsolete = false)
            ORDER BY is_rep DESC NULLS LAST, uid
            LIMIT $${pfamFids.length + 1} OFFSET $${pfamFids.length + 2}
          `, [...pfamFids, safeLimit, safeOffset]);
        }

        // Enrich cluster results with Pfam info in the response
        if (pfamInfo) {
          // Add a synthetic cluster entry for the Pfam itself so it appears in results
          const pfamLabel = `${pfamInfo.id} - ${pfamInfo.description}`;
          const clanLabel = pfamInfo.clan ? ` (Clan: ${pfamInfo.clan.acc} ${pfamInfo.clan.name})` : '';
          clusters = [{
            id: pfamUpper,
            type: 'Pfam',
            name: pfamLabel + clanLabel,
            parent: null,
          }, ...clusters];
        }
        break;
      }

      case 'clan_acc': {
        // Search for all Pfam families in a clan, then find their ECOD F-groups
        const clanUpper = q.toUpperCase();
        const clanInfo = lookupClan(clanUpper);
        const clanPfams = getPfamsByClan(clanUpper);

        if (clanPfams.length === 0) {
          // Unknown clan
          break;
        }

        // Find F-groups mapped to any Pfam in this clan
        const pfamAccs = clanPfams.map(p => p.acc);
        // Build OR conditions for comma-delimited pfam_acc field
        const orConditions = pfamAccs.map((_, i) =>
          `(',' || pfam_acc || ',' LIKE $${i + 1})`
        ).join(' OR ');
        const likeParams = pfamAccs.map(acc => `%,${acc},%`);

        // Also match exact single-value pfam_acc
        const exactConditions = pfamAccs.map((_, i) =>
          `pfam_acc = $${pfamAccs.length + i + 1}`
        ).join(' OR ');

        clusters = await query<ClusterResult>(`
          SELECT id, type, name, parent
          FROM cluster
          WHERE type = 'F'
            AND (${orConditions} OR ${exactConditions})
            AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY id
          LIMIT 200
        `, [...likeParams, ...pfamAccs]);

        const clanFids = clusters.map(c => c.id);

        if (clanFids.length > 0) {
          const placeholders = clanFids.map((_, i) => `$${i + 1}`).join(',');

          const countResult = await query<{ count: string }>(`
            SELECT COUNT(*) as count FROM domain
            WHERE fid IN (${placeholders})
              AND (is_obsolete IS NULL OR is_obsolete = false)
          `, clanFids);
          total = parseInt(countResult[0]?.count || '0');

          domains = await query<DomainResult>(`
            SELECT uid, id, type::text, range, source_id, unp_acc, fid, tid, is_rep
            FROM domain
            WHERE fid IN (${placeholders})
              AND (is_obsolete IS NULL OR is_obsolete = false)
            ORDER BY is_rep DESC NULLS LAST, uid
            LIMIT $${clanFids.length + 1} OFFSET $${clanFids.length + 2}
          `, [...clanFids, safeLimit, safeOffset]);
        }

        // Add clan header and Pfam members to cluster results
        const clanHeader: ClusterResult = {
          id: clanUpper,
          type: 'Clan',
          name: clanInfo ? `${clanInfo.name} (${clanPfams.length} Pfam families, ${clusters.length} ECOD F-groups)` : `${clanUpper} (${clanPfams.length} Pfam families)`,
          parent: null,
        };
        clusters = [clanHeader, ...clusters];
        break;
      }

      case 'keyword':
      default: {
        const escapedQ = escapeLike(q);

        // Search clusters by name
        clusters = await query<ClusterResult>(`
          SELECT id, type, name, parent
          FROM cluster
          WHERE (name ILIKE $1 OR pfam_acc ILIKE $1)
            AND (is_obsolete IS NULL OR is_obsolete = false)
          ORDER BY type, id
          LIMIT 50
        `, [`%${escapedQ}%`]);

        // Search domains via unp_info join for protein names
        const countResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count
          FROM domain d
          LEFT JOIN unp_info u ON d.unp_acc = u.unp_acc
          WHERE (u.full_name ILIKE $1 OR u.gene_name ILIKE $1 OR d.id ILIKE $1)
            AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
        `, [`%${escapedQ}%`]);
        total = parseInt(countResult[0]?.count || '0');

        domains = await query<DomainResult>(`
          SELECT d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.fid, d.tid, d.is_rep
          FROM domain d
          LEFT JOIN unp_info u ON d.unp_acc = u.unp_acc
          WHERE (u.full_name ILIKE $1 OR u.gene_name ILIKE $1 OR d.id ILIKE $1)
            AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
          ORDER BY d.is_rep DESC NULLS LAST, d.uid
          LIMIT $2 OFFSET $3
        `, [`%${escapedQ}%`, safeLimit, safeOffset]);
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
        compounds: compounds.map(cp => ({
          compId: cp.comp_id,
          name: cp.name,
          type: cp.type,
          isMetal: cp.is_metal,
          isBuffer: cp.is_buffer,
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
