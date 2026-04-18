import { Pool, QueryResultRow } from 'pg';

// Separate pool for the EPP database (different host/db from ECOD)
let eppPool: Pool | null = null;

function getEppPool(): Pool {
  if (!eppPool) {
    eppPool = new Pool({
      host: process.env.EPP_DB_HOST || 'dione',
      port: parseInt(process.env.EPP_DB_PORT || '45000'),
      database: process.env.EPP_DB_NAME || 'ecod_protein',
      user: process.env.EPP_DB_USER || 'ecod',
      password: process.env.EPP_DB_PASSWORD,
      max: 5,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 10000,
      statement_timeout: 30000,
    });

    eppPool.on('error', (err) => {
      console.error('EPP database pool error:', err);
    });
  }
  return eppPool;
}

export async function eppQuery<T extends QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<T[]> {
  const start = Date.now();
  const pool = getEppPool();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('EPP DB Query:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result.rows;
  } catch (error) {
    console.error('EPP database query error:', {
      text: text.substring(0, 200),
      ...(process.env.NODE_ENV === 'development' ? { params } : {}),
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

export async function eppQueryOne<T extends QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<T | null> {
  const rows = await eppQuery<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

// ============================================================
// EPP protein row types and formatting
// ============================================================

interface EppProteinRow {
  epp_accession: string;
  sequence: string;
  sequence_length: number;
  sequence_md5: string;
  project: string;
  original_id: string;
  source: string;
  genome_accession: string | null;
  contig_accession: string | null;
  organism_name: string | null;
  phylum: string | null;
  quality_tier: string | null;
  assigned_at: string | null;
  deprecated_at: string | null;
  superseded_by: string | null;
  deprecation_reason: string | null;
}

interface EppMd5Row {
  epp_accession: string;
  sequence_length: number;
  organism_name: string | null;
  phylum: string | null;
  status: string;
}

function buildExternalLinks(row: EppProteinRow) {
  const links: Record<string, string> = {};
  if (row.contig_accession) {
    links.enaContig = `https://www.ebi.ac.uk/ena/browser/view/${row.contig_accession}`;
    links.ncbiNuccore = `https://www.ncbi.nlm.nih.gov/nuccore/${row.contig_accession}`;
  }
  if (row.genome_accession) {
    links.ncbiAssembly = `https://www.ncbi.nlm.nih.gov/datasets/genome/${row.genome_accession}`;
  }
  return Object.keys(links).length > 0 ? links : null;
}

export function formatProteinResponse(row: EppProteinRow) {
  const response: Record<string, unknown> = {
    accession: row.epp_accession,
    sequence: row.sequence,
    sequenceLength: row.sequence_length,
    sequenceMd5: row.sequence_md5,
    project: row.project,
    provenance: {
      originalId: row.original_id,
      source: row.source,
      genomeAccession: row.genome_accession,
      contigAccession: row.contig_accession,
      organismName: row.organism_name,
      phylum: row.phylum,
      qualityTier: row.quality_tier,
    },
    status: row.deprecated_at ? 'deprecated' : 'active',
    assignedAt: row.assigned_at,
    externalLinks: buildExternalLinks(row),
  };

  if (row.deprecated_at) {
    response.deprecation = {
      date: row.deprecated_at,
      supersededBy: row.superseded_by,
      reason: row.deprecation_reason,
    };
  }

  return response;
}

// ============================================================
// Query functions
// ============================================================

const PROTEIN_COLUMNS = `
  epp_accession, sequence, sequence_length, sequence_md5,
  project, original_id, source,
  genome_accession, contig_accession, organism_name, phylum, quality_tier,
  assigned_at, deprecated_at, superseded_by, deprecation_reason
`;

export async function getProteinByAccession(accession: string) {
  return eppQueryOne<EppProteinRow>(
    `SELECT ${PROTEIN_COLUMNS} FROM epp.proteins WHERE epp_accession = $1`,
    [accession]
  );
}

export async function getProteinsByMd5(md5: string) {
  return eppQuery<EppMd5Row>(
    `SELECT epp_accession, sequence_length, organism_name, phylum,
            CASE WHEN deprecated_at IS NULL THEN 'active' ELSE 'deprecated' END as status
     FROM epp.proteins
     WHERE sequence_md5 = $1
     ORDER BY epp_id`,
    [md5]
  );
}

export function formatFasta(row: EppProteinRow): string {
  const header = [row.epp_accession, row.organism_name, row.genome_accession, row.source]
    .filter(Boolean)
    .join(' | ');
  const lines: string[] = [`>${header}`];
  for (let i = 0; i < row.sequence.length; i += 80) {
    lines.push(row.sequence.substring(i, i + 80));
  }
  return lines.join('\n') + '\n';
}
