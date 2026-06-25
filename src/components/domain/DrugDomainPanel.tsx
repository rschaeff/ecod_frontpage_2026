'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface DrugDomainDrug {
  drugbankAcc: string;
  ligandPdb: string | null;
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

function DrugChip({ drug }: { drug: DrugDomainDrug }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-900/20">
      <a
        href={drug.drugdomainLink}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm font-semibold text-amber-900 hover:underline dark:text-amber-200"
        title="View on DrugDomain (UCF)"
      >
        {drug.drugbankAcc}
        <ExternalIcon />
      </a>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <a
          href={`https://go.drugbank.com/drugs/${drug.drugbankAcc}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          DrugBank
        </a>
        {drug.ligandPdb && (
          <span className="text-gray-500 dark:text-gray-400">
            ligand{' '}
            <Link
              href={`/compound/${encodeURIComponent(drug.ligandPdb)}`}
              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
            >
              {drug.ligandPdb}
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}

function LigandChip({ ligand }: { ligand: DrugDomainLigand }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border px-3 py-2 ${
        ligand.isBuffer
          ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
          : 'border-indigo-200 bg-indigo-50 dark:border-indigo-800/60 dark:bg-indigo-900/20'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Link
          href={`/compound/${encodeURIComponent(ligand.ligandPdb)}`}
          className={`font-mono text-sm font-semibold hover:underline ${
            ligand.isBuffer
              ? 'text-gray-600 dark:text-gray-300'
              : 'text-indigo-900 dark:text-indigo-200'
          }`}
        >
          {ligand.ligandPdb}
        </Link>
        {ligand.isBuffer && (
          <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            buffer
          </span>
        )}
      </div>
      {ligand.name && (
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400" title={ligand.name}>
          {ligand.name}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <a
          href={ligand.drugdomainLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          DrugDomain
          <ExternalIcon />
        </a>
        <a
          href={`https://www.rcsb.org/ligand/${ligand.ligandPdb}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          RCSB
        </a>
      </div>
    </div>
  );
}

export default function DrugDomainPanel({ data }: { data: DrugDomainData }) {
  const { drugs } = data;

  // Split ligands so common crystallization additives (buffers) sort/collapse last.
  const ligands = [...data.ligands].sort((a, b) => Number(a.isBuffer) - Number(b.isBuffer));

  const [drugsExpanded, setDrugsExpanded] = useState(false);
  const [ligandsExpanded, setLigandsExpanded] = useState(false);

  const visibleDrugs = drugsExpanded ? drugs : drugs.slice(0, INITIAL_VISIBLE);
  const visibleLigands = ligandsExpanded ? ligands : ligands.slice(0, INITIAL_VISIBLE);
  const bufferCount = ligands.filter(l => l.isBuffer).length;

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
        structural-contact ligands of this specific structure.
      </p>

      {drugs.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            DrugBank drugs{' '}
            <span className="font-normal text-gray-400 dark:text-gray-500">({drugs.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleDrugs.map(d => (
              <DrugChip key={d.drugdomainLink} drug={d} />
            ))}
          </div>
          {drugs.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setDrugsExpanded(v => !v)}
              className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {drugsExpanded ? 'Show fewer' : `Show all ${drugs.length} drugs`}
            </button>
          )}
        </section>
      )}

      {ligands.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-indigo-800 dark:text-indigo-300">
            Bound ligands{' '}
            <span className="font-normal text-gray-400 dark:text-gray-500">({ligands.length})</span>
            {bufferCount > 0 && (
              <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
                · {bufferCount} buffer/additive
              </span>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleLigands.map(l => (
              <LigandChip key={l.ligandPdb} ligand={l} />
            ))}
          </div>
          {ligands.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setLigandsExpanded(v => !v)}
              className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {ligandsExpanded ? 'Show fewer' : `Show all ${ligands.length} ligands`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
