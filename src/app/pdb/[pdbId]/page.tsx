import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StructureViewer from '@/components/viewer/StructureViewer';

interface PdbPageProps {
  params: Promise<{ pdbId: string }>;
}

interface ClassificationItem {
  id: string;
  name: string | null;
}

interface DomainSegment {
  chain: string;
  start: number;
  end: number;
}

interface DomainData {
  uid: number;
  id: string;
  chainId: string;
  chainName: string | null;
  range: string;
  start: number;
  end: number;
  segments: DomainSegment[];
  colorIndex: number;
  classification: {
    x: ClassificationItem | null;
    h: ClassificationItem | null;
    t: ClassificationItem | null;
    f: ClassificationItem | null;
  };
  ligand: string | null;
  ligandResidues: string | null;
}

interface ChainInfo {
  name: string | null;
  domainCount: number;
}

interface PdbInfo {
  id: string;
  method: string | null;
  resolution: number | null;
}

interface ApiResponse {
  success: boolean;
  data?: {
    pdb: PdbInfo;
    chainCount: number;
    domainCount: number;
    chains: Record<string, ChainInfo>;
    chainIds: string[];
    domains: DomainData[];
    domainsByChain: Record<string, DomainData[]>;
    ligandResidues: string | null;
  };
  error?: { code: string; message: string };
}

async function fetchPdb(pdbId: string): Promise<ApiResponse['data'] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    const response = await fetch(`${baseUrl}/api/pdb/${encodeURIComponent(pdbId)}`, {
      cache: 'no-store',
    });
    const result: ApiResponse = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('Failed to fetch PDB:', error);
  }
  return null;
}

export async function generateMetadata({ params }: PdbPageProps): Promise<Metadata> {
  const { pdbId } = await params;
  const data = await fetchPdb(pdbId);

  if (data) {
    return {
      title: `${data.pdb.id} - ECOD Domain Classification`,
      description: `ECOD domain classification for PDB ${data.pdb.id}: ${data.domainCount} domains across ${data.chainCount} chains`,
    };
  }

  return {
    title: `PDB ${pdbId.toUpperCase()}`,
    description: 'ECOD PDB domain classification',
  };
}

// Color palette for domains (same as protein view)
const domainColors = [
  { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-700', fill: '#3b82f6' },
  { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-700', fill: '#f97316' },
  { bg: 'bg-green-500', border: 'border-green-600', text: 'text-green-700', fill: '#22c55e' },
  { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-700', fill: '#a855f7' },
  { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-pink-700', fill: '#ec4899' },
  { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-700', fill: '#06b6d4' },
  { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-700', fill: '#f59e0b' },
  { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-700', fill: '#6366f1' },
  { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-rose-700', fill: '#f43f5e' },
  { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-teal-700', fill: '#14b8a6' },
];

export default async function PdbPage({ params }: PdbPageProps) {
  const { pdbId } = await params;
  const data = await fetchPdb(pdbId);

  if (!data) {
    notFound();
  }

  const { pdb, chainCount, domainCount, chains, chainIds, domains, domainsByChain, ligandResidues } = data;

  // Prepare domains for the viewer (with colorIndex)
  const viewerDomains = domains.map(d => ({
    range: d.range,
    id: d.id,
    colorIndex: d.colorIndex,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <span>PDB</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              PDB {pdb.id}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              {pdb.method && <span>{pdb.method}</span>}
              {pdb.resolution && <span>{pdb.resolution.toFixed(2)} Å</span>}
              <span>{chainCount} chains</span>
              <span>{domainCount} ECOD domains</span>
            </div>
          </div>
          <a
            href={`https://www.rcsb.org/structure/${pdb.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            View in RCSB PDB
          </a>
        </div>
      </div>

      {/* 3D Structure Viewer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          3D Structure
          <span className="ml-2 text-sm font-normal text-gray-500">
            (domains colored, ligands/nucleic acids shown)
          </span>
        </h2>
        <div className="aspect-video">
          <StructureViewer
            pdbId={pdb.id.toLowerCase()}
            domains={viewerDomains}
            ligandResidues={ligandResidues}
            showLigands={true}
            showNucleicAcids={true}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Domain Summary by Chain */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Domains by Chain</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {chainIds.map(chainId => {
            const chainDomains = domainsByChain[chainId] || [];
            const chainInfo = chains[chainId];
            if (chainDomains.length === 0) return null;

            return (
              <div key={chainId} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold text-gray-900">
                      Chain {chainId}
                    </span>
                    {chainInfo?.name && (
                      <span className="text-sm text-gray-600">{chainInfo.name}</span>
                    )}
                    <Link
                      href={`/protein/${pdb.id.toLowerCase()}_${chainId}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      view chain
                    </Link>
                  </div>
                  <span className="text-sm text-gray-500">
                    {chainDomains.length} domain{chainDomains.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {chainDomains.map(domain => {
                    const color = domainColors[domain.colorIndex % domainColors.length];
                    return (
                      <Link
                        key={domain.uid}
                        href={`/domain/${domain.uid}`}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${color.border} ${color.text} hover:bg-gray-50 text-xs`}
                      >
                        <span className={`w-2.5 h-2.5 rounded ${color.bg}`}></span>
                        <span className="font-mono">{domain.id}</span>
                        <span className="text-gray-400">({domain.range})</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Domain Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">All Domains ({domainCount})</h2>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium w-8">#</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium">Domain ID</th>
                <th className="px-4 py-3 font-medium">Range</th>
                <th className="px-4 py-3 font-medium">Family</th>
                <th className="px-4 py-3 font-medium">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {domains.map((domain, i) => {
                const color = domainColors[domain.colorIndex % domainColors.length];
                return (
                  <tr key={domain.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-white text-xs font-bold ${color.bg}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono font-bold">
                      {domain.chainId}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/domain/${domain.uid}`}
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {domain.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-600 text-xs">
                      {domain.range}
                    </td>
                    <td className="px-4 py-2">
                      {domain.classification.f ? (
                        <Link
                          href={`/tree?id=${encodeURIComponent(domain.classification.f.id)}`}
                          className="text-blue-600 hover:underline text-xs"
                          title={domain.classification.f.name || ''}
                        >
                          {domain.classification.f.name || domain.classification.f.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {[
                        domain.classification.x?.id,
                        domain.classification.h?.id,
                        domain.classification.t?.id,
                      ].filter(Boolean).join(' → ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">Visualization Legend</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-blue-500"></span>
            ECOD domains (colored by index)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-gray-300"></span>
            Unclassified protein regions
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-yellow-400"></span>
            Nucleic acids (RNA/DNA)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-green-500"></span>
            Ligands/cofactors
          </span>
        </div>
      </div>
    </div>
  );
}
