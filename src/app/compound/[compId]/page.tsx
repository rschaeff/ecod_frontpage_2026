// SKETCH: /compound/[compId] — canonical page for a PDB Chemical Component.
// Shows compound metadata, scope, top-binding F-groups, and a paginated PDB list.

import Link from 'next/link';
import { notFound } from 'next/navigation';

interface CompoundResponse {
  success: boolean;
  data?: {
    compound: {
      compId: string;
      name: string | null;
      formula: string | null;
      type: string | null;
      pdbxType: string | null;
      formulaWeight: number | null;
      isMetal: boolean;
      isBuffer: boolean;
      releaseStatus: string | null;
    };
    scope: { nPdbs: number; nDomains: number; nContacts: number };
    topFGroups: { fid: string; name: string | null; nDomains: number }[];
    pdbEntries: {
      items: { pdbId: string; nInstances: number; chains: string[] }[];
      total: number;
      page: number;
      totalPages: number;
    };
  };
}

async function fetchCompound(compId: string, page: number): Promise<CompoundResponse> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/compound/${compId}?page=${page}`, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) return { success: false };
    throw new Error(`compound fetch failed: ${res.status}`);
  }
  return res.json();
}

export default async function CompoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ compId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { compId } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1'));

  const body = await fetchCompound(compId, page);
  if (!body.success || !body.data) notFound();

  const { compound, scope, topFGroups, pdbEntries } = body.data;

  const badges: string[] = [];
  if (compound.isMetal) badges.push('metal');
  if (compound.isBuffer) badges.push('buffer / additive');
  if (compound.type) badges.push(compound.type.toLowerCase());

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <section className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="text-3xl font-mono font-bold">{compound.compId}</h1>
          <span className="text-xl text-gray-700">{compound.name ?? 'Unnamed compound'}</span>
          <div className="flex gap-2">
            {badges.map(b => (
              <span key={b} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border">
                {b}
              </span>
            ))}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Formula</dt>
            <dd className="font-mono">{compound.formula ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Weight</dt>
            <dd>{compound.formulaWeight ? `${compound.formulaWeight.toFixed(2)} Da` : '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Type</dt>
            <dd>{compound.type ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Release</dt>
            <dd>{compound.releaseStatus ?? '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-3 text-sm">
          <a
            className="text-blue-600 hover:underline"
            href={`https://www.rcsb.org/ligand/${compound.compId}`}
            target="_blank" rel="noreferrer"
          >
            RCSB CCD →
          </a>
          <a
            className="text-blue-600 hover:underline"
            href={`https://www.ebi.ac.uk/pdbe-srv/pdbechem/chemicalCompound/show/${compound.compId}`}
            target="_blank" rel="noreferrer"
          >
            PDBe →
          </a>
          {/* DrugBank link (placeholder): populated once drugdomain_annotation loads.
              {drugbank && <a href={drugbank.drugdomainLink}>DrugDomain →</a>} */}
        </div>
      </section>

      {/* Scope */}
      <section className="grid grid-cols-3 gap-4">
        <StatCard label="PDB entries" value={scope.nPdbs.toLocaleString()} />
        <StatCard label="ECOD domains in contact" value={scope.nDomains.toLocaleString()} />
        <StatCard label="Contacts (≤ 4 Å)" value={scope.nContacts.toLocaleString()} />
      </section>

      {/* Top F-groups */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Top-binding ECOD families</h2>
        {topFGroups.length === 0 ? (
          <p className="text-gray-500 text-sm">No ECOD-annotated contacts recorded for this compound.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 border-b">F-group</th>
                <th className="p-2 border-b">Family</th>
                <th className="p-2 border-b text-right">Domains</th>
              </tr>
            </thead>
            <tbody>
              {topFGroups.map(f => (
                <tr key={f.fid} className="hover:bg-gray-50">
                  <td className="p-2 border-b font-mono">
                    <Link className="text-blue-600 hover:underline" href={`/tree/${f.fid}`}>
                      {f.fid}
                    </Link>
                  </td>
                  <td className="p-2 border-b">{f.name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="p-2 border-b text-right">{f.nDomains.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* PDB entries */}
      <section>
        <h2 className="text-xl font-semibold mb-3">PDB entries containing {compound.compId}</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2 border-b">PDB</th>
              <th className="p-2 border-b">Chains</th>
              <th className="p-2 border-b text-right">Instances</th>
            </tr>
          </thead>
          <tbody>
            {pdbEntries.items.map(e => (
              <tr key={e.pdbId} className="hover:bg-gray-50">
                <td className="p-2 border-b font-mono">
                  <Link className="text-blue-600 hover:underline" href={`/pdb/${e.pdbId}`}>
                    {e.pdbId}
                  </Link>
                </td>
                <td className="p-2 border-b font-mono">{e.chains.join(', ')}</td>
                <td className="p-2 border-b text-right">{e.nInstances}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pdbEntries.totalPages > 1 && (
          <div className="flex justify-between items-center mt-3 text-sm">
            <span className="text-gray-500">
              Page {pdbEntries.page} of {pdbEntries.totalPages} ({pdbEntries.total.toLocaleString()} total)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className="text-blue-600 hover:underline"
                      href={`/compound/${compound.compId}?page=${page - 1}`}>
                  ← Prev
                </Link>
              )}
              {page < pdbEntries.totalPages && (
                <Link className="text-blue-600 hover:underline"
                      href={`/compound/${compound.compId}?page=${page + 1}`}>
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
