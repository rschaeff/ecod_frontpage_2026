// Chemical profile of an X-group's ligand binding, for /group/[id].
// Data: src/lib/chemical-profiles.ts (built by scripts/build_chemical_profiles.py).
//
// Encoding follows the paper's Figures 4-5: diversity at equal sampling depth
// (superclasses per 20 proteins), and per-superclass enrichment as observed /
// expected on a log scale, red above 1 and blue below 1 when significant
// (Benjamini-Hochberg q < 0.05), neutral otherwise. Every value is also printed,
// so colour never carries a number on its own.

import Link from 'next/link';

export interface ChemicalProfileData {
  xGroupId: string;
  inherited: boolean;
  name: string | null;
  proteins: number;
  superclasses: number;
  per20: number | null;
  per20Percentile: number | null;
  enrichment: {
    superclass: string;
    observed: number;
    expected: number;
    ratio: number | null;
    q: number | null;
    tested: boolean;
  }[];
  meta: {
    release: string;
    rarefiedXGroups: number;
    k: number;
    minExpected: number;
    per20Median: number | null;
  };
}

const ENRICHED = '#e34948';   // validated diverging poles (dataviz reference palette)
const DEPLETED = '#2a78d6';
const NEUTRAL = '#b9c3cc';
const UNTESTED = '#e1e0d9';
const SIG = 0.05;
const LOG2_MAX = 2;           // bars span 0.25x .. 4x

function fmtRatio(r: number | null): string {
  if (r === null) return '—';
  if (r === 0) return '0';
  return r >= 10 ? `${r.toFixed(0)}×` : `${r.toFixed(2)}×`;
}

function fmtQ(row: ChemicalProfileData['enrichment'][number]): string {
  if (!row.tested || row.q === null) return 'not tested';
  if (row.q < 1e-4) return 'q < 0.0001';
  return `q = ${row.q < 0.01 ? row.q.toExponential(1) : row.q.toFixed(2)}`;
}

function breadthPhrase(p: number | null, n: number): string {
  if (p === null) return '';
  if (p >= 50) return `broader than ${Math.round(p)}% of the ${n.toLocaleString()} X-groups with enough proteins to compare`;
  return `narrower than ${Math.round(100 - p)}% of the ${n.toLocaleString()} X-groups with enough proteins to compare`;
}

function Bar({ row }: { row: ChemicalProfileData['enrichment'][number] }) {
  const r = row.ratio;
  const sig = row.tested && row.q !== null && row.q < SIG;
  const colour = !row.tested ? UNTESTED : !sig ? NEUTRAL : (r ?? 0) >= 1 ? ENRICHED : DEPLETED;
  const l = r && r > 0 ? Math.max(-LOG2_MAX, Math.min(LOG2_MAX, Math.log2(r))) : -LOG2_MAX;
  const half = 50 * Math.abs(l) / LOG2_MAX;          // % of the track
  const left = l >= 0 ? 50 : 50 - half;
  return (
    <div className="relative h-3 w-full" aria-hidden>
      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-400" />
      <div
        className="absolute inset-y-0 rounded-sm"
        style={{ left: `${left}%`, width: `${Math.max(half, 0.8)}%`, background: colour }}
      />
    </div>
  );
}

export default function ChemicalProfile({ data, groupId }: { data: ChemicalProfileData; groupId: string }) {
  const { meta } = data;

  if (data.inherited) {
    return (
      <section>
        <h2 className="text-xl font-semibold mb-2">Chemical profile</h2>
        <p className="text-sm text-gray-700">
          Chemical profiles are computed for X-groups. {groupId} belongs to X-group{' '}
          <Link className="text-blue-600 hover:underline" href={`/group/${data.xGroupId}`}>
            {data.xGroupId} {data.name}
          </Link>
          {data.per20 !== null ? (
            <>, which binds {data.per20.toFixed(1)} ligand superclasses per {meta.k} proteins,{' '}
              {breadthPhrase(data.per20Percentile, meta.rarefiedXGroups)}.</>
          ) : (
            <>, which has {data.proteins.toLocaleString()} proteins with classified ligands.</>
          )}{' '}
          <Link className="text-blue-600 hover:underline" href={`/group/${data.xGroupId}`}>
            View its chemical profile →
          </Link>
        </p>
      </section>
    );
  }

  const rows = [...data.enrichment].sort((a, b) => {
    if (a.tested !== b.tested) return a.tested ? -1 : 1;
    return (b.ratio ?? 0) - (a.ratio ?? 0);
  });

  return (
    <section>
      <h2 className="text-xl font-semibold mb-1">Chemical profile</h2>
      <p className="text-sm text-gray-500 mb-3">
        ClassyFire chemical superclasses of the ligands bound by this X-group&apos;s proteins, from DrugDomain annotations.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Proteins with classified ligands" value={data.proteins.toLocaleString()} />
        <Card label="Superclasses bound (of 23)" value={String(data.superclasses)} />
        <Card
          label={`Superclasses per ${meta.k} proteins`}
          value={data.per20 !== null ? data.per20.toFixed(1) : '—'}
          sub={data.per20 !== null
            ? `${breadthPhrase(data.per20Percentile, meta.rarefiedXGroups)} (median ${meta.per20Median?.toFixed(1)})`
            : `fewer than ${meta.k} proteins: too few to compare at equal depth`}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        The raw number of superclasses rises with the number of proteins sampled; the per-{meta.k} value compares
        X-groups at equal depth.
      </p>

      <table className="w-full text-sm border mt-4">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-2 border-b">Superclass</th>
            <th className="p-2 border-b text-right">Proteins</th>
            <th className="p-2 border-b text-right">Expected</th>
            <th className="p-2 border-b w-1/4">
              <div className="flex justify-between text-xs font-normal text-gray-500">
                <span>0.25×</span><span>observed / expected</span><span>4×</span>
              </div>
            </th>
            <th className="p-2 border-b text-right">Ratio</th>
            <th className="p-2 border-b text-right">Significance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.superclass}
              className="hover:bg-gray-50"
              title={`${r.superclass}: ${r.observed} proteins observed, ${r.expected} expected (${fmtRatio(r.ratio)}); ${fmtQ(r)}`}
            >
              <td className="p-2 border-b">{r.superclass}</td>
              <td className="p-2 border-b text-right tabular-nums">{r.observed.toLocaleString()}</td>
              <td className="p-2 border-b text-right tabular-nums text-gray-500">{r.expected.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
              <td className="p-2 border-b"><Bar row={r} /></td>
              <td className="p-2 border-b text-right tabular-nums">{fmtRatio(r.ratio)}</td>
              <td className="p-2 border-b text-right text-xs text-gray-500 whitespace-nowrap">{fmtQ(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-2">
        <LegendSwatch colour={ENRICHED} label="enriched (q < 0.05)" />
        <LegendSwatch colour={DEPLETED} label="depleted (q < 0.05)" />
        <LegendSwatch colour={NEUTRAL} label="not significant" />
        <LegendSwatch colour={UNTESTED} label={`not tested (expected < ${meta.minExpected})`} />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Unit: a protein (UniProt accession) with a ligand-binding domain in this X-group, counted once per superclass.
        Expected counts use each superclass&apos;s frequency across all ligand-binding X-groups; significance is
        Fisher&apos;s exact test with Benjamini–Hochberg correction. Buffers and crystallization additives are excluded.
        ECOD {meta.release}; the method follows the ECOD 2027 update, whose published figures used a slightly different
        artifact filter.
      </p>
    </section>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function LegendSwatch({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
      {label}
    </span>
  );
}
