import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// SKETCH: /api/compound/[compId]
// Returns chemical metadata + scope stats + top-binding F-groups + paginated
// PDB list for a ligand/cofactor/drug given its 3–5 char PDB CCD comp_id.
// Backed by ligand_compound × pdb_ligand_instance × domain_ligand_contact × domain × cluster.

interface CompoundRow {
  comp_id: string;
  name: string | null;
  formula: string | null;
  type: string | null;
  pdbx_type: string | null;
  formula_weight: number | null;
  is_metal: boolean;
  is_buffer: boolean;
  release_status: string | null;
}

interface ScopeRow { n_pdbs: string; n_domains: string; n_contacts: string; }
interface FGroupRow { fid: string; f_name: string | null; n_domains: string; }
interface PdbRow    { pdb_id: string; n_instances: string; chains: string[]; }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ compId: string }> }
) {
  const { compId } = await params;
  const comp = compId?.toUpperCase();

  if (!comp || !/^[A-Z0-9]{1,5}$/.test(comp)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_COMP_ID', message: 'Invalid compound id' } },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '20'), 100));
  const offset = (page - 1) * limit;

  try {
    // All four queries are independent — fan out in parallel.
    const [compound, scope, topFGroups, pdbEntries, pdbTotal] = await Promise.all([
      query<CompoundRow>(
        `SELECT comp_id, name, formula, type, pdbx_type, formula_weight::float,
                is_metal, is_buffer, release_status
         FROM ligand_compound WHERE comp_id = $1`,
        [comp]
      ),
      query<ScopeRow>(
        `SELECT (SELECT COUNT(DISTINCT pdb_id)
                 FROM pdb_ligand_instance WHERE comp_id = $1)::text AS n_pdbs,
                COUNT(DISTINCT dlc.uid)::text  AS n_domains,
                COUNT(*)::text                 AS n_contacts
         FROM domain_ligand_contact dlc
         JOIN pdb_ligand_instance li ON li.id = dlc.instance_id
         WHERE li.comp_id = $1`,
        [comp]
      ),
      query<FGroupRow>(
        `SELECT d.fid,
                c.name AS f_name,
                COUNT(DISTINCT d.uid) AS n_domains
         FROM domain_ligand_contact dlc
         JOIN pdb_ligand_instance li ON dlc.instance_id = li.id
         JOIN domain d ON d.uid = dlc.uid
         LEFT JOIN cluster c ON c.id = d.fid
         WHERE li.comp_id = $1
         GROUP BY d.fid, c.name
         ORDER BY n_domains DESC
         LIMIT 20`,
        [comp]
      ),
      query<PdbRow>(
        `SELECT pdb_id,
                COUNT(*)::text AS n_instances,
                array_agg(DISTINCT chain_id ORDER BY chain_id) AS chains
         FROM pdb_ligand_instance
         WHERE comp_id = $1
         GROUP BY pdb_id
         ORDER BY pdb_id
         LIMIT $2 OFFSET $3`,
        [comp, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT pdb_id) AS count
         FROM pdb_ligand_instance WHERE comp_id = $1`,
        [comp]
      ),
    ]);

    if (compound.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Unknown compound id' } },
        { status: 404 }
      );
    }

    const c = compound[0];
    const s = scope[0];
    const total = parseInt(pdbTotal[0]?.count || '0');

    return NextResponse.json({
      success: true,
      data: {
        compound: {
          compId: c.comp_id,
          name: c.name,
          formula: c.formula,
          type: c.type,
          pdbxType: c.pdbx_type,
          formulaWeight: c.formula_weight,
          isMetal: c.is_metal,
          isBuffer: c.is_buffer,
          releaseStatus: c.release_status,
        },
        scope: {
          nPdbs:     parseInt(s.n_pdbs || '0'),
          nDomains:  parseInt(s.n_domains || '0'),
          nContacts: parseInt(s.n_contacts || '0'),
        },
        topFGroups: topFGroups.map(r => ({
          fid: r.fid,
          name: r.f_name,
          nDomains: parseInt(r.n_domains),
        })),
        pdbEntries: {
          items: pdbEntries.map(r => ({
            pdbId: r.pdb_id,
            nInstances: parseInt(r.n_instances),
            chains: r.chains,
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Compound API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Compound lookup failed' } },
      { status: 500 }
    );
  }
}
