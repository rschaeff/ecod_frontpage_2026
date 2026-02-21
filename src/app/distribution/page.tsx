'use client';

import { useEffect, useState } from 'react';
import { basePath } from '@/lib/config';

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  url: string;
  modified: string;
}

interface VersionInfo {
  version: string;
  date: string;
  releaseNotes?: string;
  files: {
    main: FileInfo[];
    f40: FileInfo[];
    f70: FileInfo[];
    f99: FileInfo[];
    blast: FileInfo[];
    other: FileInfo[];
  };
}

interface DistributionData {
  currentVersion: VersionInfo | null;
  previousVersions: { version: string; date: string }[];
  specialDatasets: {
    marginalDomains: FileInfo[];
    other: FileInfo[];
  };
}

export default function DistributionPage() {
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

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
              <p className="text-sm text-gray-500 dark:text-gray-400">Released {currentVersion.date}</p>
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Complete Dataset</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Full ECOD classification with all domains</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {currentVersion.files.main.map(file => (
                <FileRow key={file.name} file={file} />
              ))}
            </div>
          </div>

          {/* Clustering Representatives */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <ClusteringCard
              title="F40 Representatives"
              description="40% sequence identity clustering"
              files={currentVersion.files.f40}
            />
            <ClusteringCard
              title="F70 Representatives"
              description="70% sequence identity clustering"
              files={currentVersion.files.f70}
            />
            <ClusteringCard
              title="F99 Representatives"
              description="99% sequence identity clustering"
              files={currentVersion.files.f99}
            />
          </div>

          {/* BLAST Database */}
          {currentVersion.files.blast.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">BLAST Database</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pre-formatted database for sequence searches</p>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {currentVersion.files.blast.map(file => (
                    <a
                      key={file.name}
                      href={file.url}
                      className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      <span className="font-mono text-xs">{file.name.split('.').pop()}</span>
                      <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">{file.sizeFormatted}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* File Format Documentation */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">File Format</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Domain files are tab-separated with the following columns:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">Column</th>
                  <th className="text-left py-2 font-medium text-gray-900 dark:text-gray-100">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">uid</td>
                  <td className="py-2">Internal unique identifier</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">ecod_domain_id</td>
                  <td className="py-2">ECOD domain identifier (e.g., e1abcA1)</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">manual_rep</td>
                  <td className="py-2">Representative status (manual/automated)</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">f_id</td>
                  <td className="py-2">Hierarchy identifier (X.H.T.F format)</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">pdb, chain</td>
                  <td className="py-2">PDB identifier and chain</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">pdb_range, seqid_range</td>
                  <td className="py-2">Residue ranges (PDB and internal numbering)</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">architecture_name</td>
                  <td className="py-2">Architecture level name</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">x_name, h_name, t_name, f_name</td>
                  <td className="py-2">Classification hierarchy names</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-4 font-mono text-xs">assembly_id</td>
                  <td className="py-2">Domain assembly partners (if applicable)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">ligand_binding</td>
                  <td className="py-2">Non-polymer entities within 4Å of domain</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Special Datasets */}
      {data?.specialDatasets && (data.specialDatasets.marginalDomains.length > 0 || data.specialDatasets.other.length > 0) && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Special Datasets</h2>

          {data.specialDatasets.marginalDomains.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Marginal Domains</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  AlphaFold domains with special classification status
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.specialDatasets.marginalDomains.map(file => (
                  <FileRow key={file.name} file={file} />
                ))}
              </div>
            </div>
          )}

          {data.specialDatasets.other.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Analysis Files</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Domain coverage and analysis data
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.specialDatasets.other.map(file => (
                  <FileRow key={file.name} file={file} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Previous Versions */}
      {data?.previousVersions && data.previousVersions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Previous Versions</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.previousVersions.map(version => (
                <div key={version.version} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ECOD {version.version}
                    </span>
                    <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                      {version.date}
                    </span>
                  </div>
                  <a
                    href={`http://prodata.swmed.edu/ecod/distributions/ecod.${version.version}.domains.txt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    domains.txt →
                  </a>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                For older versions, browse the{' '}
                <a
                  href="http://prodata.swmed.edu/ecod/distributions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  complete archive
                </a>
                .
              </p>
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

  const description = getDescription(file.name);

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
        {files.map(file => {
          const ext = file.name.split('.').slice(-1)[0];
          const shortExt = ext === 'txt' ? file.name.split('.').slice(-2, -1)[0] : ext;

          return (
            <a
              key={file.name}
              href={file.url}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
            >
              <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{shortExt}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{file.sizeFormatted}</span>
            </a>
          );
        })}
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Total: {formatSize(totalSize)}
        </span>
      </div>
    </div>
  );
}
