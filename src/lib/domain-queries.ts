/**
 * Shared domain query functions used by both internal UI routes and public v1 API.
 */

import { query } from '@/lib/db';
import path from 'path';

const DOMAIN_DATA_BASE = process.env.DATA_DIR || '/data/ECOD/html/af2_pdb_d';

/**
 * Get the filesystem path for a domain data file (pdb, fa, png, etc.).
 * Path structure: {base}/{mid}/{padded_uid}/{padded_uid}.{ext}
 */
export function getDomainDataPath(uid: number, ext: string): string {
  const paddedUid = uid.toString().padStart(9, '0');
  const mid = paddedUid.substring(2, 7);
  return path.join(DOMAIN_DATA_BASE, mid, paddedUid, `${paddedUid}.${ext}`);
}

/**
 * Parse a domain range string like "B:2-200" or "A:1-50,A:100-150"
 * into structured segments.
 */
export interface ParsedRange {
  chain: string;
  start: number;
  end: number;
}

export function parseRange(rangeStr: string): ParsedRange[] {
  if (!rangeStr) return [];
  const segments: ParsedRange[] = [];
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const match = part.trim().match(/([A-Za-z0-9]+):(-?\d+)-(-?\d+)/);
    if (match) {
      segments.push({
        chain: match[1],
        start: parseInt(match[2]),
        end: parseInt(match[3]),
      });
    }
  }
  return segments;
}

/**
 * Get overall start/end bounds from parsed ranges.
 */
export function getRangeBounds(ranges: ParsedRange[]): { start: number; end: number } | null {
  if (ranges.length === 0) return null;
  return {
    start: Math.min(...ranges.map(r => r.start)),
    end: Math.max(...ranges.map(r => r.end)),
  };
}

// Core domain record from database
export interface DomainRecord {
  uid: number;
  id: string;
  type: string;
  range: string;
  source_id: string | null;
  unp_acc: string | null;
  chain_id: string | null;
  fid: string | null;
  tid: string;
  is_rep: boolean | null;
  is_manual: boolean;
  rep_ecod_uid: number | null;
  ligand: string | null;
  ligand_pdbnum: string | null;
}

// Classification hierarchy node
export interface ClassificationNode {
  id: string;
  name: string;
}

// Full classification from Architecture down to Family
export interface ClassificationHierarchy {
  architecture: ClassificationNode | null;
  xGroup: ClassificationNode | null;
  hGroup: ClassificationNode | null;
  tGroup: ClassificationNode | null;
  family: ClassificationNode | null;
}

// Domain with classification attached
export interface DomainWithClassification extends DomainRecord {
  classification: ClassificationHierarchy;
}

// Lightweight domain row for list queries (no ligand, no rep_ecod_uid)
interface DomainListRow {
  uid: number;
  id: string;
  type: string;
  range: string;
  source_id: string | null;
  unp_acc: string | null;
  chain_id: string | null;
  fid: string | null;
  fname: string | null;
  tid: string;
  tname: string | null;
  hid: string | null;
  hname: string | null;
  xid: string | null;
  xname: string | null;
  aid: string | null;
  aname: string | null;
  is_rep: boolean | null;
  is_manual: boolean;
}

interface ClusterRow {
  id: string;
  type: string;
  name: string;
}

/**
 * Get the classification hierarchy for a domain by walking up from its
 * family or T-group assignment.
 */
export async function getClassificationHierarchy(
  fid: string | null,
  tid: string | null
): Promise<ClassificationHierarchy> {
  const startId = fid || tid;
  if (!startId) {
    return { architecture: null, xGroup: null, hGroup: null, tGroup: null, family: null };
  }

  const clusters = await query<ClusterRow>(`
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
  `, [startId]);

  const byType: Record<string, ClusterRow> = {};
  for (const c of clusters) {
    byType[c.type] = c;
  }

  return {
    architecture: byType['A'] ? { id: byType['A'].id, name: byType['A'].name } : null,
    xGroup: byType['X'] ? { id: byType['X'].id, name: byType['X'].name } : null,
    hGroup: byType['H'] ? { id: byType['H'].id, name: byType['H'].name } : null,
    tGroup: byType['T'] ? { id: byType['T'].id, name: byType['T'].name } : null,
    family: byType['F'] ? { id: byType['F'].id, name: byType['F'].name } : null,
  };
}

