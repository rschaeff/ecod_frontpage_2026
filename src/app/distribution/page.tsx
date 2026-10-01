'use client';

import { useEffect, useState } from 'react';
import { basePath } from '@/lib/config';

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  url: string;
  modified: string;
  description?: string;
}

interface VersionFiles {
  main: FileInfo[];
  f40: FileInfo[];
  f70: FileInfo[];
  f99: FileInfo[];
  blast: FileInfo[];
  chainwise: FileInfo[];
  foldseek: FileInfo[];
  hhsuite: FileInfo[];
  other: FileInfo[];
}

interface VersionInfo {
  version: string;
  date: string;
  releaseNotes?: string;
  archiveDoi?: string;
  carriedFrom?: Partial<Record<keyof VersionFiles, string>>;
  files: VersionFiles;
}

// Columns of ecod.<release>.domains.txt (v293 onward), in file order.
const DOMAIN_COLUMNS: [string, string][] = [
  ['uid', 'Numeric domain identifier'],
  ['ecod_domain_id', 'Domain identifier: e<PDB><chain><n> for experimental structures (e.g. e1iepA1); <accession>_F1_nD<n> for AlphaFold Database models; EPP or UniParc accession with _nD<n> for structures predicted by ECOD'],
  ['manual_rep', 'True for curated representative domains, False for domains classified automatically'],
  ['f_id', 'Position in the hierarchy as X.H.T.F (e.g. 206.1.1.20); an F-group of 0 means the domain is classified only to the topology level'],
  ['pdb, chain', 'PDB identifier and chain (case-sensitive); empty for predicted structures'],
  ['pdb_range', 'Residue range in author (PDB) numbering, chain:start-end, with comma-separated segments for discontinuous domains; residue positions for predicted structures'],
  ['seqid_range', 'The same range in sequential residue numbering of the chain'],
  ['architecture_name', 'Architecture'],
  ['x_name, h_name, t_name, f_name', 'Names of the X-, H-, T- and F-groups'],
  ['assembly_id, domain_id_short', 'Not populated in current releases (empty)'],
  ['range_count', 'Number of segments in the domain range'],
  ['arch_manual, x_manual, h_manual, t_manual', 'Not used in current releases (always False)'],
  ['f_manual', 'Same as manual_rep'],
  ['valid_structure', 'Not used in current releases (always True)'],
  ['ligand_binding', 'True if any non-polymer entity lies within 4 Å of the domain'],
  ['ligand_comp_ids', 'PDB chemical component identifiers of the contacting ligands, comma-separated (e.g. ROC,SO4), or NO_LIGANDS_4A'],
  ['ligand_pdbnum', 'Chain and residue number of every contacting ligand copy, comma-separated (e.g. A:601,A:602,B:401); a ligand may lie on another chain'],
];

// FASTA definition lines, which differ between the sequence files.
const FASTA_HEADERS: [string, string, string][] = [
  ['<release>.fa', '>e2nmzA1 uid:0 range:A:1-99 assignment:1.1.1.3', 'Domain identifier, then uid, range and f_id'],
  ['<release>.F40.fa (F70, F99)', '>1|e1hvcA1|1.1.1.3', 'uid, domain identifier and f_id, separated by |'],
  ['<release>.chainwise.fa', '>101m A', 'PDB identifier and chain'],
];

// Every bucket, in the order the previous-release lists show them.
const ALL_BUCKETS: (keyof VersionFiles)[] = [
  'main', 'f40', 'f70', 'f99', 'blast', 'chainwise', 'foldseek', 'hhsuite', 'other',
];

// Order of the classification files in the main card.
const MAIN_ORDER = ['.domains.txt', '.hierarchy.txt', '.names.txt', '.f_id_pfam_acc.txt',
  '.chainwise.fa', '.fa', '.md5'];
const mainRank = (name: string) => {
  const i = MAIN_ORDER.findIndex(s => name.endsWith(s));
  return i < 0 ? MAIN_ORDER.length : i;
};

interface VersionSummary {
  version: string;
  date: string;
  fileCount: number;
  totalBytes: number;
  totalFormatted: string;
  naming: 'develop' | 'v';
}

