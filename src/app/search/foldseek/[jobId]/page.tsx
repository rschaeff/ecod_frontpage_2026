'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { basePath } from '@/lib/config';

interface FoldseekHit {
  num: number;
  targetId: string;
  domainId?: string;
  uid?: number;
  fid?: string;
  familyName?: string;
  pident: number;
  alnLength: number;
  evalue: number;
  bitScore: number;
  tmScore: number;
  queryStart: number;
  queryEnd: number;
  targetStart: number;
  targetEnd: number;
}

interface JobMetadata {
  inputType: string;
  source: { type: string; id?: string };
  chain?: string;
  evalue: string;
  submitted: string;
}

interface FoldseekResults {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: JobMetadata;
  hitCount?: number;
  hits?: FoldseekHit[];
  error?: string;
}

// Get color based on TM-score
function getTMScoreColor(tmScore: number): string {
  if (tmScore >= 0.8) return 'bg-red-500';
  if (tmScore >= 0.5) return 'bg-orange-500';
  if (tmScore >= 0.3) return 'bg-yellow-500';
  return 'bg-gray-400';
}

function getTMScoreColorText(tmScore: number): string {
  if (tmScore >= 0.8) return 'text-red-600';
  if (tmScore >= 0.5) return 'text-orange-600';
  if (tmScore >= 0.3) return 'text-yellow-600';
  return 'text-gray-600';
}

function getSourceDescription(metadata?: JobMetadata): string {
  if (!metadata) return 'Unknown source';
  if (metadata.source.type === 'pdb' && metadata.source.id) {
    return `PDB ${metadata.source.id}`;
  }
  if (metadata.source.type === 'alphafold' && metadata.source.id) {
    return `AlphaFold ${metadata.source.id}`;
  }
  return 'Uploaded structure';
}

export default function FoldseekResultsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [results, setResults] = useState<FoldseekResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchResults = async () => {
      try {
        const response = await fetch(`${basePath}/api/foldseek/${jobId}`);
        const data = await response.json();

        if (data.success) {
          setResults(data.data);

          // Continue polling if not completed
          if (data.data.status === 'pending' || data.data.status === 'running') {
            pollInterval = setTimeout(fetchResults, 3000);
          }
        } else {
          setError(data.error?.message || 'Failed to fetch results');
        }
      } catch (err) {
        setError('Failed to connect to server');
      }
    };

    fetchResults();

    return () => {
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [jobId]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <h2 className="font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <Link href="/search/foldseek" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to Foldseek search
          </Link>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // Pending or running state
  if (results.status === 'pending' || results.status === 'running') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Foldseek Search Results</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {results.status === 'pending' ? 'Job Queued' : 'Foldseek Running'}
          </h2>
          <p className="text-gray-600 mb-4">
            {results.status === 'pending'
              ? 'Your Foldseek search is waiting in the queue...'
              : 'Searching ECOD database for structurally similar domains...'}
          </p>
          <p className="text-sm text-gray-500">
            Job ID: <code className="bg-gray-100 px-2 py-1 rounded">{jobId}</code>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            This page will automatically update when results are ready.
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  if (results.status === 'failed') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Foldseek Search Results</h1>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-semibold text-red-800 mb-2">Search Failed</h2>
          <pre className="text-sm text-red-700 mb-4 whitespace-pre-wrap bg-red-100 p-3 rounded">
            {results.error || 'An error occurred during the Foldseek search.'}
          </pre>
          <Link href="/search/foldseek" className="text-blue-600 hover:underline">
            ← Try another search
          </Link>
        </div>
      </div>
    );
  }

  // Completed - show results
  const hits = results.hits || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-blue-600">Search</Link>
        <span>/</span>
        <Link href="/search/foldseek" className="hover:text-blue-600">Foldseek</Link>
        <span>/</span>
        <span>Results</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Foldseek Search Results</h1>
          <p className="text-gray-600 mt-1">
            Query: {getSourceDescription(results.metadata)}
            <span className="mx-2">•</span>
            Job ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{jobId}</code>
          </p>
        </div>
        <Link
          href="/search/foldseek"
          className="text-blue-600 hover:underline"
        >
          ← New search
        </Link>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Hits found:</span>{' '}
            <span className="font-medium">{hits.length}</span>
          </div>
          <div>
            <span className="text-gray-500">E-value threshold:</span>{' '}
            <span className="font-medium">{results.metadata?.evalue || 'default'}</span>
          </div>
          <div>
            <span className="text-gray-500">Database:</span>{' '}
            <span className="font-medium">ECOD representatives</span>
          </div>
        </div>
      </div>

      {hits.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-800">
          <h2 className="font-semibold mb-2">No hits found</h2>
          <p>No significant structural matches were found in the ECOD database for your query.</p>
          <p className="mt-2 text-sm">Try using a more permissive E-value threshold.</p>
        </div>
      ) : (
        <>
          {/* Score legend */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-gray-600">TM-score:</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-red-500 rounded"></span> ≥0.8 (very similar)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-orange-500 rounded"></span> 0.5-0.8 (similar fold)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-yellow-500 rounded"></span> 0.3-0.5 (possible match)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-gray-400 rounded"></span> &lt;0.3 (weak)
              </span>
            </div>
          </div>

          {/* Hits table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium w-8">#</th>
                    <th className="px-4 py-3 font-medium">Domain</th>
                    <th className="px-4 py-3 font-medium">Family</th>
                    <th className="px-4 py-3 font-medium text-right">TM-score</th>
                    <th className="px-4 py-3 font-medium text-right">E-value</th>
                    <th className="px-4 py-3 font-medium text-right">Identity</th>
                    <th className="px-4 py-3 font-medium text-right">Align Len</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hits.map((hit) => (
                    <tr key={hit.num} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block w-3 h-3 rounded ${getTMScoreColor(hit.tmScore)}`}></span>
                      </td>
                      <td className="px-4 py-3">
                        {hit.uid ? (
                          <Link
                            href={`/domain/${hit.uid}`}
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {hit.domainId || hit.targetId}
                          </Link>
                        ) : (
                          <span className="font-mono">{hit.targetId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hit.fid ? (
                          <Link
                            href={`/tree?id=${encodeURIComponent(hit.fid)}`}
                            className="text-blue-600 hover:underline font-mono text-xs"
                          >
                            {hit.fid}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {hit.familyName && (
                          <span className="text-gray-500 ml-2 text-xs">{hit.familyName}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${getTMScoreColorText(hit.tmScore)}`}>
                        {hit.tmScore.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {hit.evalue.toExponential(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {hit.pident.toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {hit.alnLength}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Help text */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">Interpreting Results</h3>
        <ul className="space-y-1">
          <li><strong>TM-score:</strong> Template Modeling score (0-1). Values above 0.5 suggest similar folds; above 0.8 indicates nearly identical structures.</li>
          <li><strong>E-value:</strong> Expected number of hits by chance. Lower is better.</li>
          <li><strong>Identity:</strong> Sequence identity in the aligned region.</li>
        </ul>
      </div>
    </div>
  );
}