/**
 * Get a single domain by UID with full classification.
 */
export async function getDomainByUid(uid: number): Promise<DomainWithClassification | null> {
  const rows = await query<DomainRecord>(`
    SELECT
      uid, id, type::text, range, source_id, unp_acc, chain_id,
      fid, tid, is_rep, is_manual, rep_ecod_uid,
      ligand, ligand_pdbnum
    FROM domain
    WHERE uid = $1 AND (is_obsolete IS NULL OR is_obsolete = false)
  `, [uid]);

  if (rows.length === 0) return null;

  const domain = rows[0];
  const classification = await getClassificationHierarchy(domain.fid, domain.tid);

  return { ...domain, classification };
}

/**
 * Get all domains for a UniProt accession with inline classification.
 * Uses JOINs for efficiency (one query instead of N+1).
 */
export async function getDomainsByUniprot(unpAcc: string): Promise<DomainWithClassification[]> {
  const rows = await query<DomainListRow>(`
    SELECT
      d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.chain_id,
      d.fid, fc.name as fname,
      d.tid, tc.name as tname,
      cr.hid, hc.name as hname,
      cr.xid, xc.name as xname,
      xc.parent as aid, ac.name as aname,
      d.is_rep, d.is_manual
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    LEFT JOIN cluster tc ON d.tid = tc.id
    LEFT JOIN cluster_relation cr ON d.tid = cr.tid
    LEFT JOIN cluster hc ON cr.hid = hc.id
    LEFT JOIN cluster xc ON cr.xid = xc.id
    LEFT JOIN cluster ac ON xc.parent = ac.id
    WHERE d.unp_acc = $1
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.start_index NULLS LAST, d.uid
  `, [unpAcc]);

  return rows.map(rowToClassifiedDomain);
}

/**
 * Get all domains for a PDB entry (all chains) with inline classification.
 */
export async function getDomainsByPdb(pdbId: string): Promise<DomainWithClassification[]> {
  const rows = await query<DomainListRow>(`
    SELECT
      d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.chain_id,
      d.fid, fc.name as fname,
      d.tid, tc.name as tname,
      cr.hid, hc.name as hname,
      cr.xid, xc.name as xname,
      xc.parent as aid, ac.name as aname,
      d.is_rep, d.is_manual
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    LEFT JOIN cluster tc ON d.tid = tc.id
    LEFT JOIN cluster_relation cr ON d.tid = cr.tid
    LEFT JOIN cluster hc ON cr.hid = hc.id
    LEFT JOIN cluster xc ON cr.xid = xc.id
    LEFT JOIN cluster ac ON xc.parent = ac.id
    WHERE d.source_id ILIKE $1
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.source_id, d.start_index NULLS LAST, d.uid
  `, [`${pdbId.toLowerCase()}_%`]);

  return rows.map(rowToClassifiedDomain);
}

/**
 * Convert a JOIN-based row into a DomainWithClassification.
 */
function rowToClassifiedDomain(row: DomainListRow): DomainWithClassification {
  return {
    uid: row.uid,
    id: row.id,
    type: row.type,
    range: row.range,
    source_id: row.source_id,
    unp_acc: row.unp_acc,
    chain_id: row.chain_id,
    fid: row.fid,
    tid: row.tid,
    is_rep: row.is_rep,
    is_manual: row.is_manual,
    rep_ecod_uid: null,
    ligand: null,
    ligand_pdbnum: null,
    classification: {
      architecture: row.aid ? { id: row.aid, name: row.aname || '' } : null,
      xGroup: row.xid ? { id: row.xid, name: row.xname || '' } : null,
      hGroup: row.hid ? { id: row.hid, name: row.hname || '' } : null,
      tGroup: row.tid ? { id: row.tid, name: row.tname || '' } : null,
      family: row.fid ? { id: row.fid, name: row.fname || '' } : null,
    },
  };
}

