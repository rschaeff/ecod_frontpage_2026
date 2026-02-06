import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DomainRow {
  uid: number;
  id: string;
  chain_id: string;
  range: string;
  chain_name: string | null;
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

interface ChainInfo {
  chain_id: string;
  name: string | null;
}

interface PdbInfo {
  pdb: string;
  method: string | null;
  resolution: number | null;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pdbId: string }> }
) {
  const { pdbId } = await params;

  if (!pdbId || pdbId.length !== 4) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PDB', message: 'Invalid PDB ID format' } },
      { status: 400 }
    );
  }

  const pdbIdLower = pdbId.toLowerCase();

  try {
    // Get PDB info
    const pdbInfo = await query<PdbInfo>(`
      SELECT pdb, method, resolution::float
      FROM pdb_info
      WHERE pdb = $1
    `, [pdbIdLower]);

    // Get all chains for this PDB
    const chains = await query<ChainInfo>(`
      SELECT chain_id, name
      FROM pdb_chain_info
      WHERE pdb_id = $1
      ORDER BY chain_id
    `, [pdbIdLower]);

    // Get all domains for this PDB
    const domains = await query<DomainRow>(`
      SELECT
        d.uid, d.id, d.chain_id, d.range,
        pci.name as chain_name,
        d.fid, fc.name as fname,
        d.tid, tc.name as tname,
        cr.hid, hc.name as hname,
        cr.xid, xc.name as xname,
        d.ligand, d.ligand_pdbnum
      FROM domain d
      LEFT JOIN pdb_chain_info pci ON d.source_id = CONCAT(pci.pdb_id, '_', pci.chain_id)
      LEFT JOIN cluster fc ON d.fid = fc.id
      LEFT JOIN cluster tc ON d.tid = tc.id
      LEFT JOIN cluster_relation cr ON d.tid = cr.tid
      LEFT JOIN cluster hc ON cr.hid = hc.id
      LEFT JOIN cluster xc ON cr.xid = xc.id
      WHERE SPLIT_PART(d.source_id, '_', 1) = $1
        AND d.type = 'experimental structure'
        AND (d.is_obsolete IS NULL OR d.is_obsolete = false)
      ORDER BY d.chain_id, d.start_index NULLS LAST, d.uid
    `, [pdbIdLower]);

    if (domains.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No domains found for this PDB' } },
        { status: 404 }
      );
    }

    // Group domains by chain
    const domainsByChain: Record<string, typeof processedDomains> = {};

    // Process domains
    const processedDomains = domains.map((d, index) => {
      const parsedRanges = parseRange(d.range);
      const start = parsedRanges.length > 0 ? Math.min(...parsedRanges.map(r => r.start)) : 0;
      const end = parsedRanges.length > 0 ? Math.max(...parsedRanges.map(r => r.end)) : 0;

      return {
        uid: d.uid,
        id: d.id,
        chainId: d.chain_id,
        chainName: d.chain_name,
        range: d.range,
        start,
        end,
        segments: parsedRanges,
        colorIndex: index, // Will be used for coloring in the viewer
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

    // Group by chain
    for (const domain of processedDomains) {
      if (!domainsByChain[domain.chainId]) {
        domainsByChain[domain.chainId] = [];
      }
      domainsByChain[domain.chainId].push(domain);
    }

    // Collect all ligand residues
    const allLigandResidues = domains
      .filter(d => d.ligand_pdbnum)
      .map(d => d.ligand_pdbnum)
      .join(',');

    // Get unique chain IDs from domains
    const chainIds = [...new Set(domains.map(d => d.chain_id))];

    // Build chain info with domain counts
    const chainInfoMap: Record<string, { name: string | null; domainCount: number }> = {};
    for (const chain of chains) {
      chainInfoMap[chain.chain_id] = {
        name: chain.name,
        domainCount: domainsByChain[chain.chain_id]?.length || 0,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        pdb: {
          id: pdbIdLower.toUpperCase(),
          method: pdbInfo[0]?.method || null,
          resolution: pdbInfo[0]?.resolution || null,
        },
        chainCount: chains.length,
        domainCount: processedDomains.length,
        chains: chainInfoMap,
        chainIds,
        domains: processedDomains,
        domainsByChain,
        ligandResidues: allLigandResidues || null,
      },
    });
  } catch (error) {
    console.error('PDB fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch PDB data' } },
      { status: 500 }
    );
  }
}
