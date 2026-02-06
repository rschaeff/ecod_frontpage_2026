import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StructureViewer from '@/components/viewer/StructureViewer';

interface ProteinPageProps {
  params: Promise<{ identifier: string }>;
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
  type: string;
  range: string;
  start: number;
  end: number;
  segments: DomainSegment[];
  classification: {
    x: ClassificationItem | null;
    h: ClassificationItem | null;
    t: ClassificationItem | null;
    f: ClassificationItem | null;
  };
  ligand: string | null;
  ligandResidues: string | null;
}

interface ProteinInfo {
  name: string | null;
  type: 'pdb_chain' | 'uniprot';
  identifier: string;
}

interface GapData {
  start: number;
  end: number;
}

interface ApiResponse {
  success: boolean;
  data?: {
    protein: ProteinInfo;
    estimatedLength: number;
    domainCount: number;
    domains: DomainData[];
    gaps: GapData[];
    ligandResidues: string | null;
  };
  error?: { code: string; message: string };
}

async function fetchProtein(identifier: string): Promise<ApiResponse['data'] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    const response = await fetch(`${baseUrl}/api/protein/${encodeURIComponent(identifier)}`, {
      cache: 'no-store',
    });
    const result: ApiResponse = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('Failed to fetch protein:', error);
  }
  return null;
}

export async function generateMetadata({ params }: ProteinPageProps): Promise<Metadata> {
  const { identifier } = await params;
  const data = await fetchProtein(identifier);

  if (data) {
    const title = data.protein.type === 'pdb_chain'
      ? `${data.protein.identifier} - PDB Chain`
      : `${data.protein.identifier} - UniProt`;
    return {
      title: `${title} - ECOD Domain Architecture`,
      description: `Domain architecture of ${data.protein.identifier}: ${data.domainCount} ECOD domains`,
    };
  }

  return {
    title: `Protein ${identifier}`,
    description: 'ECOD protein domain architecture',
  };
}

// Color palette for domains (distinct colors for up to 10 domains)
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

