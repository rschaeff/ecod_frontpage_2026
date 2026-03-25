/**
 * Predicted structures registry — queries predicted_struct.structures.
 *
 * Source-agnostic: serves structures for EPP, UniParc, and UniProt proteins.
 * Uses the same database connection pool as epp-db.ts (dione:45000/ecod_protein).
 */

import { eppQuery, eppQueryOne } from './epp-db';

// ============================================================
// Types
// ============================================================

export interface PredictedStructureRow {
  structure_id: number;
  seq_source: string;
  seq_accession: string;
  method: string;
  method_version: string | null;
  format: string;
  cif_path: string | null;
  pae_path: string | null;
  mean_plddt: number | null;
  ptm_score: number | null;
  file_size_bytes: number | null;
  project: string | null;
}

export interface StructureInfo {
  method: string;
  methodVersion: string | null;
  format: string;
  meanPlddt: number | null;
  ptmScore: number | null;
  fileSizeBytes: number | null;
  project: string | null;
  hasPae: boolean;
  downloadUrl: string;
}

// ============================================================
// Queries
// ============================================================

const STRUCTURE_COLUMNS = `
  structure_id, seq_source, seq_accession, method, method_version, format,
  cif_path, pae_path, mean_plddt, ptm_score, file_size_bytes, project
`;

/**
 * Get all predicted structures for a given sequence, ordered by confidence.
 */
export async function getStructures(
  seqSource: string,
  seqAccession: string
): Promise<PredictedStructureRow[]> {
  return eppQuery<PredictedStructureRow>(
    `SELECT ${STRUCTURE_COLUMNS}
     FROM predicted_struct.structures
     WHERE seq_source = $1 AND seq_accession = $2
     ORDER BY mean_plddt DESC NULLS LAST`,
    [seqSource, seqAccession]
  );
}

/**
 * Get the best available structure (highest pLDDT), optionally filtered by method.
 */
export async function getBestStructure(
  seqSource: string,
  seqAccession: string,
  method?: string
): Promise<PredictedStructureRow | null> {
  const methodClause = method ? 'AND method = $3' : '';
  const params: (string | number)[] = [seqSource, seqAccession];
  if (method) params.push(method);

  return eppQueryOne<PredictedStructureRow>(
    `SELECT ${STRUCTURE_COLUMNS}
     FROM predicted_struct.structures
     WHERE seq_source = $1 AND seq_accession = $2
       ${methodClause}
     ORDER BY mean_plddt DESC NULLS LAST
     LIMIT 1`,
    params
  );
}

/**
 * Check if any predicted structure exists for a sequence (cheap existence check).
 */
export async function hasStructure(
  seqSource: string,
  seqAccession: string
): Promise<boolean> {
  const row = await eppQueryOne<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM predicted_struct.structures
       WHERE seq_source = $1 AND seq_accession = $2
     ) as exists`,
    [seqSource, seqAccession]
  );
  return row?.exists ?? false;
}

// ============================================================
// Formatting
// ============================================================

/**
 * Build the download URL for a structure.
 * For EPP proteins, uses the backward-compatible /api/epp/ endpoint.
 * For other sources, uses the general /api/structures/ endpoint.
 */
function buildDownloadUrl(row: PredictedStructureRow): string {
  if (row.seq_source === 'epp') {
    return `/api/epp/${row.seq_accession}/structure?method=${row.method}`;
  }
  return `/api/structures/${row.seq_source}/${row.seq_accession}/download?method=${row.method}`;
}

export function formatStructureInfo(row: PredictedStructureRow): StructureInfo {
  return {
    method: row.method,
    methodVersion: row.method_version,
    format: row.format,
    meanPlddt: row.mean_plddt,
    ptmScore: row.ptm_score,
    fileSizeBytes: row.file_size_bytes,
    project: row.project,
    hasPae: !!row.pae_path,
    downloadUrl: buildDownloadUrl(row),
  };
}

// ============================================================
// Source detection helpers
// ============================================================

/**
 * Detect the seq_source from an accession string.
 * Returns null if the format is not recognized.
 */
export function detectSeqSource(accession: string): string | null {
  if (/^EPP\d{8}$/i.test(accession)) return 'epp';
  if (/^UPI[0-9A-F]{10}$/i.test(accession)) return 'uniparc';
  // UniProt accessions: 6-10 alphanumeric (simplified pattern)
  if (/^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i.test(accession)) return 'uniprot';
  if (/^[A-Z][0-9][A-Z0-9]{3}[0-9][A-Z0-9]{0,4}$/i.test(accession)) return 'uniprot';
  return null;
}

/**
 * Validate a seq_source value.
 */
export function isValidSource(source: string): boolean {
  return ['epp', 'uniparc', 'uniprot'].includes(source);
}
