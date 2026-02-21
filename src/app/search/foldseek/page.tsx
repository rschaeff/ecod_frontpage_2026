'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { basePath } from '@/lib/config';

type InputType = 'pdb_file' | 'pdb_id' | 'alphafold_id';

export default function FoldseekSearchPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputType, setInputType] = useState<InputType>('pdb_file');
  const [structure, setStructure] = useState('');
  const [pdbId, setPdbId] = useState('');
  const [chain, setChain] = useState('');
  const [alphafoldId, setAlphafoldId] = useState('');
  const [evalue, setEvalue] = useState('0.01');
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setStructure(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setStructure(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearFile = () => {
    setStructure('');
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, string> = { inputType, evalue };

      if (inputType === 'pdb_file') {
        if (!structure) {
          setError('Please upload a structure file');
          setSubmitting(false);
          return;
        }
        body.structure = structure;
      } else if (inputType === 'pdb_id') {
        if (!pdbId || pdbId.length !== 4) {
          setError('Please enter a valid 4-character PDB ID');
          setSubmitting(false);
          return;
        }
        if (!chain) {
          setError('Please specify a chain ID (e.g., A, B, or L for light chain)');
          setSubmitting(false);
          return;
        }
        body.pdbId = pdbId;
        body.chain = chain;
      } else if (inputType === 'alphafold_id') {
        if (!alphafoldId) {
          setError('Please enter a UniProt accession');
          setSubmitting(false);
          return;
        }
        body.alphafoldId = alphafoldId;
      }

      const response = await fetch(`${basePath}/api/foldseek/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/search/foldseek/${result.data.jobId}`);
      } else {
        setError(result.error?.message || 'Failed to submit Foldseek job');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-blue-600">Search</Link>
        <span>/</span>
        <span>Foldseek</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Foldseek Structural Search</h1>
      <p className="text-gray-600 mb-6">
        Search ECOD domains by protein structure using Foldseek
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Input Type Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setInputType('pdb_file')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                inputType === 'pdb_file'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setInputType('pdb_id')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                inputType === 'pdb_id'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              PDB ID
            </button>
            <button
              type="button"
              onClick={() => setInputType('alphafold_id')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                inputType === 'alphafold_id'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              AlphaFold ID
            </button>
          </div>

          <div className="p-6">
            {/* File Upload */}
            {inputType === 'pdb_file' && (
              <div>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    fileName
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdb,.cif,.mmcif,.ent"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {fileName ? (
                    <div>
                      <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-green-700 font-medium">{fileName}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {structure.split('\n').filter(l => l.startsWith('ATOM')).length} atoms
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                        className="mt-3 text-sm text-red-600 hover:text-red-800"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-600">
                        Drag and drop a PDB or mmCIF file here
                      </p>
                      <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Accepts .pdb, .cif, .mmcif formats. Maximum 100,000 atoms.
                </p>
              </div>
            )}

            {/* PDB ID Input */}
            {inputType === 'pdb_id' && (
              <div>
                <label htmlFor="pdbId" className="block font-medium text-gray-900 mb-2">
                  PDB ID and Chain
                </label>
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    id="pdbId"
                    type="text"
                    value={pdbId}
                    onChange={(e) => setPdbId(e.target.value.toUpperCase())}
                    placeholder="1ABC"
                    maxLength={4}
                    className="w-28 font-mono text-lg uppercase px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-lg">_</span>
                  <input
                    id="chain"
                    type="text"
                    value={chain}
                    onChange={(e) => setChain(e.target.value.toUpperCase())}
                    placeholder="A"
                    maxLength={4}
                    className="w-20 font-mono text-lg uppercase px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Enter a PDB ID and chain (e.g., 1ABC + A). Chain is required for multi-chain structures.
                </p>
              </div>
            )}

            {/* AlphaFold ID Input */}
            {inputType === 'alphafold_id' && (
              <div>
                <label htmlFor="alphafoldId" className="block font-medium text-gray-900 mb-2">
                  UniProt Accession
                </label>
                <input
                  id="alphafoldId"
                  type="text"
                  value={alphafoldId}
                  onChange={(e) => setAlphafoldId(e.target.value.toUpperCase())}
                  placeholder="e.g., P12345"
                  className="w-full max-w-xs font-mono text-lg uppercase px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter a UniProt accession. The AlphaFold predicted structure will be fetched from EBI.
                </p>
              </div>
            )}
          </div>
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
                ECOD representative domains (~63K)
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
            disabled={submitting}
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
              'Search Foldseek'
            )}
          </button>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">About Foldseek Search</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            <strong>What it does:</strong> Finds ECOD domains with similar 3D structures to your query, even without sequence similarity.
          </li>
          <li>
            <strong>How it works:</strong> Foldseek encodes protein structures as sequences using a 3Di alphabet, enabling fast database searches.
          </li>
          <li>
            <strong>TM-score:</strong> Primary metric for structural similarity. Values above 0.5 indicate significant similarity; above 0.8 indicates very similar folds.
          </li>
          <li>
            <strong>Time:</strong> Searches typically complete in 1-5 minutes depending on structure size and server load.
          </li>
        </ul>
      </div>
    </div>
  );
}
