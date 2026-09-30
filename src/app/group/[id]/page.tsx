// /group/[id] — ligand and drug annotations aggregated over one classification
// group (X, H, T or F). The reverse view of /compound/[compId], which lists the
// groups that bind a compound: together they let a user go from a fold to what
// it binds, and from a compound to the folds that bind it.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { internalBaseUrl } from '@/lib/server-config';
import ChemicalProfile, { type ChemicalProfileData } from '@/components/group/ChemicalProfile';

type Level = 'X' | 'H' | 'T' | 'F';

interface GroupResponse {
  success: boolean;
  data?: {
    group: { id: string; type: Level; name: string | null; pfamAcc: string | null };
    lineage: { id: string; type: string; name: string | null }[];
    scope: { nDomains: number; nWithContacts: number; nWithDrugDomain: number; nWithDrug: number };
    topCompounds: { compId: string; name: string | null; isMetal: boolean; nDomains: number }[];
    topDrugs: { drugbankAcc: string; drugName: string | null; ligandPdb: string | null; name: string | null; nDomains: number }[];
    chemicalProfile: ChemicalProfileData | null;
  };
}

const LEVEL_NAME: Record<string, string> = {
  A: 'Architecture',
  X: 'X-group (possible homology)',
  H: 'H-group (homology)',
  T: 'T-group (topology)',
  F: 'F-group (family)',
};

const LEVEL_BADGE: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800',
  X: 'bg-blue-100 text-blue-800',
  H: 'bg-green-100 text-green-800',
  T: 'bg-yellow-100 text-yellow-800',
  F: 'bg-orange-100 text-orange-800',
};

async function fetchGroup(id: string): Promise<GroupResponse> {
  const bp = process.env.BASE_PATH || '';
  const res = await fetch(`${internalBaseUrl()}${bp}/api/group/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return { success: false };
    throw new Error(`group fetch failed: ${res.status}`);
  }
  return res.json();
}

// Chemical Component Dictionary names can arrive wrapped in CIF text-field
// delimiters (";…;") with embedded line breaks.
function cleanName(name: string | null): string | null {
  if (!name) return null;
  const s = name.replace(/^\s*;\s*|\s*;\s*$/g, '').replace(/\s*\n\s*/g, '').trim();
  return s || null;
}

function pct(n: number, of: number): string {
  if (!of) return '—';
  const p = (100 * n) / of;
  return p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ligands and drugs · ${id}` };
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await fetchGroup(id);
  if (!body.success || !body.data) notFound();

  const { group, lineage, scope, topCompounds, topDrugs, chemicalProfile } = body.data;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <section className="border rounded-lg p-6 bg-white shadow-sm">
        {lineage.length > 0 && (
          <nav className="text-sm text-gray-500 mb-3 flex flex-wrap items-center gap-1" aria-label="Classification">
            {lineage.map((l, i) => (
              <span key={l.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>›</span>}
                {l.type === 'A' ? (
                  <span>{l.name ?? l.id}</span>
                ) : (
                  <Link className="text-blue-600 hover:underline" href={`/group/${l.id}`}>
                    {l.id} {l.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${LEVEL_BADGE[group.type]}`}>
            {LEVEL_NAME[group.type]}
          </span>
          <h1 className="text-3xl font-bold">
            <span className="font-mono">{group.id}</span> {group.name}
          </h1>
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <Link className="text-blue-600 hover:underline" href={`/tree?id=${encodeURIComponent(group.id)}`}>
            Open in classification tree →
          </Link>
          {group.pfamAcc && (
            <a
              className="text-blue-600 hover:underline"
              href={`https://www.ebi.ac.uk/interpro/entry/pfam/${group.pfamAcc}`}
              target="_blank" rel="noreferrer"
            >
              Pfam {group.pfamAcc} →
            </a>
          )}
        </div>
      </section>

      {/* Scope */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Ligands and drugs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Member domains" value={scope.nDomains.toLocaleString()} />
          <StatCard
            label="with ligand contacts (≤ 4 Å)"
            value={scope.nWithContacts.toLocaleString()}
            sub={pct(scope.nWithContacts, scope.nDomains)}
          />
          <StatCard
            label="with DrugDomain annotations"
            value={scope.nWithDrugDomain.toLocaleString()}
            sub={pct(scope.nWithDrugDomain, scope.nDomains)}
          />
          <StatCard
            label="with a DrugBank compound"
            value={scope.nWithDrug.toLocaleString()}
            sub={pct(scope.nWithDrug, scope.nDomains)}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Aggregated over all current member domains of this group. Drug annotations come
          from <a className="text-blue-600 hover:underline" href="https://drugdomain.cs.ucf.edu/" target="_blank" rel="noreferrer">DrugDomain</a>;
          buffers and crystallization additives are excluded from the tables below.
        </p>
      </section>

      {chemicalProfile && <ChemicalProfile data={chemicalProfile} groupId={group.id} />}

      {/* Drugs */}
      <section>
        <h2 className="text-xl font-semibold mb-3">DrugBank compounds</h2>
        {topDrugs.length === 0 ? (
          <p className="text-gray-500 text-sm">No DrugBank compounds are annotated on this group&apos;s domains.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 border-b">DrugBank</th>
                <th className="p-2 border-b">PDB ligand</th>
                <th className="p-2 border-b">Name</th>
                <th className="p-2 border-b text-right">Domains</th>
              </tr>
            </thead>
            <tbody>
              {topDrugs.map(d => {
                const chem = cleanName(d.name);
                const name = d.drugName ?? chem;
                return (
                  <tr key={d.drugbankAcc} className="hover:bg-gray-50">
                    <td className="p-2 border-b font-mono">
                      <a
                        className="text-blue-600 hover:underline"
                        href={`https://go.drugbank.com/drugs/${d.drugbankAcc}`}
                        target="_blank" rel="noreferrer"
                      >
                        {d.drugbankAcc}
                      </a>
                    </td>
                    <td className="p-2 border-b font-mono">
                      {d.ligandPdb ? (
                        <Link className="text-blue-600 hover:underline" href={`/compound/${encodeURIComponent(d.ligandPdb)}`}>
                          {d.ligandPdb}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-2 border-b max-w-md truncate" title={chem ?? undefined}>
                      {name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-2 border-b text-right">{d.nDomains.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Bound compounds */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Most frequently bound compounds</h2>
        {topCompounds.length === 0 ? (
          <p className="text-gray-500 text-sm">No ligand contacts are recorded for this group&apos;s domains.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 border-b">PDB ligand</th>
                <th className="p-2 border-b">Name</th>
                <th className="p-2 border-b text-right">Domains in contact</th>
              </tr>
            </thead>
            <tbody>
              {topCompounds.map(c => {
                const name = cleanName(c.name);
                return (
                  <tr key={c.compId} className="hover:bg-gray-50">
                    <td className="p-2 border-b font-mono">
                      <Link className="text-blue-600 hover:underline" href={`/compound/${encodeURIComponent(c.compId)}`}>
                        {c.compId}
                      </Link>
                      {c.isMetal && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-sans">metal</span>
                      )}
                    </td>
                    <td className="p-2 border-b max-w-md truncate" title={name ?? undefined}>
                      {name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-2 border-b text-right">{c.nDomains.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub} of members</div>}
    </div>
  );
}
