import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { errorInit } from '@/lib/db-errors';

// /api/group/[id]
// Ligand and drug annotations aggregated over the member domains of one
// classification group (X, H, T or F). The reverse of /api/compound/[compId],
// which lists the groups that bind a compound.
//
// Membership is by F-group identifier: an F-group matches its own id, and an
// X-, H- or T-group matches every fid beneath it (including the ".0"
// topology-only ids). Architecture groups (a.1 …) are not supported — they are
// defined by their X-groups, not by an id prefix.

interface GroupRow {
  id: string;
  type: 'X' | 'H' | 'T' | 'F';
  name: string | null;
  pfam_acc: string | null;
}
interface LineageRow { id: string; type: string; name: string | null; depth: number; }
interface ScopeRow {
  n_domains: string;
  n_with_contacts: string;
  n_with_drugdomain: string;
  n_with_drug: string;
}
interface CompoundRow {
  comp_id: string;
  name: string | null;
  is_metal: boolean;
  n_domains: string;
}
interface DrugRow {
  drugbank_acc: string;
  ligand_pdb: string | null;
  ligand_name: string | null;
  n_domains: string;
}

// Only digits and dots: "." is not a LIKE wildcard, so the id can be used as a
// prefix pattern without escaping.
const GROUP_ID = /^\d+(\.\d+){0,3}$/;

// Non-obsolete member domains of the group; $1 = group id.
const MEMBERS = `
  SELECT uid FROM domain
  WHERE (fid = $1 OR fid LIKE $1 || '.%')
    AND NOT COALESCE(is_obsolete, false)`;

// DrugDomain cross-references for experimental and predicted domains alike.
const DRUGDOMAIN = `
  SELECT uid, drugbank_acc, ligand_pdb FROM ecod_drugbank_pdb
  UNION ALL
  SELECT uid, drugbank_acc, ligand_pdb FROM ecod_drugbank_afdb`;

