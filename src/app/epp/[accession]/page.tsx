import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface EppPageProps {
  params: Promise<{ accession: string }>;
}

interface ProteinData {
  accession: string;
  sequence: string;
  sequenceLength: number;
  sequenceMd5: string;
  project: string;
  provenance: {
    originalId: string;
    source: string;
    genomeAccession: string | null;
    contigAccession: string | null;
    organismName: string | null;
    phylum: string | null;
    qualityTier: string | null;
  };
  status: string;
  assignedAt: string | null;
  externalLinks: Record<string, string> | null;
  deprecation?: {
    date: string;
    supersededBy: string | null;
    reason: string | null;
  };
}

async function fetchProtein(accession: string): Promise<ProteinData | null> {
  const bp = process.env.BASE_PATH || '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    const res = await fetch(`${baseUrl}${bp}/api/epp/${accession}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch protein:', error);
    return null;
  }
}

export async function generateMetadata({ params }: EppPageProps): Promise<Metadata> {
  const { accession } = await params;
  const protein = await fetchProtein(accession);

  if (protein) {
    return {
      title: `${protein.accession} - ECOD Predicted Protein`,
      description: `EPP protein ${protein.accession} - ${protein.provenance.organismName || 'Unknown organism'} (${protein.sequenceLength} aa)`,
    };
  }

  return {
    title: `EPP ${accession}`,
    description: `ECOD predicted protein ${accession}`,
  };
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-gray-500 dark:text-gray-400 text-sm w-36 shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 text-sm">{children}</span>
    </div>
  );
}

export default async function EppDetailPage({ params }: EppPageProps) {
  const { accession } = await params;

  if (!/^EPP\d{8}$/i.test(accession)) {
    notFound();
  }

  const protein = await fetchProtein(accession.toUpperCase());

  if (!protein) {
    notFound();
  }

  const isDeprecated = protein.status === 'deprecated';

  // Format sequence in 80-char lines with position markers
  const seqLines: string[] = [];
  for (let i = 0; i < protein.sequence.length; i += 80) {
    seqLines.push(protein.sequence.substring(i, i + 80));
  }

  const linkLabels: Record<string, string> = {
    enaContig: 'ENA Contig',
    ncbiAssembly: 'NCBI Assembly',
    ncbiNuccore: 'NCBI Nuccore',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200">ECOD</Link>
        <span className="mx-2">/</span>
        <Link href="/epp" className="hover:text-gray-700 dark:hover:text-gray-200">Predicted Proteins</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{protein.accession}</span>
      </nav>

      {/* Deprecation banner */}
      {isDeprecated && protein.deprecation && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-400 text-sm font-medium">
            This protein has been deprecated.
          </p>
          {protein.deprecation.reason && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{protein.deprecation.reason}</p>
          )}
          {protein.deprecation.supersededBy && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
              Superseded by:{' '}
              <Link href={`/epp/${protein.deprecation.supersededBy}`} className="underline font-mono">
                {protein.deprecation.supersededBy}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 font-mono">
                  {protein.accession}
                </h1>
                {protein.provenance.organismName && (
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    {protein.provenance.organismName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  isDeprecated
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {protein.status}
                </span>
                {protein.provenance.qualityTier && (
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    protein.provenance.qualityTier === 'HIGH'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {protein.provenance.qualityTier}
                  </span>
                )}
              </div>
            </div>

            <hr className="my-4 dark:border-gray-700" />

            <InfoRow label="Sequence Length">{protein.sequenceLength} aa</InfoRow>
            <InfoRow label="Sequence MD5">
              <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {protein.sequenceMd5}
              </code>
            </InfoRow>
            <InfoRow label="Project">{protein.project}</InfoRow>
            <InfoRow label="Source">{protein.provenance.source}</InfoRow>
            {protein.provenance.phylum && (
              <InfoRow label="Phylum">{protein.provenance.phylum}</InfoRow>
            )}
            {protein.assignedAt && (
              <InfoRow label="Assigned">
                {new Date(protein.assignedAt).toLocaleDateString()}
              </InfoRow>
            )}
          </div>

          {/* Sequence */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sequence</h2>
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/epp/${protein.accession}/fasta`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                download
              >
                Download FASTA
              </a>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-4 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{seqLines.map((line, i) => (
  <span key={i}>
    <span className="text-gray-400 dark:text-gray-500 select-none">{String(i * 80 + 1).padStart(6)} </span>
    {line}
    {'\n'}
  </span>
))}
            </pre>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Provenance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Provenance</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Original ID</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
                  {protein.provenance.originalId}
                </span>
              </div>
              {protein.provenance.genomeAccession && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Genome</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {protein.provenance.genomeAccession}
                  </span>
                </div>
              )}
              {protein.provenance.contigAccession && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Contig</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {protein.provenance.contigAccession}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          {protein.externalLinks && Object.keys(protein.externalLinks).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">External Links</h2>
              <div className="space-y-2">
                {Object.entries(protein.externalLinks).map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {linkLabels[key] || key}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* API */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">API Access</h2>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block mb-1">JSON</span>
                <code className="text-gray-700 dark:text-gray-300 break-all">
                  /api/epp/{protein.accession}
                </code>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block mb-1">FASTA</span>
                <code className="text-gray-700 dark:text-gray-300 break-all">
                  /api/epp/{protein.accession}/fasta
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
