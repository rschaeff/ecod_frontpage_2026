'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { basePath } from '@/lib/config';

const EXAMPLE_SEQUENCE = `>Example: Thioredoxin domain
MVKQIESKTAFQEALDAAGDKLVVVDFSATWCGPCKMIKPFFHSLSEKYSNVIFLEVDVD
DCQDVASECEVKCMPTFQFFKKGQKVGEFSGANKEKLEATINELV`;

export default function BlastSearchPage() {
  return (
    <Suspense fallback={<BlastPageSkeleton />}>
      <BlastSearchForm />
    </Suspense>
  );
}

function BlastPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">BLAST Search</h1>
      <p className="text-gray-600 mb-6">
        Search ECOD domains by protein sequence using BLASTP
      </p>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-md" />
      </div>
    </div>
  );
}

function BlastSearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sequence, setSequence] = useState(searchParams.get('seq') || '');
  const [evalue, setEvalue] = useState('0.01');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${basePath}/api/blast/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence, evalue }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to results page
        router.push(`/search/blast/${result.data.jobId}`);
      } else {
        setError(result.error?.message || 'Failed to submit BLAST job');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  const loadExample = () => {
    setSequence(EXAMPLE_SEQUENCE);
  };

  const clearSequence = () => {
    setSequence('');
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">BLAST Search</h1>
      <p className="text-gray-600 mb-6">
        Search ECOD domains by protein sequence using BLASTP
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sequence Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="sequence" className="block font-semibold text-gray-900">
              Protein Sequence
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadExample}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Load example
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={clearSequence}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            id="sequence"
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="Paste protein sequence in FASTA format or raw amino acid sequence..."
            className="w-full h-48 font-mono text-sm border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
            required
          />

          <p className="mt-2 text-sm text-gray-500">
            Enter a protein sequence (10-10,000 amino acids). FASTA headers are optional.
          </p>
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Search Options</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="evalue" className="block text-sm font-medium text-gray-700 mb-1">
                E-value threshold
              </label>
              <select
                id="evalue"
                value={evalue}
                onChange={(e) => setEvalue(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1e-10">1e-10 (very stringent)</option>
                <option value="1e-5">1e-5 (stringent)</option>
                <option value="0.001">0.001</option>
                <option value="0.01">0.01 (default)</option>
                <option value="0.1">0.1</option>
                <option value="1">1 (permissive)</option>
                <option value="10">10 (very permissive)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                ECOD representative domains (ecod100_af2_pdb)
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !sequence.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </span>
            ) : (
              'Search BLAST'
            )}
          </button>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">About BLAST Search</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            <strong>What it does:</strong> Finds ECOD domains with similar sequences to your query protein.
          </li>
          <li>
            <strong>Database:</strong> Searches against representative domains from both PDB structures and AlphaFold models.
          </li>
          <li>
            <strong>E-value:</strong> Lower values mean more stringent matching. Default (0.01) is suitable for most searches.
          </li>
          <li>
            <strong>Time:</strong> Searches typically complete in 1-2 minutes depending on sequence length and server load.
          </li>
        </ul>
      </div>
    </div>
  );
}