// ============================================================
// Pfam / Clan / Unclassified queries (v1 API)
// ============================================================

/** F-group cluster row with Pfam mapping. */
interface FGroupRow {
  id: string;
  name: string;
  pfam_acc: string | null;
}

/**
 * Get all domains in F-groups mapped to a Pfam accession.
 * pfam_acc in the cluster table is comma-delimited.
 */
export async function getDomainsByPfam(pfamAcc: string): Promise<DomainWithClassification[]> {
  // Find F-groups mapped to this Pfam
  const fgroups = await query<FGroupRow>(`
    SELECT id, name, pfam_acc FROM cluster
    WHERE type = 'F'
      AND (',' || pfam_acc || ',' LIKE $1 OR pfam_acc = $2)
      AND (is_obsolete IS NULL OR is_obsolete = false)
    ORDER BY id
  `, [`%,${pfamAcc},%`, pfamAcc]);

  if (fgroups.length === 0) return [];

  const fids = fgroups.map(f => f.id);
  const placeholders = fids.map((_, i) => `$${i + 1}`).join(',');

  const rows = await query<DomainListRow>(`
    SELECT
      d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.chain_id,
      d.fid, fc.name as fname,
      d.tid, tc.name as tname,
      cr.hid, hc.name as hname,
      cr.xid, xc.name as xname,
      xc.parent as aid, ac.name as aname,
      d.is_rep, d.is_manual
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    LEFT JOIN cluster tc ON d.tid = tc.id
    LEFT JOIN cluster_relation cr ON d.tid = cr.tid
    LEFT JOIN cluster hc ON cr.hid = hc.id
    LEFT JOIN cluster xc ON cr.xid = xc.id
    LEFT JOIN cluster ac ON xc.parent = ac.id
    WHERE d.fid IN (${placeholders})
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.fid, d.is_rep DESC NULLS LAST, d.uid
  `, fids);

  return rows.map(rowToClassifiedDomain);
}

/**
 * Get all domains in F-groups mapped to any Pfam in a clan.
 * Requires a list of Pfam accessions belonging to the clan.
 */
export async function getDomainsByClan(pfamAccs: string[]): Promise<DomainWithClassification[]> {
  if (pfamAccs.length === 0) return [];

  // Build OR conditions for comma-delimited pfam_acc matching
  const likeConditions = pfamAccs.map((_, i) =>
    `(',' || pfam_acc || ',' LIKE $${i + 1})`
  ).join(' OR ');
  const exactConditions = pfamAccs.map((_, i) =>
    `pfam_acc = $${pfamAccs.length + i + 1}`
  ).join(' OR ');
  const likeParams = pfamAccs.map(acc => `%,${acc},%`);

  const fgroups = await query<FGroupRow>(`
    SELECT id, name, pfam_acc FROM cluster
    WHERE type = 'F'
      AND (${likeConditions} OR ${exactConditions})
      AND (is_obsolete IS NULL OR is_obsolete = false)
    ORDER BY id
  `, [...likeParams, ...pfamAccs]);

  if (fgroups.length === 0) return [];

  const fids = fgroups.map(f => f.id);
  const placeholders = fids.map((_, i) => `$${i + 1}`).join(',');

  const rows = await query<DomainListRow>(`
    SELECT
      d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.chain_id,
      d.fid, fc.name as fname,
      d.tid, tc.name as tname,
      cr.hid, hc.name as hname,
      cr.xid, xc.name as xname,
      xc.parent as aid, ac.name as aname,
      d.is_rep, d.is_manual
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    LEFT JOIN cluster tc ON d.tid = tc.id
    LEFT JOIN cluster_relation cr ON d.tid = cr.tid
    LEFT JOIN cluster hc ON cr.hid = hc.id
    LEFT JOIN cluster xc ON cr.xid = xc.id
    LEFT JOIN cluster ac ON xc.parent = ac.id
    WHERE d.fid IN (${placeholders})
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.fid, d.is_rep DESC NULLS LAST, d.uid
  `, fids);

  return rows.map(rowToClassifiedDomain);
}

