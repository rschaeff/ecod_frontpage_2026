import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getDomainDetailsByPdb, parseRange, type PdbDomainDetailRow } from '@/lib/domain-queries';

interface ChainInfo {
  chain_id: string;
  name: string | null;
}

interface PdbInfo {
  pdb: string;
  method: string | null;
  resolution: number | null;
}

function isNucleicAcidChain(name: string | null): boolean {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return lowerName.includes('rna') ||
         lowerName.includes('dna') ||
         lowerName.includes('rrna') ||
         lowerName.includes('trna') ||
         lowerName.includes('mrna') ||
         lowerName.includes('nucleic');
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
    // Parallel: PDB info, chain info, and domains
    const [pdbInfo, chains, domains] = await Promise.all([
      query<PdbInfo>(`SELECT pdb, method, resolution::float FROM pdb_info WHERE pdb = $1`, [pdbIdLower]),
      query<ChainInfo>(`SELECT chain_id, name FROM pdb_chain_info WHERE pdb_id = $1 ORDER BY chain_id`, [pdbIdLower]),
      getDomainDetailsByPdb(pdbIdLower),
    ]);

    if (domains.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No domains found for this PDB' } },
        { status: 404 }
      );
    }

    // Process domains - parse ranges and build response
    const processedDomains = domains.map((d: PdbDomainDetailRow, index: number) => {
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
        colorIndex: index,
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
    const domainsByChain: Record<string, typeof processedDomains> = {};
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

    const chainIds = [...new Set(domains.map(d => d.chain_id))];

    // Build chain info with domain counts and type
    const chainInfoMap: Record<string, { name: string | null; domainCount: number; isNucleicAcid: boolean }> = {};
    const nucleicAcidChains: string[] = [];

    for (const chain of chains) {
      const isNA = isNucleicAcidChain(chain.name);
      chainInfoMap[chain.chain_id] = {
        name: chain.name,
        domainCount: domainsByChain[chain.chain_id]?.length || 0,
        isNucleicAcid: isNA,
      };
      if (isNA) {
        nucleicAcidChains.push(chain.chain_id);
      }
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
        nucleicAcidChains,
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
