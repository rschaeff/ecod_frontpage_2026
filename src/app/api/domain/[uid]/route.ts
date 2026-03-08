import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { HTTP_CACHE_MAX_AGE } from '@/lib/cache';
import { resolvePfamAccessions } from '@/lib/pfam-clans';
import { getDomainByUid } from '@/lib/domain-queries';

interface DrugDomainRow {
  drugdomain_acc: string | null;
  drugdomain_link: string | null;
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

interface ClusterPfamRow {
  pfam_acc: string | null;
  clan_acc: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  // Validate UID - allow any non-negative integer (UID 0 exists)
  const uidNum = parseInt(uid);
  if (isNaN(uidNum) || uidNum < 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_UID', message: 'Invalid domain UID' } },
      { status: 400 }
    );
  }

  try {
    // Use shared query for domain + classification hierarchy
    const domain = await getDomainByUid(uidNum);

    if (!domain) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } },
        { status: 404 }
      );
    }

    // Fetch Pfam/clan info from the family cluster (needs pfam_acc column not in shared query)
    let pfamInfos: ReturnType<typeof resolvePfamAccessions> = [];
    if (domain.fid) {
      try {
        const pfamRows = await query<ClusterPfamRow>(
          `SELECT pfam_acc, clan_acc FROM cluster WHERE id = $1`,
          [domain.fid]
        );
        if (pfamRows[0]) {
          pfamInfos = resolvePfamAccessions(pfamRows[0].pfam_acc);
        }
      } catch {
        // pfam lookup optional
      }
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

    // Fetch DrugDomain info
    let drugDomainData: { acc: string; link: string }[] = [];
    try {
      const tableName = domain.type === 'experimental structure'
        ? 'ecod_drugbank_pdb_agg'
        : 'ecod_drugbank_afdb_agg';
      const drugResult = await query<DrugDomainRow>(`
        SELECT drugdomain_acc, drugdomain_link FROM ${tableName} WHERE uid = $1
      `, [uidNum]);

      if (drugResult[0]?.drugdomain_acc && drugResult[0]?.drugdomain_link) {
        const accs = drugResult[0].drugdomain_acc.split(',');
        const links = drugResult[0].drugdomain_link.split(',');
        drugDomainData = accs.map((acc, i) => ({
          acc: acc.trim(),
          link: links[i]?.trim() || '',
        })).filter(d => d.acc && d.link);
      }
    } catch {
      // DrugDomain data not available
    }

    // Build response using shared classification
    const cls = domain.classification;

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
        architecture: cls.architecture,
        xGroup: cls.xGroup,
        hGroup: cls.hGroup,
        tGroup: cls.tGroup,
        family: cls.family,
      },
      pfam: pfamInfos.length > 0 ? pfamInfos.map(p => ({
        acc: p.acc,
        id: p.id,
        description: p.description,
        clan: p.clan ? { acc: p.clan.acc, name: p.clan.name } : null,
      })) : null,
      protein: unpInfo ? {
        unpAcc: unpInfo.unp_acc,
        name: unpInfo.full_name,
        geneName: unpInfo.gene_name,
      } : null,
      pdb: pdbInfo ? {
        pdbId: pdbInfo.pdb_id,
        chainId: pdbInfo.chain_id,
        moleculeName: pdbInfo.name,
      } : null,
      representative: repDomain ? {
        uid: repDomain.uid,
        id: repDomain.id,
      } : null,
      drugDomain: drugDomainData.length > 0 ? drugDomainData : null,
      ligands: domain.ligand ? {
        codes: domain.ligand,
        residues: domain.ligand_pdbnum,
      } : null,
    };

    return NextResponse.json(
      { success: true, data: response },
      {
        headers: {
          'Cache-Control': `public, max-age=${HTTP_CACHE_MAX_AGE.DOMAIN}, stale-while-revalidate=3600`,
        },
      }
    );
  } catch (error) {
    console.error('Domain fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch domain' } },
      { status: 500 }
    );
  }
}
