'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import Link from 'next/link';

type SearchTab = 'keyword' | 'sequence' | 'structure';

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'keyword', label: 'Keyword' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'structure', label: 'Structure' },
];

export default function HeroSearch() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SearchTab>('keyword');
  const [query, setQuery] = useState('');
  const [sequence, setSequence] = useState('');

  const handleKeywordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSequenceSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Navigate to BLAST page, passing sequence via URL param if provided
    if (sequence.trim()) {
      router.push(`/search/blast?seq=${encodeURIComponent(sequence.trim())}`);
    } else {
      router.push('/search/blast');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="flex border-b border-gray-300 dark:border-gray-600 mb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        ))}
      </div>

      {/* Keyword Tab */}
      {activeTab === 'keyword' && (
        <form onSubmit={handleKeywordSubmit} className="mt-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by PDB ID, UniProt, domain ID, keyword..."
              className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              type="submit"
              className="absolute inset-y-0 right-0 flex items-center px-4 text-white bg-blue-600 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="ml-2 hidden sm:inline">Search</span>
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            UID, domain ID, UniProt accession, PDB ID, cluster ID, or keyword
          </p>
        </form>
      )}

      {/* Sequence Tab */}
      {activeTab === 'sequence' && (
        <form onSubmit={handleSequenceSubmit} className="mt-4">
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder={'>protein_name\nMKTVRQERLKSIVRILERSKEPVSGAQL...'}
            rows={4}
            className="w-full px-4 py-3 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Paste a protein sequence in FASTA format
            </p>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              BLAST Search
            </button>
          </div>
        </form>
      )}

      {/* Structure Tab */}
      {activeTab === 'structure' && (
        <div className="mt-4">
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 p-6 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Search by 3D structure similarity using Foldseek
            </p>
            <Link
              href="/search/foldseek"
              className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Go to Structure Search
            </Link>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Upload a PDB/mmCIF file to find domains with similar folds
          </p>
        </div>
      )}
    </div>
  );
}
