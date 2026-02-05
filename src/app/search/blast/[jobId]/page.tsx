'use client';

import { useState, useEffect, use, Fragment } from 'react';
import Link from 'next/link';

interface BlastHit {
  num: number;
  domainId: string;
  range: string;
  uid?: number;
  fid?: string;
  familyName?: string;
  evalue: number;
  bitScore: number;
  identity: number;
  alignLength: number;
  gaps: number;
  queryStart: number;
  queryEnd: number;
  hitStart: number;
  hitEnd: number;
  qseq: string;
  hseq: string;
  midline: string;
}

interface BlastResults {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  queryLength?: number;
  hitCount?: number;
  hits?: BlastHit[];
  error?: string;
}

// Get color based on bit score
function getScoreColor(bitScore: number): string {
  if (bitScore >= 200) return 'bg-red-500';
  if (bitScore >= 80) return 'bg-purple-500';
  if (bitScore >= 50) return 'bg-green-500';
  if (bitScore >= 40) return 'bg-blue-500';
  return 'bg-gray-400';
}

function getScoreColorText(bitScore: number): string {
  if (bitScore >= 200) return 'text-red-600';
  if (bitScore >= 80) return 'text-purple-600';
  if (bitScore >= 50) return 'text-green-600';
  if (bitScore >= 40) return 'text-blue-600';
  return 'text-gray-600';
}

// Format alignment for display
function formatAlignment(hit: BlastHit): string[] {
  const lines: string[] = [];
  const lineLength = 60;
  const qseq = hit.qseq;
  const hseq = hit.hseq;
  const midline = hit.midline;

  let qPos = hit.queryStart;
  let hPos = hit.hitStart;

  for (let i = 0; i < qseq.length; i += lineLength) {
    const qChunk = qseq.slice(i, i + lineLength);
    const hChunk = hseq.slice(i, i + lineLength);
    const mChunk = midline.slice(i, i + lineLength);

    const qGaps = (qChunk.match(/-/g) || []).length;
    const hGaps = (hChunk.match(/-/g) || []).length;

    lines.push(`Query ${String(qPos).padStart(5)}  ${qChunk}  ${qPos + qChunk.length - qGaps - 1}`);
    lines.push(`             ${mChunk}`);
    lines.push(`Sbjct ${String(hPos).padStart(5)}  ${hChunk}  ${hPos + hChunk.length - hGaps - 1}`);
    lines.push('');

    qPos += qChunk.length - qGaps;
    hPos += hChunk.length - hGaps;
  }

  return lines;
}

export default function BlastResultsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [results, setResults] = useState<BlastResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedHits, setExpandedHits] = useState<Set<number>>(new Set());

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/blast/${jobId}`);
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

  const toggleHit = (num: number) => {
    setExpandedHits(prev => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (results?.hits) {
      setExpandedHits(new Set(results.hits.map(h => h.num)));
    }
  };

  const collapseAll = () => {
    setExpandedHits(new Set());
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <h2 className="font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <Link href="/search/blast" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Back to BLAST search
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">BLAST Search Results</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {results.status === 'pending' ? 'Job Queued' : 'BLAST Running'}
          </h2>
          <p className="text-gray-600 mb-4">
            {results.status === 'pending'
              ? 'Your BLAST search is waiting in the queue...'
              : 'Searching ECOD database for similar domains...'}
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">BLAST Search Results</h1>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="font-semibold text-red-800 mb-2">Search Failed</h2>
          <p className="text-red-700 mb-4">{results.error || 'An error occurred during the BLAST search.'}</p>
          <Link href="/search/blast" className="text-blue-600 hover:underline">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">BLAST Search Results</h1>
          <p className="text-gray-600 mt-1">
            Job ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{jobId}</code>
          </p>
        </div>
        <Link
          href="/search/blast"
          className="text-blue-600 hover:underline"
        >
          ← New search
        </Link>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Query length:</span>{' '}
            <span className="font-medium">{results.queryLength} aa</span>
          </div>
          <div>
            <span className="text-gray-500">Hits found:</span>{' '}
            <span className="font-medium">{hits.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Database:</span>{' '}
            <span className="font-medium">ECOD representative domains</span>
          </div>
        </div>
      </div>

      {hits.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-800">
          <h2 className="font-semibold mb-2">No hits found</h2>
          <p>No significant matches were found in the ECOD database for your query sequence.</p>
          <p className="mt-2 text-sm">Try using a more permissive E-value threshold.</p>
        </div>
      ) : (
        <>
          {/* Score legend */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-gray-600">Bit score:</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-red-500 rounded"></span> ≥200
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-purple-500 rounded"></span> 80-200
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-green-500 rounded"></span> 50-80
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-blue-500 rounded"></span> 40-50
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 bg-gray-400 rounded"></span> &lt;40
              </span>

              <div className="flex-1"></div>

              <button onClick={expandAll} className="text-blue-600 hover:underline">
                Expand all
              </button>
              <button onClick={collapseAll} className="text-blue-600 hover:underline">
                Collapse all
              </button>
            </div>
          </div>

          {/* Hits table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium w-8">#</th>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Family</th>
                  <th className="px-4 py-3 font-medium text-right">E-value</th>
                  <th className="px-4 py-3 font-medium text-right">Bit Score</th>
                  <th className="px-4 py-3 font-medium text-right">Identity</th>
                  <th className="px-4 py-3 font-medium text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hits.map((hit) => (
                  <Fragment key={hit.num}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleHit(hit.num)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-block w-3 h-3 rounded ${getScoreColor(hit.bitScore)}`}></span>
                      </td>
                      <td className="px-4 py-3">
                        {hit.uid ? (
                          <Link
                            href={`/domain/${hit.uid}`}
                            className="text-blue-600 hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hit.domainId}
                          </Link>
                        ) : (
                          <span className="font-mono">{hit.domainId}</span>
                        )}
                        {hit.range && (
                          <span className="text-gray-400 ml-2 text-xs">{hit.range}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hit.fid ? (
                          <Link
                            href={`/tree?id=${encodeURIComponent(hit.fid)}`}
                            className="text-blue-600 hover:underline font-mono text-xs"
                            onClick={(e) => e.stopPropagation()}
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
                      <td className={`px-4 py-3 text-right font-mono ${getScoreColorText(hit.bitScore)}`}>
                        {hit.evalue.toExponential(1)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${getScoreColorText(hit.bitScore)}`}>
                        {Math.round(hit.bitScore)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {Math.round((hit.identity / hit.alignLength) * 100)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {hit.queryStart}-{hit.queryEnd}
                      </td>
                    </tr>

                    {/* Expanded alignment */}
                    {expandedHits.has(hit.num) && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="text-xs text-gray-600 mb-2">
                            <span className="mr-4">Query: {hit.queryStart}-{hit.queryEnd}</span>
                            <span className="mr-4">Subject: {hit.hitStart}-{hit.hitEnd}</span>
                            <span className="mr-4">Length: {hit.alignLength}</span>
                            <span className="mr-4">Gaps: {hit.gaps}</span>
                          </div>
                          <pre className="font-mono text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                            {formatAlignment(hit).join('\n')}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
