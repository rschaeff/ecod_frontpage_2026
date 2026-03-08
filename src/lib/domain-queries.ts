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
