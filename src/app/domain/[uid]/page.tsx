import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StructureViewer from '@/components/viewer/StructureViewer';

interface DomainPageProps {
  params: Promise<{ uid: string }>;
}

interface ClassificationItem {
  id: string;
  name: string;
}

interface DomainData {
  uid: number;
  id: string;
  type: string;
  range: string;
  sourceId: string | null;
  unpAcc: string | null;
  chainId: string | null;
  isRep: boolean | null;
  classification: {
    architecture: ClassificationItem | null;
    xGroup: ClassificationItem | null;
    hGroup: ClassificationItem | null;
    tGroup: ClassificationItem | null;
    family: ClassificationItem | null;
  };
  protein: {
    unpAcc: string;
    name: string | null;
    geneName: string | null;
  } | null;
  // PDB-specific (experimental structures only)
  pdb: {
    pdbId: string;
    chainId: string;
    moleculeName: string | null;
  } | null;
  // AlphaFold-specific (computed models only)
  representative: {
    uid: number;
    id: string;
  } | null;
  // DrugDomain links
  drugDomain: {
    acc: string;
    link: string;
  }[] | null;
  // Ligand data
  ligands: {
    codes: string;      // e.g., "F6F,NA,PLP"
    residues: string;   // e.g., "B:401,B:402,B:404"
  } | null;
}

interface ApiResponse {
  success: boolean;
  data?: DomainData;
  error?: { code: string; message: string };
}

async function fetchDomain(uid: string): Promise<DomainData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  try {
    const response = await fetch(`${baseUrl}/api/domain/${uid}`, {
      cache: 'no-store',
    });
    const result: ApiResponse = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('Failed to fetch domain:', error);
  }
  return null;
}

export async function generateMetadata({ params }: DomainPageProps): Promise<Metadata> {
  const { uid } = await params;
  const domain = await fetchDomain(uid);

  if (domain) {
    return {
      title: `${domain.id} - ECOD Domain`,
      description: `ECOD domain ${domain.id} - ${domain.classification.family?.name || 'Unclassified'}`,
    };
  }

  return {
    title: `Domain ${uid}`,
    description: `ECOD domain ${uid} details and structure`,
  };
}

// Type badge colors
const typeColors: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-purple-100', text: 'text-purple-800' },
  X: { bg: 'bg-blue-100', text: 'text-blue-800' },
  H: { bg: 'bg-green-100', text: 'text-green-800' },
  T: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  F: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

function ClassificationRow({
  level,
  label,
  item,
}: {
  level: string;
  label: string;
  item: ClassificationItem | null;
}) {
  const colors = typeColors[level] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>
        {level}
      </span>
      <span className="text-gray-500 text-sm w-24">{label}</span>
      {item ? (
        <Link
          href={`/tree?id=${encodeURIComponent(item.id)}`}
          className="text-blue-600 hover:underline text-sm flex-1"
        >
          {item.name}
          <span className="text-gray-400 ml-1 font-mono text-xs">({item.id})</span>
        </Link>
      ) : (
        <span className="text-gray-400 text-sm">—</span>
      )}
    </div>
  );
}