const TOP_N = 20;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !GROUP_ID.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_GROUP_ID', message: 'Invalid group id' } },
      { status: 400 }
    );
  }

  try {
    const group = await query<GroupRow>(
      `SELECT id, type, name, pfam_acc FROM cluster
       WHERE id = $1 AND type IN ('X', 'H', 'T', 'F')`,
      [id]
    );
    if (group.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Unknown group id' } },
        { status: 404 }
      );
    }

    // Independent aggregates — fan out in parallel.
    const [lineage, scope, topCompounds, topDrugs] = await Promise.all([
      query<LineageRow>(
        `WITH RECURSIVE up AS (
           SELECT id, type, name, parent, 0 AS depth FROM cluster WHERE id = $1
           UNION ALL
           SELECT c.id, c.type, c.name, c.parent, up.depth + 1
           FROM cluster c JOIN up ON c.id = up.parent
         )
         SELECT id, type, name, depth FROM up WHERE depth > 0 ORDER BY depth DESC`,
        [id]
      ),
      query<ScopeRow>(
        `WITH m AS (${MEMBERS}),
              dd AS (${DRUGDOMAIN})
         SELECT (SELECT COUNT(*) FROM m)::text AS n_domains,
                (SELECT COUNT(DISTINCT dlc.uid)
                 FROM domain_ligand_contact dlc JOIN m ON m.uid = dlc.uid)::text AS n_with_contacts,
                (SELECT COUNT(DISTINCT dd.uid)
                 FROM dd JOIN m ON m.uid = dd.uid)::text AS n_with_drugdomain,
                (SELECT COUNT(DISTINCT dd.uid)
                 FROM dd JOIN m ON m.uid = dd.uid
                 WHERE dd.drugbank_acc IS NOT NULL)::text AS n_with_drug`,
        [id]
      ),
      // Bound compounds by the number of member domains in contact. Buffers
      // and crystallization additives are left out; metals are kept but flagged.
      query<CompoundRow>(
        `WITH m AS (${MEMBERS})
         SELECT li.comp_id, lc.name, COALESCE(lc.is_metal, false) AS is_metal,
                COUNT(DISTINCT dlc.uid)::text AS n_domains
         FROM domain_ligand_contact dlc
         JOIN m ON m.uid = dlc.uid
         JOIN pdb_ligand_instance li ON li.id = dlc.instance_id
         LEFT JOIN ligand_compound lc ON lc.comp_id = li.comp_id
         WHERE NOT COALESCE(lc.is_buffer, false)
         GROUP BY li.comp_id, lc.name, lc.is_metal
         ORDER BY COUNT(DISTINCT dlc.uid) DESC, li.comp_id
         LIMIT ${TOP_N}`,
        [id]
      ),
      // DrugBank drugs by the number of member domains annotated with them.
      // DrugBank also has entries for common crystallization additives
      // (sulfate, glycerol, DMSO …), which would otherwise top every list, so
      // references whose PDB ligand is flagged as a buffer are left out, as
      // in the compound list above. A drug can appear under more than one PDB
      // ligand code; keep the commonest code for display and linking.
      query<DrugRow>(
        `WITH m AS (${MEMBERS}),
              dd AS (
                SELECT x.uid, x.drugbank_acc, x.ligand_pdb
                FROM (${DRUGDOMAIN}) x
                LEFT JOIN ligand_compound lc ON lc.comp_id = x.ligand_pdb
                WHERE x.drugbank_acc IS NOT NULL
                  AND NOT COALESCE(lc.is_buffer, false)
              ),
              per_code AS (
                SELECT dd.drugbank_acc, dd.ligand_pdb, COUNT(DISTINCT dd.uid) AS n
                FROM dd JOIN m ON m.uid = dd.uid
                GROUP BY dd.drugbank_acc, dd.ligand_pdb
              ),
              per_drug AS (
                SELECT drugbank_acc,
                       (ARRAY_AGG(ligand_pdb ORDER BY n DESC, ligand_pdb))[1] AS ligand_pdb
                FROM per_code GROUP BY drugbank_acc
              ),
              counts AS (
                SELECT dd.drugbank_acc, COUNT(DISTINCT dd.uid) AS n_domains
                FROM dd JOIN m ON m.uid = dd.uid
                GROUP BY dd.drugbank_acc
              )
         SELECT c.drugbank_acc, p.ligand_pdb, lc.name AS ligand_name,
                c.n_domains::text AS n_domains
         FROM counts c
         JOIN per_drug p ON p.drugbank_acc = c.drugbank_acc
         LEFT JOIN ligand_compound lc ON lc.comp_id = p.ligand_pdb
         ORDER BY c.n_domains DESC, c.drugbank_acc
         LIMIT ${TOP_N}`,
        [id]
      ),
    ]);

    const g = group[0];
    const s = scope[0];

    return NextResponse.json(
      {
        success: true,
        data: {
          group: { id: g.id, type: g.type, name: g.name, pfamAcc: g.pfam_acc },
          lineage: lineage.map(r => ({ id: r.id, type: r.type, name: r.name })),
          scope: {
            nDomains:         parseInt(s.n_domains || '0'),
            nWithContacts:    parseInt(s.n_with_contacts || '0'),
            nWithDrugDomain:  parseInt(s.n_with_drugdomain || '0'),
            nWithDrug:        parseInt(s.n_with_drug || '0'),
          },
          topCompounds: topCompounds.map(r => ({
            compId: r.comp_id,
            name: r.name,
            isMetal: r.is_metal,
            nDomains: parseInt(r.n_domains),
          })),
          topDrugs: topDrugs.map(r => ({
            drugbankAcc: r.drugbank_acc,
            ligandPdb: r.ligand_pdb,
            name: r.ligand_name,
            nDomains: parseInt(r.n_domains),
          })),
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (error) {
    console.error('Group API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Group lookup failed' } },
      errorInit(error)
    );
  }
}