/**
 * Get unclassified domains within an ECOD group.
 * "Unclassified" = domains in .0 families (placeholder) OR in families with no Pfam mapping.
 *
 * Note: .0 families may not have rows in the `cluster` table — they exist only as
 * fid values in the `domain` table. So we query domain.fid directly rather than
 * joining through cluster first.
 *
 * groupId can be X (1 number), H (2), T (3), or F (4) group.
 */
export async function getUnclassifiedDomains(
  groupId: string,
  opts: { noPfamOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<{ domains: DomainWithClassification[]; total: number; fgroups: { id: string; name: string | null; pfam_acc: string | null }[] }> {
  const dotCount = (groupId.match(/\./g) || []).length;
  const limit = Math.min(opts.limit || 100, 1000);
  const offset = opts.offset || 0;

  // Build the scope condition: which fids fall under this group?
  // For .0 matching, we need fid LIKE 'groupId.%.0' (for X/H/T) or fid = 'groupId' (for F)
  // For no-pfam matching, we LEFT JOIN cluster and check pfam_acc IS NULL/empty
  let scopeCondition: string;
  let scopeParam: string;

  if (dotCount >= 3) {
    // F-group: exact match (only makes sense for .0 F-groups)
    scopeCondition = 'd.fid = $1';
    scopeParam = groupId;
  } else {
    // X/H/T: all fids under this prefix
    scopeCondition = 'd.fid LIKE $1';
    scopeParam = `${groupId}.%`;
  }

  // The unclassified filter: .0 families OR families with no Pfam in the cluster table
  // Since .0 families may not exist in cluster, we use:
  //   d.fid LIKE '%.0' (catches placeholder families)
  //   OR fc.pfam_acc IS NULL/empty (catches cluster rows without Pfam — fc is LEFT JOIN)
  //   OR fc.id IS NULL (catches fids with no cluster row at all, like orphan .0s)
  const unclassifiedCondition = opts.noPfamOnly
    ? `(fc.id IS NULL OR fc.pfam_acc IS NULL OR fc.pfam_acc = '')`
    : `(d.fid LIKE '%.0' OR fc.id IS NULL OR fc.pfam_acc IS NULL OR fc.pfam_acc = '')`;

  // Count total unclassified domains in scope
  const countResult = await query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    WHERE ${scopeCondition}
      AND ${unclassifiedCondition}
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
  `, [scopeParam]);
  const total = parseInt(countResult[0]?.count || '0');

  if (total === 0) {
    return { domains: [], total: 0, fgroups: [] };
  }

  // Get distinct unclassified fids in scope (for the fgroups summary)
  const fgroupRows = await query<{ fid: string; name: string | null; pfam_acc: string | null }>(`
    SELECT DISTINCT d.fid as fid, fc.name, fc.pfam_acc
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    WHERE ${scopeCondition}
      AND ${unclassifiedCondition}
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.fid
  `, [scopeParam]);

  // Fetch domains with pagination
  const rows = await query<DomainListRow>(`
    SELECT
      d.uid, d.id, d.type::text, d.range, d.source_id, d.unp_acc, d.chain_id,
      d.fid, fc.name as fname,
      d.tid, tc.name as tname,
      cr.hid, hc.name as hname,
      cr.xid, xc.name as xname,
      xc.parent as aid, ac.name as aname,
      d.is_rep, d.is_manual
    FROM domain d
    LEFT JOIN cluster fc ON d.fid = fc.id
    LEFT JOIN cluster tc ON d.tid = tc.id
    LEFT JOIN cluster_relation cr ON d.tid = cr.tid
    LEFT JOIN cluster hc ON cr.hid = hc.id
    LEFT JOIN cluster xc ON cr.xid = xc.id
    LEFT JOIN cluster ac ON xc.parent = ac.id
    WHERE ${scopeCondition}
      AND ${unclassifiedCondition}
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.fid, d.is_rep DESC NULLS LAST, d.uid
    LIMIT $2 OFFSET $3
  `, [scopeParam, limit, offset]);

  return {
    domains: rows.map(rowToClassifiedDomain),
    total,
    fgroups: fgroupRows.map(f => ({ id: f.fid, name: f.name, pfam_acc: f.pfam_acc })),
  };
}

// ============================================================
// Extended queries for internal UI routes (include ligand data)
// ============================================================

/** Domain row with ligand + classification from JOINs (for UI views). */
export interface DomainDetailRow {
  uid: number;
  id: string;
  type: string;
  range: string;
  chain_id: string;
  fid: string | null;
  fname: string | null;
  tid: string | null;
  tname: string | null;
  hid: string | null;
  hname: string | null;
  xid: string | null;
  xname: string | null;
  ligand: string | null;
  ligand_pdbnum: string | null;
}

/** The standard classification JOIN fragment (reusable SQL). */
const CLASSIFICATION_JOINS = `
  LEFT JOIN cluster fc ON d.fid = fc.id
  LEFT JOIN cluster tc ON d.tid = tc.id
  LEFT JOIN cluster_relation cr ON d.tid = cr.tid
  LEFT JOIN cluster hc ON cr.hid = hc.id
  LEFT JOIN cluster xc ON cr.xid = xc.id`;

/** Standard SELECT columns for detail queries. */
const DETAIL_SELECT = `
  d.uid, d.id, d.type::text, d.range, d.chain_id,
  d.fid, fc.name as fname,
  d.tid, tc.name as tname,
  cr.hid, hc.name as hname,
  cr.xid, xc.name as xname,
  d.ligand, d.ligand_pdbnum`;

/**
 * Get domains for a single PDB chain (source_id match) with classification + ligands.
 */
export async function getDomainsBySourceId(sourceId: string): Promise<DomainDetailRow[]> {
  return query<DomainDetailRow>(`
    SELECT ${DETAIL_SELECT}
    FROM domain d
    ${CLASSIFICATION_JOINS}
    WHERE d.source_id = $1
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.start_index NULLS LAST, d.uid
  `, [sourceId]);
}

/**
 * Get domains for a UniProt accession with classification + ligands.
 */
export async function getDomainDetailsByUniprot(unpAcc: string): Promise<DomainDetailRow[]> {
  return query<DomainDetailRow>(`
    SELECT ${DETAIL_SELECT}
    FROM domain d
    ${CLASSIFICATION_JOINS}
    WHERE d.unp_acc = $1
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.start_index NULLS LAST, d.uid
  `, [unpAcc]);
}

/** Domain row for PDB view (includes chain name from pdb_chain_info). */
export interface PdbDomainDetailRow extends DomainDetailRow {
  chain_name: string | null;
}

/**
 * Get all domains for a PDB entry with classification, ligands, and chain names.
 */
export async function getDomainDetailsByPdb(pdbId: string): Promise<PdbDomainDetailRow[]> {
  return query<PdbDomainDetailRow>(`
    SELECT ${DETAIL_SELECT},
      pci.name as chain_name
    FROM domain d
    LEFT JOIN pdb_chain_info pci ON d.source_id = CONCAT(pci.pdb_id, '_', pci.chain_id)
    ${CLASSIFICATION_JOINS}
    WHERE SPLIT_PART(d.source_id, '_', 1) = $1
      AND d.type = 'experimental structure'
      AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
    ORDER BY d.chain_id, d.start_index NULLS LAST, d.uid
  `, [pdbId.toLowerCase()]);
}