// Domain architecture diagram component
function DomainArchitecture({
  domains,
  gaps,
  estimatedLength,
}: {
  domains: DomainData[];
  gaps: GapData[];
  estimatedLength: number;
}) {
  const width = 800;
  const height = 60;
  const trackY = 25;
  const trackHeight = 20;
  const labelY = 55;

  // Scale factor: pixels per residue
  const scale = width / estimatedLength;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {/* Background track (full length) */}
        <rect
          x={0}
          y={trackY}
          width={width}
          height={trackHeight}
          fill="#e5e7eb"
          rx={4}
        />

        {/* Gap regions (unclassified) - shown as light gray with pattern */}
        {gaps.map((gap, i) => (
          <rect
            key={`gap-${i}`}
            x={gap.start * scale}
            y={trackY}
            width={(gap.end - gap.start + 1) * scale}
            height={trackHeight}
            fill="#d1d5db"
            rx={2}
          />
        ))}

        {/* Domain regions */}
        {domains.map((domain, i) => {
          const color = domainColors[i % domainColors.length];
          return domain.segments.map((seg, j) => (
            <g key={`${domain.uid}-${j}`}>
              <rect
                x={seg.start * scale}
                y={trackY}
                width={(seg.end - seg.start + 1) * scale}
                height={trackHeight}
                fill={color.fill}
                rx={2}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
              {/* Domain label (only for first segment if wide enough) */}
              {j === 0 && (seg.end - seg.start + 1) * scale > 30 && (
                <text
                  x={seg.start * scale + ((seg.end - seg.start + 1) * scale) / 2}
                  y={trackY + trackHeight / 2 + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {i + 1}
                </text>
              )}
            </g>
          ));
        })}

        {/* Scale markers */}
        <text x={0} y={labelY} fontSize="9" fill="#6b7280">1</text>
        <text x={width} y={labelY} fontSize="9" fill="#6b7280" textAnchor="end">
          {estimatedLength}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        {domains.map((domain, i) => {
          const color = domainColors[i % domainColors.length];
          return (
            <Link
              key={domain.uid}
              href={`/domain/${domain.uid}`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border ${color.border} ${color.text} hover:bg-gray-50`}
            >
              <span className={`w-3 h-3 rounded ${color.bg}`}></span>
              <span className="font-mono">{domain.id}</span>
              <span className="text-gray-400">({domain.range})</span>
            </Link>
          );
        })}
        {gaps.length > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 text-gray-500">
            <span className="w-3 h-3 rounded bg-gray-300"></span>
            Unclassified
          </span>
        )}
      </div>
    </div>
  );
}

export default async function ProteinPage({ params }: ProteinPageProps) {
  const { identifier } = await params;
  const data = await fetchProtein(identifier);

  if (!data) {
    notFound();
  }

  const { protein, estimatedLength, domainCount, domains, gaps, ligandResidues } = data;
  const isPdb = protein.type === 'pdb_chain';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <span>Protein</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {protein.identifier}
            </h1>
            {protein.name && (
              <p className="text-gray-600 mt-1">{protein.name}</p>
            )}
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            isPdb ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {isPdb ? 'PDB Chain' : 'UniProt'}
          </span>
        </div>
      </div>

      {/* Domain Architecture */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Domain Architecture
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({domainCount} domain{domainCount !== 1 ? 's' : ''})
          </span>
        </h2>

        <DomainArchitecture
          domains={domains}
          gaps={gaps}
          estimatedLength={estimatedLength}
        />
      </div>

      {/* 3D Structure Viewer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          3D Structure
        </h2>
        <StructureViewer
          pdbId={isPdb ? protein.identifier.split('_')[0] : undefined}
          afId={!isPdb ? protein.identifier : undefined}
          chainId={isPdb ? protein.identifier.split('_')[1] : undefined}
          domains={domains.map(d => ({ range: d.range, id: d.id }))}
          ligandResidues={ligandResidues}
          className="aspect-video"
        />
      </div>

      {/* Domain Details Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Domain Details</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium w-8">#</th>
                <th className="px-4 py-3 font-medium">Domain ID</th>
                <th className="px-4 py-3 font-medium">Range</th>
                <th className="px-4 py-3 font-medium">X-group</th>
                <th className="px-4 py-3 font-medium">H-group</th>
                <th className="px-4 py-3 font-medium">T-group</th>
                <th className="px-4 py-3 font-medium">Family</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {domains.map((domain, i) => {
                const color = domainColors[i % domainColors.length];
                return (
                  <tr key={domain.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-white text-xs font-bold ${color.bg}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/domain/${domain.uid}`}
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {domain.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">
                      {domain.range}
                    </td>
                    <td className="px-4 py-3">
                      {domain.classification.x ? (
                        <Link
                          href={`/tree?id=${encodeURIComponent(domain.classification.x.id)}`}
                          className="text-blue-600 hover:underline text-xs"
                          title={domain.classification.x.name || ''}
                        >
                          {domain.classification.x.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {domain.classification.h ? (
                        <Link
                          href={`/tree?id=${encodeURIComponent(domain.classification.h.id)}`}
                          className="text-blue-600 hover:underline text-xs"
                          title={domain.classification.h.name || ''}
                        >
                          {domain.classification.h.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {domain.classification.t ? (
                        <Link
                          href={`/tree?id=${encodeURIComponent(domain.classification.t.id)}`}
                          className="text-blue-600 hover:underline text-xs"
                          title={domain.classification.t.name || ''}
                        >
                          {domain.classification.t.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {domain.classification.f ? (
                        <div>
                          <Link
                            href={`/tree?id=${encodeURIComponent(domain.classification.f.id)}`}
                            className="text-blue-600 hover:underline text-xs font-mono"
                          >
                            {domain.classification.f.id}
                          </Link>
                          {domain.classification.f.name && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({domain.classification.f.name})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* External Links */}
      <div className="mt-6 flex flex-wrap gap-3">
        {isPdb ? (
          <>
            <a
              href={`https://www.rcsb.org/structure/${protein.identifier.split('_')[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
            >
              View in RCSB PDB
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </>
        ) : (
          <>
            <a
              href={`https://www.uniprot.org/uniprotkb/${protein.identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
            >
              View in UniProt
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a
              href={`https://alphafold.ebi.ac.uk/entry/${protein.identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
            >
              View in AlphaFold DB
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
