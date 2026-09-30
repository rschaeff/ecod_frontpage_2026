// Ligands bound by a domain, for the domain page's sidebar.
//
// One compact list: ECOD's own ligand contacts (within 4 A), with names, and
// DrugBank drugs and DrugDomain records from DrugDomain. It replaces the header's
// ligand-code line and the full-width DrugDomain panel, which listed the same few
// ligands twice. Buffers and crystallization additives fold into one line.

import Link from 'next/link';
import { readableChemName } from '@/lib/chem-names';

export interface LigandPanelItem {
  compId: string | null;
  name: string | null;
  isBuffer: boolean;
  isMetal: boolean;
  inContact: boolean;       // ECOD contact within 4 A; false = DrugDomain (5 A) only
  drugbankAcc: string | null;
  drugName: string | null;
  drugdomainLink: string | null;
}

function ExternalIcon() {
  return (
    <svg className="inline-block w-3 h-3 -mt-0.5" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-9 9M9 5H5v14h14v-4" />
    </svg>
  );
}

function Pill({ tone, children }: { tone: 'drug' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'drug'
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return <span className={`rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${cls}`}>{children}</span>;
}

function displayName(item: LigandPanelItem): string {
  return item.drugName ?? readableChemName(item.name) ?? item.compId ?? item.drugbankAcc ?? '—';
}

function Row({ item }: { item: LigandPanelItem }) {
  const chem = readableChemName(item.name);
  const title = displayName(item);
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100"
              title={chem && chem !== title ? `${title} (${chem})` : title}>
          {title}
        </span>
        <span className="flex shrink-0 items-baseline gap-2 text-xs">
          {item.compId && (
            <Link href={`/compound/${encodeURIComponent(item.compId)}`}
                  className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                  title={`ECOD compound page for ${item.compId}`}>
              {item.compId}
            </Link>
          )}
          {item.drugdomainLink && (
            <a href={item.drugdomainLink} target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
               title="DrugDomain record" aria-label={`DrugDomain record for ${title}`}>
              <ExternalIcon />
            </a>
          )}
        </span>
      </div>
      {(item.drugbankAcc || item.isMetal || !item.inContact) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          {item.drugbankAcc && !item.isBuffer && <Pill tone="drug">drug</Pill>}
          {item.drugbankAcc && (
            <a href={`https://go.drugbank.com/drugs/${item.drugbankAcc}`} target="_blank"
               rel="noopener noreferrer" className="hover:underline">
              DrugBank {item.drugbankAcc}
            </a>
          )}
          {item.isMetal && <Pill tone="muted">metal</Pill>}
          {!item.inContact && (
            <span title="Listed by DrugDomain (within 5 Å) but outside ECOD's 4 Å contact cutoff">
              within 5 Å only
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default function LigandsCard({ items }: { items: LigandPanelItem[] }) {
  const main = items.filter(i => !i.isBuffer);
  const additives = items.filter(i => i.isBuffer);
  const hasDrugDomain = items.some(i => i.drugdomainLink);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-900 dark:border-gray-700">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ligands</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">in contact, ≤ 4 Å</span>
      </div>

      {main.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {main.map(i => <Row key={`${i.compId}-${i.drugbankAcc}`} item={i} />)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Only buffers and crystallization additives.</p>
      )}

      {additives.length > 0 && (
        <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer select-none hover:text-gray-700">
            + {additives.length} {additives.length === 1 ? 'additive' : 'additives'}
            {' '}({additives.slice(0, 3).map(displayName).join(', ')}
            {additives.length > 3 ? ', …' : ''})
          </summary>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {additives.map(i => <Row key={`${i.compId}-${i.drugbankAcc}`} item={i} />)}
          </ul>
        </details>
      )}

      <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        Shown in the structure viewer.
        {hasDrugDomain && (
          <> Drug annotations from{' '}
            <a href="https://drugdomain.cs.ucf.edu" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline dark:text-blue-400">DrugDomain</a>.
          </>
        )}
      </p>
    </div>
  );
}