export default async function DomainPage({ params }: DomainPageProps) {
  const { uid } = await params;

  // Validate UID format - allow any positive number
  if (!/^\d+$/.test(uid)) {
    notFound();
  }

  const domain = await fetchDomain(uid);

  if (!domain) {
    notFound();
  }

  // Determine if this is a PDB or AlphaFold domain
  const isPdbDomain = domain.type === 'experimental structure';
  const isAlphaFoldDomain = domain.type === 'computed structural model';

  // Parse source info for PDB domains only
  // PDB sourceId format: "1e0t_A" (pdbId_chainId)
  let pdbId: string | null = null;
  let chainId: string | null = null;
  if (isPdbDomain && domain.sourceId) {
    const parts = domain.sourceId.split('_');
    pdbId = parts[0] || null;
    chainId = parts[1] || null;
  }

  // Format UID with padding
  const paddedUid = domain.uid.toString().padStart(9, '0');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-gray-700">ECOD</Link>
        <span className="mx-2">/</span>
        <Link href="/search" className="hover:text-gray-700">Domains</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{domain.id}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Domain header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {domain.id}
                </h1>
                <p className="text-gray-500 font-mono text-sm">UID: {paddedUid}</p>
              </div>
              <div className="flex items-center gap-2">
                {domain.isRep && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    Representative
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  domain.type === 'experimental structure'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {domain.type === 'experimental structure' ? 'PDB' : 'AlphaFold'}
                </span>
              </div>
            </div>

            <hr className="my-4" />

            {/* Basic info grid */}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Range</dt>
                <dd className="font-mono text-gray-900">{domain.range || '—'}</dd>
              </div>
              {/* Source info - PDB or AlphaFold */}
              {isPdbDomain && pdbId && (
                <div>
                  <dt className="text-gray-500">PDB</dt>
                  <dd className="font-mono">
                    <a
                      href={`https://www.rcsb.org/structure/${pdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {pdbId.toUpperCase()}
                    </a>
                    {chainId && <span className="text-gray-600"> chain {chainId}</span>}
                  </dd>
                </div>
              )}
              {isAlphaFoldDomain && domain.unpAcc && (
                <div>
                  <dt className="text-gray-500">AlphaFold</dt>
                  <dd className="font-mono">
                    <a
                      href={`https://alphafold.ebi.ac.uk/entry/${domain.unpAcc}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      AF-{domain.unpAcc}
                    </a>
                  </dd>
                </div>
              )}
              {domain.unpAcc && (
                <div>
                  <dt className="text-gray-500">UniProt</dt>
                  <dd>
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${domain.unpAcc}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono"
                    >
                      {domain.unpAcc}
                    </a>
                  </dd>
                </div>
              )}
              {domain.protein?.geneName && (
                <div>
                  <dt className="text-gray-500">Gene</dt>
                  <dd className="text-gray-900 italic">{domain.protein.geneName}</dd>
                </div>
              )}
            </dl>

            {/* Protein/molecule name */}
            {(domain.protein?.name || domain.pdb?.moleculeName) && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <span className="text-gray-500">
                  {isPdbDomain ? 'Molecule: ' : 'Protein: '}
                </span>
                <span className="text-gray-900">
                  {domain.pdb?.moleculeName || domain.protein?.name}
                </span>
              </div>
            )}

            {/* DrugDomain links */}
            {domain.drugDomain && domain.drugDomain.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                <span className="text-amber-800 font-medium">DrugDomain: </span>
                <span className="text-amber-900">
                  {domain.drugDomain.map((drug, i) => (
                    <span key={drug.acc}>
                      {i > 0 && ', '}
                      <a
                        href={drug.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {drug.acc}
                      </a>
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* Ligands/cofactors */}
            {domain.ligands && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
                <span className="text-green-800 font-medium">Ligands/Cofactors: </span>
                <span className="text-green-900 font-mono">
                  {domain.ligands.codes}
                </span>
                <span className="text-green-600 text-xs ml-2">
                  (shown in green in context view)
                </span>
              </div>
            )}
          </div>

          {/* 3D Structure Viewer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              3D Structure
            </h2>
            {(pdbId || domain.unpAcc) ? (
              <StructureViewer
                uid={domain.uid}
                pdbId={pdbId}
                afId={domain.type === 'computed structural model' ? domain.unpAcc : undefined}
                chainId={chainId}
                range={domain.range}
                domainId={domain.id}
                ligandResidues={domain.ligands?.residues}
                className="aspect-video"
              />
            ) : (
              <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                <p className="text-gray-400">
                  No structure available for this domain
                </p>
              </div>
            )}
          </div>

          {/* Related domains section placeholder */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Related Domains
            </h2>
            <p className="text-gray-500 text-sm">
              <Link
                href={`/search?q=${encodeURIComponent(domain.classification.family?.id || domain.classification.tGroup?.id || '')}`}
                className="text-blue-600 hover:underline"
              >
                Browse other domains in {domain.classification.family?.name || 'this classification'} →
              </Link>
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Classification */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Classification</h3>
            <div className="space-y-1">
              <ClassificationRow level="A" label="Architecture" item={domain.classification.architecture} />
              <ClassificationRow level="X" label="X-group" item={domain.classification.xGroup} />
              <ClassificationRow level="H" label="H-group" item={domain.classification.hGroup} />
              <ClassificationRow level="T" label="T-group" item={domain.classification.tGroup} />
              <ClassificationRow level="F" label="Family" item={domain.classification.family} />
            </div>
          </div>

          {/* External Links */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">External Links</h3>
            <div className="space-y-2 text-sm">
              {/* PDB links for experimental structures */}
              {isPdbDomain && pdbId && (
                <>
                  <a
                    href={`https://www.rcsb.org/structure/${pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline"
                  >
                    RCSB PDB: {pdbId.toUpperCase()}
                  </a>
                  <a
                    href={`https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline"
                  >
                    PDBe: {pdbId.toUpperCase()}
                  </a>
                </>
              )}
              {/* AlphaFold DB link for computed models */}
              {isAlphaFoldDomain && domain.unpAcc && (
                <a
                  href={`https://alphafold.ebi.ac.uk/entry/${domain.unpAcc}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline"
                >
                  AlphaFold DB: {domain.unpAcc}
                </a>
              )}
              {/* UniProt link for all domains with unp_acc */}
              {domain.unpAcc && (
                <a
                  href={`https://www.uniprot.org/uniprotkb/${domain.unpAcc}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline"
                >
                  UniProt: {domain.unpAcc}
                </a>
              )}
              {!pdbId && !domain.unpAcc && (
                <p className="text-gray-400">No external links available</p>
              )}
            </div>
          </div>

          {/* Representative Domain (AlphaFold only) */}
          {isAlphaFoldDomain && domain.representative && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Representative</h3>
              <p className="text-sm text-gray-600 mb-2">
                This domain is classified based on similarity to:
              </p>
              <Link
                href={`/domain/${domain.representative.uid}`}
                className="block text-blue-600 hover:underline font-mono text-sm"
              >
                {domain.representative.id}
              </Link>
            </div>
          )}

          {/* Downloads */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Downloads</h3>
            <div className="space-y-2">
              {/* Pre-cut domain files only available for experimental structures */}
              {isPdbDomain && (
                <>
                  <a
                    href={`/api/domain/${domain.uid}/pdb`}
                    className="block w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
                  >
                    Download Domain PDB
                  </a>
                  <a
                    href={`/api/domain/${domain.uid}/fasta`}
                    className="block w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
                  >
                    Download Domain FASTA
                  </a>
                </>
              )}
              {/* Full structure links */}
              {isPdbDomain && pdbId && (
                <a
                  href={`https://files.rcsb.org/download/${pdbId}.pdb`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
                >
                  Full PDB Structure
                </a>
              )}
              {isAlphaFoldDomain && domain.unpAcc && (
                <>
                  <a
                    href={`https://alphafold.ebi.ac.uk/files/AF-${domain.unpAcc}-F1-model_v6.pdb`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
                  >
                    Full AlphaFold Structure (PDB)
                  </a>
                  <a
                    href={`https://alphafold.ebi.ac.uk/files/AF-${domain.unpAcc}-F1-model_v6.cif`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
                  >
                    Full AlphaFold Structure (mmCIF)
                  </a>
                </>
              )}
              {/* Note for AlphaFold about domain extraction */}
              {isAlphaFoldDomain && (
                <p className="text-xs text-gray-500 mt-2">
                  Domain coordinates: residues {domain.range}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
