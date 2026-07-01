'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface DrugDomainDrug {
  drugbankAcc: string;
  ligandPdb: string | null;
  name: string | null;
  drugdomainAcc: string;
  drugdomainLink: string;
}

export interface DrugDomainLigand {
  ligandPdb: string;
  name: string | null;
  isBuffer: boolean;
  drugdomainAcc: string;
  drugdomainLink: string;
}

export interface DrugDomainData {
  drugs: DrugDomainDrug[];
  ligands: DrugDomainLigand[];
}

// How many chips to show before the "show more" toggle kicks in.
const INITIAL_VISIBLE = 12;

// A normalized chemical-entity reference. The chip renders the SAME layout and the
// SAME fixed link row for every entity — only which links appear varies with which
// identifiers are present. Labels are labels; every link is named by its destination.
interface EntityRef {
  key: string;              // stable react key (= drugdomainLink)
  name: string | null;      // chemical name (from ligand_compound), if resolved
  drugbankAcc: string | null;
  ligandPdb: string | null;
  drugdomainLink: string;
  isBuffer: boolean;
  accent: 'drug' | 'ligand';
}

function ExternalIcon() {
  return (
    <svg
      className="inline-block w-3 h-3 ml-0.5 -mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-9 9M9 5H5v14h14v-4" />
    </svg>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {children}
      <ExternalIcon />
    </a>
  );
}

function EntityChip({ entity }: { entity: EntityRef }) {
  const muted = entity.isBuffer;
  const tone = muted
    ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
    : entity.accent === 'drug'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
      : 'border-indigo-200 bg-indigo-50 dark:border-indigo-800/60 dark:bg-indigo-900/20';

  return (
    <div className={`flex flex-col gap-1.5 rounded-md border px-3 py-2 ${tone}`}>
      {/* Headline: identifier badge(s) + chemical name. NOT a link — see link row below. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {entity.drugbankAcc && (
          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
            {entity.drugbankAcc}
          </span>
        )}
        {entity.ligandPdb && (
          <span
            className={`font-mono ${entity.drugbankAcc ? 'text-xs' : 'text-sm font-semibold'} ${
              muted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {entity.ligandPdb}
          </span>
        )}
        {muted && (
          <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            buffer
          </span>
        )}
      </div>
      {entity.name && (
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400" title={entity.name}>
          {entity.name}
        </p>
      )}

      {/* Fixed, destination-labeled link row. Same order on every chip; each link is
          rendered only when its identifier exists. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
        {/* 1. DrugDomain — the source of this reference; always present. */}
        <ExtLink href={entity.drugdomainLink}>DrugDomain</ExtLink>
        {/* 2. DrugBank — only for DrugBank-mapped drugs. */}
        {entity.drugbankAcc && (
          <ExtLink href={`https://go.drugbank.com/drugs/${entity.drugbankAcc}`}>DrugBank</ExtLink>
        )}
        {/* 3. RCSB ligand page — only when a PDB chemical component is known. */}
        {entity.ligandPdb && (
          <ExtLink href={`https://www.rcsb.org/ligand/${entity.ligandPdb}`}>RCSB</ExtLink>
        )}
        {/* 4. ECOD compound page (internal) — only when a PDB chemical component is known. */}
        {entity.ligandPdb && (
          <Link
            href={`/compound/${encodeURIComponent(entity.ligandPdb)}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Compound
          </Link>
        )}
      </div>
    </div>
  );
}

function EntitySection({
  title,
  titleClass,
  refs,
  noun,
  bufferCount,
}: {
  title: string;
  titleClass: string;
  refs: EntityRef[];
  noun: string;
  bufferCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? refs : refs.slice(0, INITIAL_VISIBLE);

  return (
    <section>
      <h3 className={`mb-2 text-sm font-medium ${titleClass}`}>
        {title} <span className="font-normal text-gray-400 dark:text-gray-500">({refs.length})</span>
        {bufferCount ? (
          <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
            · {bufferCount} buffer/additive
          </span>
        ) : null}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map(r => (
          <EntityChip key={r.key} entity={r} />
        ))}
      </div>
      {refs.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {expanded ? 'Show fewer' : `Show all ${refs.length} ${noun}`}
        </button>
      )}
    </section>
  );
}

export default function DrugDomainPanel({ data }: { data: DrugDomainData }) {
  const drugRefs: EntityRef[] = data.drugs.map(d => ({
    key: d.drugdomainLink,
    name: d.name,
    drugbankAcc: d.drugbankAcc,
    ligandPdb: d.ligandPdb,
    drugdomainLink: d.drugdomainLink,
    isBuffer: false,
    accent: 'drug',
  }));

  // Ligand-only refs: common crystallization additives (buffers) sort/collapse last.
  const ligandRefs: EntityRef[] = [...data.ligands]
    .sort((a, b) => Number(a.isBuffer) - Number(b.isBuffer))
    .map(l => ({
      key: l.drugdomainLink,
      name: l.name,
      drugbankAcc: null,
      ligandPdb: l.ligandPdb,
      drugdomainLink: l.drugdomainLink,
      isBuffer: l.isBuffer,
      accent: 'ligand',
    }));
  const bufferCount = ligandRefs.filter(l => l.isBuffer).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">DrugDomain</h2>
        <a
          href="https://drugdomain.cs.ucf.edu"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          drugdomain.cs.ucf.edu
        </a>
      </div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Drugs and bound ligands associated with this domain&apos;s UniProt entry, cross-referenced
        from DrugDomain (UCF). This is a protein-level annotation and is distinct from the
        structural-contact ligands of this specific structure. Each entry links to DrugDomain plus
        the source database for whichever identifiers it carries.
      </p>

      <div className="space-y-5">
        {drugRefs.length > 0 && (
          <EntitySection
            title="DrugBank drugs"
            titleClass="text-amber-800 dark:text-amber-300"
            refs={drugRefs}
            noun="drugs"
          />
        )}
        {ligandRefs.length > 0 && (
          <EntitySection
            title="Bound ligands"
            titleClass="text-indigo-800 dark:text-indigo-300"
            refs={ligandRefs}
            noun="ligands"
            bufferCount={bufferCount}
          />
        )}
      </div>
    </div>
  );
}