interface DistributionData {
  currentVersion: VersionInfo | null;
  previousVersions: VersionSummary[];
  archive: {
    releaseCount: number;
    first: string | null;
    last: string | null;
    namingNote: string;
    indexUrl: string;
  } | null;
}

export default function DistributionPage() {
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Older releases are listed from the summary and their file lists fetched on
  // demand -- there are well over 200 of them, so shipping every file list up
  // front would cost far more than anyone needs to read.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, VersionInfo>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const toggleVersion = (version: string) => {
    if (expanded === version) {
      setExpanded(null);
      return;
    }
    setExpanded(version);
    if (detail[version]) return;
    setDetailLoading(version);
    fetch(`${basePath}/api/distributions?version=${encodeURIComponent(version)}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((info: VersionInfo) => setDetail(prev => ({ ...prev, [version]: info })))
      .catch(() => { /* row stays collapsed-empty; the direct links still work */ })
      .finally(() => setDetailLoading(null));
  };

  useEffect(() => {
    fetch(`${basePath}/api/distributions`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load distribution data');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error Loading Data</h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const currentVersion = data?.currentVersion;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Download ECOD Data</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Download the complete ECOD classification data in various formats.
        All files are hosted at{' '}
        <a
          href="http://prodata.swmed.edu/ecod/distributions/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          prodata.swmed.edu
        </a>
        .
      </p>

      {/* Current Version */}
      {currentVersion && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Current Version: ECOD {currentVersion.version}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Released {currentVersion.date}
                {currentVersion.archiveDoi && (
                  <>
                    {' · '}Archived on Zenodo:{' '}
                    <a
                      href={`https://doi.org/${currentVersion.archiveDoi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      doi:{currentVersion.archiveDoi}
                    </a>
                  </>
                )}
              </p>
            </div>
            {currentVersion.releaseNotes && (
              <button
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showReleaseNotes ? 'Hide' : 'Show'} Release Notes
              </button>
            )}
          </div>

          {/* Release Notes */}
          {showReleaseNotes && currentVersion.releaseNotes && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                {currentVersion.releaseNotes}
              </pre>
            </div>
          )}

          {/* Main Dataset */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Classification and sequences</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Every classified domain: the domain table, the hierarchy and its names, the family-to-Pfam
                mapping, and domain and chain sequences
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[...currentVersion.files.main]
                .sort((a, b) => mainRank(a.name) - mainRank(b.name))
                .map(file => (
                <FileRow key={file.name} file={file} />
              ))}
            </div>
          </div>

          {/* Clustering Representatives */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <ClusteringCard
              title="F40 Representatives"
              description="One domain per family cluster at 40% sequence identity"
              files={currentVersion.files.f40}
            />
            <ClusteringCard
              title="F70 Representatives"
              description="One domain per family cluster at 70% sequence identity"
              files={currentVersion.files.f70}
            />
            <ClusteringCard
              title="F99 Representatives"
              description="One domain per family cluster at 99% sequence identity"
              files={currentVersion.files.f99}
            />
          </div>

          <SearchDatabases version={currentVersion} />
        </section>
      )}

      {/* File Format Documentation */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">File Format</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            The domain tables (<span className="font-mono text-xs">domains.txt</span>, and the F40, F70 and F99
            versions) are tab-separated, one row per domain, after a few header lines beginning with{' '}
            <span className="font-mono text-xs">#</span> that give the release and the ligand contact cutoff.
            This layout is used from v293 onward; earlier releases used a shorter layout described in their own
            header lines.
          </p>
          {/* A definition list rather than a table, so that on a phone each column name
              stacks above its description instead of squeezing it. */}
          <dl className="text-sm divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-600">
            {DOMAIN_COLUMNS.map(([col, desc]) => (
              <div key={col} className="py-2 sm:grid sm:grid-cols-[16rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs text-gray-700 dark:text-gray-300 break-words">{col}</dt>
                <dd className="mt-1 sm:mt-0 text-gray-600 dark:text-gray-400">{desc}</dd>
              </div>
            ))}
          </dl>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-6 mb-2">
            Sequence files are FASTA; their definition lines differ by file:
          </p>
          <dl className="text-sm divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-600">
            {FASTA_HEADERS.map(([file, example, desc]) => (
              <div key={file} className="py-2 sm:grid sm:grid-cols-[16rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs text-gray-700 dark:text-gray-300 break-words">{file}</dt>
                <dd className="mt-1 sm:mt-0 text-gray-600 dark:text-gray-400">
                  <span className="block font-mono text-xs break-all">{example}</span>
                  <span className="block mt-0.5">{desc}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Previous releases */}
      {data?.previousVersions && data.previousVersions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Previous releases
          </h2>
          {data.archive && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {data.archive.releaseCount} releases archived
              {data.archive.first && data.archive.last && (
                <> from {data.archive.first.slice(0, 4)} to {data.archive.last.slice(0, 4)}</>
              )}
              . Select a release to list its files.
            </p>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(showAll ? data.previousVersions : data.previousVersions.slice(0, 10)).map(version => {
                const isOpen = expanded === version.version;
                const info = detail[version.version];
                return (
                  <div key={version.version}>
                    <button
                      type="button"
                      onClick={() => toggleVersion(version.version)}
                      aria-expanded={isOpen}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          ECOD {version.version}
                        </span>
                        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                          {version.date}
                        </span>
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {version.fileCount} files · {version.totalFormatted}
                        <span className="ml-3 inline-block w-3 text-gray-400">
                          {isOpen ? '−' : '+'}
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-4 bg-gray-50 dark:bg-gray-900/40">
                        {detailLoading === version.version && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading…</p>
                        )}
                        {info && (
                          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {ALL_BUCKETS.flatMap(k => info.files[k] ?? [])
                              .map(file => (
                                <li key={file.name} className="py-2 flex items-center justify-between gap-4">
                                  <a
                                    href={file.url}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                                  >
                                    {file.name}
                                  </a>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {file.sizeFormatted}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                        {!info && detailLoading !== version.version && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                            File list unavailable for this release.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg space-y-2">
              {data.previousVersions.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAll
                    ? 'Show fewer releases'
                    : `Show all ${data.previousVersions.length} previous releases`}
                </button>
              )}
              {data.archive && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.archive.namingNote}{' '}
                  <a
                    href={data.archive.indexUrl}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Machine-readable index
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Citation */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Citation</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            If you use ECOD data in your research, please cite:
          </p>
          <blockquote className="text-sm text-gray-600 dark:text-gray-400 border-l-4 border-blue-300 dark:border-blue-600 pl-4 italic mb-4">
            Schaeffer RD, Medvedev KE, Andreeva A, Chuguransky SR, Pinto BL, Zhang J, Cong Q, Bateman A, Grishin NV. (2025)
            ECOD: integrating classifications of protein domains from experimental and predicted structures.
            <em>Nucleic Acids Research</em>, gkae1029.
          </blockquote>
          <a
            href="https://doi.org/10.1093/nar/gkae1029"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            doi:10.1093/nar/gkae1029 →
          </a>
          <blockquote className="text-sm text-gray-600 dark:text-gray-400 border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic">
            Cheng H, Schaeffer RD, Liao Y, Kinch LN, Pei J, Shi S, Kim BH, Grishin NV. (2014)
            ECOD: An evolutionary classification of protein domains.
            <em>PLoS Comput Biol</em> 10(12): e1003926.
          </blockquote>
          <a
            href="https://doi.org/10.1371/journal.pcbi.1003926"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            doi:10.1371/journal.pcbi.1003926 →
          </a>
        </div>
      </section>
    </div>
  );
}

function FileRow({ file }: { file: FileInfo }) {
  // Get a friendly description based on file extension
  const getDescription = (filename: string): string => {
    if (filename.endsWith('.domains.txt')) return 'Domain definitions';
    if (filename.endsWith('.names.txt')) return 'Domain names index';
    if (filename.endsWith('.fa') || filename.endsWith('.fasta')) return 'FASTA sequences';
    if (filename.endsWith('.hierarchy.txt')) return 'Classification hierarchy';
    if (filename.endsWith('.md5')) return 'MD5 checksums';
    if (filename.endsWith('.f_id_pfam_acc.txt')) return 'F-group to Pfam mapping';
    if (filename.endsWith('.pdb.tar.gz')) return 'PDB structure files';
    if (filename.includes('partial')) return 'Partial domain assignments';
    if (filename.includes('simple_topology')) return 'Simple topology domains';
    if (filename.includes('low_confidence')) return 'Low confidence domains';
    if (filename.includes('no_domains')) return 'Proteins without domain assignments';
    if (filename.includes('unassigned')) return 'Unassigned domain analysis';
    if (filename.includes('no_pfam')) return 'T-groups without Pfam coverage';
    return '';
  };

  const description = file.description || getDescription(file.name);

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <FileIcon filename={file.name} />
        <div>
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{file.name}</div>
          {description && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-400 dark:text-gray-500">{file.sizeFormatted}</div>
    </a>
  );
}

function FileIcon({ filename }: { filename: string }) {
  // Different colors for different file types
  let color = 'text-gray-400';
  if (filename.endsWith('.txt') || filename.endsWith('.csv')) color = 'text-blue-500';
  if (filename.endsWith('.fa') || filename.endsWith('.fasta')) color = 'text-green-500';
  if (filename.endsWith('.tar.gz') || filename.endsWith('.gz')) color = 'text-orange-500';
  if (filename.endsWith('.md5')) color = 'text-purple-500';
  if (filename.endsWith('.md')) color = 'text-gray-500';

  return (
    <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClusteringCard({
  title,
  description,
  files,
}: {
  title: string;
  description: string;
  files: FileInfo[];
}) {
  if (files.length === 0) return null;

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="p-3 space-y-1">
        {[...files]
          .sort((a, b) => repRank(a.name) - repRank(b.name))
          .map(file => (
            <a
              key={file.name}
              href={file.url}
              title={file.name}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
            >
              <span className="text-xs text-gray-700 dark:text-gray-300">{repLabel(file.name)}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{file.sizeFormatted}</span>
            </a>
          ))}
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Total: {formatSize(totalSize)}
        </span>
      </div>
    </div>
  );
}

// Members of a representative set, labelled by what they are rather than by
// extension (the coordinate archive and the old Foldseek archive were both "gz").
const REP_MEMBERS: [string, string][] = [
  ['.domains.txt', 'Domain table'],
  ['.fa', 'Sequences (FASTA)'],
  ['.names.txt', 'Group names'],
  ['.pdb.tar.gz', 'Coordinates (PDB archive)'],
  ['.pdb.missing.tsv', 'Domains without coordinates'],
  ['.pdb.empty.tsv', 'Empty coordinate files'],
];
const repRank = (name: string) => {
  const i = REP_MEMBERS.findIndex(([s]) => name.endsWith(s));
  return i < 0 ? REP_MEMBERS.length : i;
};
const repLabel = (name: string) => REP_MEMBERS.find(([s]) => name.endsWith(s))?.[1] ?? name;

// ecod.v295.F40.hhm_db.tar.gz unpacks (flat) to ecod_v295_F40_{a3m,hhm,cs219}.ff{data,index}.
const HH_COMMAND = (archive: string) => {
  const m = archive.match(/^ecod\.(.+)\.(F\d+)\.hhm_db\.tar\.gz$/);
  if (!m) return '';
  const prefix = `ecod_${m[1]}_${m[2]}`;
  return `tar xzf ${archive}
hhblits -i query.fa -d <UniRef30 database> -oa3m query.a3m -n 2
hhsearch -i query.a3m -d ${prefix} -o hits.hhr`;
};

function Command({ children }: { children: string }) {
  return (
    <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
      {children}
    </pre>
  );
}

function FileChips({ files }: { files: FileInfo[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map(file => (
        <a
          key={file.name}
          href={file.url}
          className="inline-flex items-center px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 transition-colors"
        >
          <span className="font-mono">{file.name}</span>
          <span className="ml-2 text-gray-400 dark:text-gray-500">{file.sizeFormatted}</span>
        </a>
      ))}
    </div>
  );
}

function ArchiveLink({ file }: { file: FileInfo }) {
  return (
    <a
      href={file.url}
      className="mt-2 inline-flex items-center gap-3 px-3 py-2 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
    >
      <span className="font-mono text-sm text-blue-700 dark:text-blue-300 break-all">{file.name}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{file.sizeFormatted}</span>
    </a>
  );
}

// The three databases behind the site's searches, each with what it is, which
// search uses it, and how to run the same search locally.
function SearchDatabases({ version }: { version: VersionInfo }) {
  const [showUnpacked, setShowUnpacked] = useState(false);
  const [showBlastUnpacked, setShowBlastUnpacked] = useState(false);
  const { blast, chainwise, foldseek, hhsuite } = version.files;
  if (!blast.length && !chainwise.length && !foldseek.length && !hhsuite.length) return null;

  const v = version.version;
  const isArchive = (f: FileInfo) => f.name.endsWith('.tar.gz');
  const blastArchive = blast.filter(isArchive);
  const chainArchive = chainwise.filter(isArchive);
  const blastUnpacked = [...blast, ...chainwise].filter(f => !isArchive(f));
  const foldseekArchive = foldseek.filter(f => f.name.endsWith('.tar.gz'));
  const foldseekUnpacked = foldseek.filter(f => !f.name.endsWith('.tar.gz'));
  const hhArchive = hhsuite.filter(f => f.name.endsWith('.tar.gz'));
  const hhOther = hhsuite.filter(f => !f.name.endsWith('.tar.gz'));
  const hhFrom = version.carriedFrom?.hhsuite;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Search databases</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The databases behind the site&apos;s sequence and structure searches, so that either search can be
          run locally against exactly the data the website queries
        </p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {(blast.length > 0 || chainwise.length > 0) && (
          <div className="px-6 py-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">BLAST</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Protein BLAST databases of all domain sequences (the database sequence search runs against) and
              of all protein chain sequences. Each archive unpacks to its own directory with a README.
            </p>
            {[...blastArchive, ...chainArchive].map(f => <ArchiveLink key={f.name} file={f} />)}
            {blastArchive.length > 0 && (
              <Command>{`tar xzf ${blastArchive[0].name}
blastp -query query.fa -db ecod_${v}_blast/ecod.${v}.blast -evalue 0.01 -outfmt 6`}</Command>
            )}
            {blastUnpacked.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowBlastUnpacked(s => !s)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showBlastUnpacked ? 'Hide' : 'Show'} the same databases as {blastUnpacked.length} unpacked files
                </button>
                {showBlastUnpacked && <FileChips files={blastUnpacked} />}
              </div>
            )}
          </div>
        )}

        {foldseek.length > 0 && (
          <div className="px-6 py-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Foldseek</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Foldseek database of the F40 representative domains with usable coordinates (used by structure
              search). The archive also contains a README and the list of representatives left out.
            </p>
            {foldseekArchive.map(f => <ArchiveLink key={f.name} file={f} />)}
            {foldseekArchive.length > 0 && (
              <Command>{`tar xzf ${foldseekArchive[0].name}
foldseek easy-search query.pdb ecod_${v}_F40_foldseek/ecod.${v}.foldseek hits.m8 tmp`}</Command>
            )}
            {foldseekUnpacked.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowUnpacked(s => !s)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showUnpacked ? 'Hide' : 'Show'} the same database as {foldseekUnpacked.length} unpacked files
                </button>
                {showUnpacked && <FileChips files={foldseekUnpacked} />}
              </div>
            )}
          </div>
        )}

        {hhsuite.length > 0 && (
          <div className="px-6 py-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">HH-suite</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              HH-suite profile database of the F40 representative domains, as used by the classification
              pipeline for remote homology search.
              {hhFrom && <> Built for {hhFrom}; no profile database was built for {v}.</>}
            </p>
            {hhArchive.map(f => <ArchiveLink key={f.name} file={f} />)}
            {hhOther.length > 0 && <FileChips files={hhOther} />}
            {hhArchive.length > 0 && HH_COMMAND(hhArchive[0].name) && (
              <Command>{HH_COMMAND(hhArchive[0].name)}</Command>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
