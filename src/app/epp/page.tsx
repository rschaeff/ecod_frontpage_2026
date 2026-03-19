'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { basePath } from '@/lib/config';

export default function EppPage() {
  const router = useRouter();
  const [accessionInput, setAccessionInput] = useState('');
  const [md5Input, setMd5Input] = useState('');
  const [md5Results, setMd5Results] = useState<{
    md5: string;
    count: number;
    proteins: { accession: string; sequenceLength: number; organismName: string | null; phylum: string | null; status: string }[];
  } | null>(null);
  const [md5Error, setMd5Error] = useState('');
  const [md5Loading, setMd5Loading] = useState(false);

  function handleAccessionSearch(e: React.FormEvent) {
    e.preventDefault();
    const acc = accessionInput.trim().toUpperCase();
    if (/^EPP\d{8}$/.test(acc)) {
      router.push(`/epp/${acc}`);
    }
  }

  async function handleMd5Search(e: React.FormEvent) {
    e.preventDefault();
    const md5 = md5Input.trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(md5)) {
      setMd5Error('Invalid MD5 hash. Expected 32 hex characters.');
      return;
    }

    setMd5Loading(true);
    setMd5Error('');
    setMd5Results(null);

    try {
      const res = await fetch(`${basePath}/api/epp/by-md5/${md5}`);
      const data = await res.json();
      if (!res.ok) {
        setMd5Error(data.error || 'Search failed');
      } else {
        setMd5Results(data);
      }
    } catch {
      setMd5Error('Failed to connect to server');
    } finally {
      setMd5Loading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200">ECOD</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">Predicted Proteins</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        ECOD Predicted Proteins (EPP)
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Predicted proteins from metagenomic and genomic projects, classified by ECOD.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Accession lookup */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Lookup by Accession
          </h2>
          <form onSubmit={handleAccessionSearch} className="space-y-3">
            <input
              type="text"
              value={accessionInput}
              onChange={(e) => setAccessionInput(e.target.value)}
              placeholder="EPP00010092"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={!/^EPP\d{8}$/i.test(accessionInput.trim())}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Look Up
            </button>
          </form>
        </div>

        {/* MD5 search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Search by Sequence MD5
          </h2>
          <form onSubmit={handleMd5Search} className="space-y-3">
            <input
              type="text"
              value={md5Input}
              onChange={(e) => setMd5Input(e.target.value)}
              placeholder="a1b2c3d4e5f6..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={md5Loading || !/^[a-f0-9]{32}$/i.test(md5Input.trim())}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {md5Loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      </div>

      {/* MD5 results */}
      {md5Error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-400 text-sm">{md5Error}</p>
        </div>
      )}

      {md5Results && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            MD5 Results
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({md5Results.count} match{md5Results.count !== 1 ? 'es' : ''})
            </span>
          </h3>
          {md5Results.count === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No proteins found with this sequence MD5.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Accession</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Length</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Organism</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Phylum</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {md5Results.proteins.map((p) => (
                    <tr key={p.accession} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3">
                        <Link href={`/epp/${p.accession}`} className="text-blue-600 dark:text-blue-400 hover:underline font-mono">
                          {p.accession}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{p.sequenceLength}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 italic">{p.organismName || '—'}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{p.phylum || '—'}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info section */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">About EPP</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            The ECOD Predicted Proteins (EPP) database contains predicted protein sequences from
            metagenomic and genomic studies, with stable accession identifiers for reliable cross-referencing.
          </p>
          <p>
            Each protein is assigned a unique <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">EPP########</code> accession
            that persists even if the underlying data is updated. Deprecated proteins include a pointer to their successor.
          </p>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">API Endpoints</h3>
        <div className="text-sm font-mono space-y-1">
          <div className="text-gray-600 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-semibold">GET</span>{' '}
            /api/epp/:accession — Protein details
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-semibold">GET</span>{' '}
            /api/epp/:accession/fasta — FASTA sequence
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-semibold">GET</span>{' '}
            /api/epp/by-md5/:md5 — Reverse lookup by sequence MD5
          </div>
        </div>
      </div>
    </div>
  );
}
