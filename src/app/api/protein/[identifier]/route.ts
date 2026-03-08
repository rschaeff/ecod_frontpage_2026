import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  getDomainsBySourceId,
  getDomainDetailsByUniprot,
  parseRange,
  getRangeBounds,
  type DomainDetailRow,
} from '@/lib/domain-queries';

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
    const isPdbChain = identifier.includes('_');

    let domains: DomainDetailRow[];
    let proteinInfo: { name: string | null; type: string; identifier: string };

    if (isPdbChain) {
      const [pdbId, chainId] = identifier.toLowerCase().split('_');
      const sourceId = `${pdbId}_${chainId.toUpperCase()}`;

      domains = await getDomainsBySourceId(sourceId);

      const chainInfo = await query<{ name: string | null }>(
        `SELECT name FROM pdb_chain_info WHERE pdb_id = $1 AND chain_id = $2`,
        [pdbId, chainId.toUpperCase()]
      );

      proteinInfo = {
        name: chainInfo[0]?.name || null,
        type: 'pdb_chain',
        identifier: `${pdbId.toUpperCase()}_${chainId.toUpperCase()}`,
      };
    } else {
      domains = await getDomainDetailsByUniprot(identifier);

      const unpInfo = await query<{ full_name: string | null }>(
        `SELECT full_name FROM unp_info WHERE unp_acc = $1`,
        [identifier]
      );

      proteinInfo = {
        name: unpInfo[0]?.full_name || null,
        type: 'uniprot',
        identifier,
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

    const maxEnd = Math.max(...processedDomains.map(d => d.end));
    const minStart = Math.min(...processedDomains.map(d => d.start));
    const estimatedLength = maxEnd;

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
