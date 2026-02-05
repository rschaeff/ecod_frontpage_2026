import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainRow {
  uid: number;
  id: string;
  type: string;
  range: string;
  source_id: string | null;
  unp_acc: string | null;
  fid: string | null;
  tid: string | null;
  is_rep: boolean | null;
  rep_ecod_uid: number | null;
  chain_id: string | null;
}

interface ClusterRow {
  id: string;
  type: string;
  name: string;
}

interface UnpInfoRow {
  unp_acc: string;
  full_name: string | null;
  gene_name: string | null;
}

interface PdbInfoRow {
  pdb_id: string;
  chain_id: string;
  name: string | null;
}

interface RepDomainRow {
  uid: number;
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  // Validate UID - allow any positive number
  const uidNum = parseInt(uid);
  if (isNaN(uidNum) || uidNum <= 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_UID', message: 'Invalid domain UID' } },
      { status: 400 }
    );
  }

  try {
    // Fetch basic domain info
    const domains = await query<DomainRow>(`
      SELECT
        uid, id, type::text, range, source_id, unp_acc,
        fid, tid, is_rep, rep_ecod_uid, chain_id
      FROM domain
      WHERE uid = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
    `, [uidNum]);

    if (domains.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } },
        { status: 404 }
      );
    }

    const domain = domains[0];

    // Fetch full classification hierarchy by walking up from family
    // This gives us F -> T -> H -> X -> A
    let clusters: ClusterRow[] = [];

    if (domain.fid) {
      clusters = await query<ClusterRow>(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, type, name, parent
          FROM cluster
          WHERE id = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
          UNION ALL
          SELECT c.id, c.type, c.name, c.parent
          FROM cluster c
          JOIN hierarchy h ON c.id = h.parent
          WHERE c.is_obsolete IS NULL OR c.is_obsolete = false
        )
        SELECT id, type, name FROM hierarchy
      `, [domain.fid]);
    } else if (domain.tid) {
      clusters = await query<ClusterRow>(`
        WITH RECURSIVE hierarchy AS (
          SELECT id, type, name, parent
          FROM cluster
          WHERE id = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
          UNION ALL
          SELECT c.id, c.type, c.name, c.parent
          FROM cluster c
          JOIN hierarchy h ON c.id = h.parent
          WHERE c.is_obsolete IS NULL OR c.is_obsolete = false
        )
        SELECT id, type, name FROM hierarchy
      `, [domain.tid]);
    }

    // Build classification map by type
    const clusterByType: Record<string, ClusterRow> = {};
    for (const c of clusters) {
      clusterByType[c.type] = c;
    }

    // Fetch UniProt info if available
    let unpInfo: UnpInfoRow | null = null;
    if (domain.unp_acc) {
      try {
        const unpResult = await query<UnpInfoRow>(`
          SELECT unp_acc, full_name, gene_name
          FROM unp_info
          WHERE unp_acc = $1
        `, [domain.unp_acc]);
        unpInfo = unpResult[0] || null;
      } catch {
        // unp_info table might have different schema, skip
      }
    }

    // Fetch PDB info if this is an experimental structure
    let pdbInfo: PdbInfoRow | null = null;
    if (domain.type === 'experimental structure' && domain.source_id) {
      // source_id format is "pdb_chain" e.g., "1e0t_A"
      const [pdbId, chainId] = domain.source_id.split('_');
      if (pdbId && chainId) {
        try {
          const pdbResult = await query<PdbInfoRow>(`
            SELECT pdb_id, chain_id, name
            FROM pdb_chain_info
            WHERE pdb_id = $1 AND chain_id = $2
          `, [pdbId, chainId]);
          pdbInfo = pdbResult[0] || null;
        } catch {
          // pdb_chain_info table might not exist or have different schema
        }
      }
    }

    // Fetch representative domain info for AlphaFold domains
    let repDomain: RepDomainRow | null = null;
    if (domain.type === 'computed structural model' && domain.rep_ecod_uid) {
      try {
        const repResult = await query<RepDomainRow>(`
          SELECT uid, id FROM domain WHERE uid = $1
        `, [domain.rep_ecod_uid]);
        repDomain = repResult[0] || null;
      } catch {
        // Ignore errors
      }
    }

    // Build response
    const response = {
      uid: domain.uid,
      id: domain.id,
      type: domain.type,
      range: domain.range,
      sourceId: domain.source_id,
      unpAcc: domain.unp_acc,
      chainId: domain.chain_id,
      isRep: domain.is_rep,
      classification: {
        architecture: clusterByType['A']
          ? { id: clusterByType['A'].id, name: clusterByType['A'].name }
          : null,
        xGroup: clusterByType['X']
          ? { id: clusterByType['X'].id, name: clusterByType['X'].name }
          : null,
        hGroup: clusterByType['H']
          ? { id: clusterByType['H'].id, name: clusterByType['H'].name }
          : null,
        tGroup: clusterByType['T']
          ? { id: clusterByType['T'].id, name: clusterByType['T'].name }
          : null,
        family: clusterByType['F']
          ? { id: clusterByType['F'].id, name: clusterByType['F'].name }
          : null,
      },
      protein: unpInfo ? {
        unpAcc: unpInfo.unp_acc,
        name: unpInfo.full_name,
        geneName: unpInfo.gene_name,
      } : null,
      // PDB-specific info (only for experimental structures)
      pdb: pdbInfo ? {
        pdbId: pdbInfo.pdb_id,
        chainId: pdbInfo.chain_id,
        moleculeName: pdbInfo.name,
      } : null,
      // AlphaFold-specific info (only for computed models)
      representative: repDomain ? {
        uid: repDomain.uid,
        id: repDomain.id,
      } : null,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Domain fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch domain' } },
      { status: 500 }
    );
  }
}
