import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainRow {
  uid: number;
  id: string;
  type: string;
  range: string;
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

interface ParsedRange {
  chain: string;
  start: number;
  end: number;
}

// Parse range string like "B:2-200" or "A:1-50,A:100-150"
function parseRange(rangeStr: string): ParsedRange[] {
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

// Get overall start/end from parsed ranges
function getRangeBounds(ranges: ParsedRange[]): { start: number; end: number } | null {
  if (ranges.length === 0) return null;
  const start = Math.min(...ranges.map(r => r.start));
  const end = Math.max(...ranges.map(r => r.end));
  return { start, end };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;

  if (!identifier) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_ID', message: 'No identifier provided' } },
      { status: 400 }
    );
  }

  try {
    // Determine if this is a PDB chain (contains underscore) or UniProt accession
    const isPdbChain = identifier.includes('_');

    let domains: DomainRow[];
    let proteinInfo: { name: string | null; type: string; identifier: string };

    if (isPdbChain) {
      // PDB chain format: "7me8_B"
      const [pdbId, chainId] = identifier.toLowerCase().split('_');

      // Get domains for this chain
      domains = await query<DomainRow>(`
        SELECT
          d.uid, d.id, d.type::text, d.range,
          d.fid, fc.name as fname,
          d.tid, tc.name as tname,
          cr.hid, hc.name as hname,
          cr.xid, xc.name as xname,
          d.ligand, d.ligand_pdbnum
        FROM domain d
        LEFT JOIN cluster fc ON d.fid = fc.id
        LEFT JOIN cluster tc ON d.tid = tc.id
        LEFT JOIN cluster_relation cr ON d.tid = cr.tid
        LEFT JOIN cluster hc ON cr.hid = hc.id
        LEFT JOIN cluster xc ON cr.xid = xc.id
        WHERE d.source_id = $1
          AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
        ORDER BY d.start_index NULLS LAST, d.uid
      `, [`${pdbId}_${chainId.toUpperCase()}`]);

      // Get chain name
      const chainInfo = await query<{ name: string | null }>(`
        SELECT name FROM pdb_chain_info WHERE pdb_id = $1 AND chain_id = $2
      `, [pdbId, chainId.toUpperCase()]);

      proteinInfo = {
        name: chainInfo[0]?.name || null,
        type: 'pdb_chain',
        identifier: `${pdbId.toUpperCase()}_${chainId.toUpperCase()}`,
      };
    } else {
      // UniProt accession
      domains = await query<DomainRow>(`
        SELECT
          d.uid, d.id, d.type::text, d.range,
          d.fid, fc.name as fname,
          d.tid, tc.name as tname,
          cr.hid, hc.name as hname,
          cr.xid, xc.name as xname,
          d.ligand, d.ligand_pdbnum
        FROM domain d
        LEFT JOIN cluster fc ON d.fid = fc.id
        LEFT JOIN cluster tc ON d.tid = tc.id
        LEFT JOIN cluster_relation cr ON d.tid = cr.tid
        LEFT JOIN cluster hc ON cr.hid = hc.id
        LEFT JOIN cluster xc ON cr.xid = xc.id
        WHERE d.unp_acc = $1
          AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
        ORDER BY d.start_index NULLS LAST, d.uid
      `, [identifier]);

      // Get protein name from unp_info
      const unpInfo = await query<{ full_name: string | null }>(`
        SELECT full_name FROM unp_info WHERE unp_acc = $1
      `, [identifier]);

      proteinInfo = {
        name: unpInfo[0]?.full_name || null,
        type: 'uniprot',
        identifier: identifier,
      };
    }

    if (domains.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No domains found for this protein/chain' } },
        { status: 404 }
      );
    }

    // Process domains - parse ranges and build response
    const processedDomains = domains.map(d => {
      const parsedRanges = parseRange(d.range);
      const bounds = getRangeBounds(parsedRanges);

      return {
        uid: d.uid,
        id: d.id,
        type: d.type,
        range: d.range,
        start: bounds?.start ?? 0,
        end: bounds?.end ?? 0,
        segments: parsedRanges,
        classification: {
          x: d.xid ? { id: d.xid, name: d.xname } : null,
          h: d.hid ? { id: d.hid, name: d.hname } : null,
          t: d.tid ? { id: d.tid, name: d.tname } : null,
          f: d.fid ? { id: d.fid, name: d.fname } : null,
        },
        ligand: d.ligand,
        ligandResidues: d.ligand_pdbnum,
      };
    });

    // Collect all ligand residues for 3D viewer
    const allLigandResidues = domains
      .filter(d => d.ligand_pdbnum)
      .map(d => d.ligand_pdbnum)
      .join(',');

    // Sort by start position
    processedDomains.sort((a, b) => a.start - b.start);

    // Calculate chain length estimate (max end position + some buffer)
    const maxEnd = Math.max(...processedDomains.map(d => d.end));
    const minStart = Math.min(...processedDomains.map(d => d.start));
    const estimatedLength = maxEnd; // We don't know actual length, use max domain end

    // Find gaps (unclassified regions)
    const gaps: { start: number; end: number }[] = [];
    let lastEnd = minStart - 1;

    for (const domain of processedDomains) {
      if (domain.start > lastEnd + 1) {
        gaps.push({ start: lastEnd + 1, end: domain.start - 1 });
      }
      lastEnd = Math.max(lastEnd, domain.end);
    }

    return NextResponse.json({
      success: true,
      data: {
        protein: proteinInfo,
        estimatedLength,
        domainCount: processedDomains.length,
        domains: processedDomains,
        gaps,
        ligandResidues: allLigandResidues || null,
      },
    });
  } catch (error) {
    console.error('Protein fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch protein data' } },
      { status: 500 }
    );
  }
}
