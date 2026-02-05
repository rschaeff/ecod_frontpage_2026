'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SuperkingdomOption {
  name: string;
  count: number;
}

interface TaxonomyOption {
  value: string;
  count: number;
}

interface DomainResult {
  uid: number;
  id: string;
  type: string;
  range: string;
  sourceId: string | null;
  unpAcc: string | null;
  fid: string | null;
  tid: string | null;
  isRep: boolean | null;
  organism: string | null;
  superkingdom: string | null;
  proteinName: string | null;
}

interface SearchSummary {
  superkingdom: string | null;
  count: number;
}

interface SearchResults {
  domains: DomainResult[];
  total: number;
  page: number;
  totalPages: number;
  summary: SearchSummary[];
  message?: string;
}

// Domain type labels
const domainTypeLabels: Record<string, string> = {
  'experimental structure': 'PDB',
  'computed structural model': 'AFDB',
};

export default function AdvancedSearchPage() {
  // Superkingdom options with counts
  const [superkingdomOptions, setSuperkingdomOptions] = useState<SuperkingdomOption[]>([]);
  const [loadingSuperkingdoms, setLoadingSuperkingdoms] = useState(true);

  // Taxonomy cascading options
  const [phylumOptions, setPhylumOptions] = useState<TaxonomyOption[]>([]);
  const [classOptions, setClassOptions] = useState<TaxonomyOption[]>([]);
  const [orderOptions, setOrderOptions] = useState<TaxonomyOption[]>([]);
  const [familyOptions, setFamilyOptions] = useState<TaxonomyOption[]>([]);
  const [genusOptions, setGenusOptions] = useState<TaxonomyOption[]>([]);

  // Filter state
  const [selectedSuperkingdoms, setSelectedSuperkingdoms] = useState<string[]>([]);
  const [selectedPhylum, setSelectedPhylum] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedGenus, setSelectedGenus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [ecodClass, setEcodClass] = useState('');
  const [structureSource, setStructureSource] = useState('all');

  // Search results
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch superkingdom counts on mount
  useEffect(() => {
    async function fetchSuperkingdoms() {
      try {
        const response = await fetch('/api/taxonomy');
        const data = await response.json();
        if (data.success) {
          setSuperkingdomOptions(data.data.superkingdoms);
        }
      } catch (error) {
        console.error('Failed to fetch superkingdoms:', error);
      } finally {
        setLoadingSuperkingdoms(false);
      }
    }
    fetchSuperkingdoms();
  }, []);

  // Fetch cascading taxonomy options
  const fetchTaxonomyOptions = useCallback(async (
    level: string,
    parentLevel?: string,
    parentValue?: string
  ) => {
    const params = new URLSearchParams({ level });
    selectedSuperkingdoms.forEach(sk => params.append('superkingdom', sk));
    if (parentLevel && parentValue) {
      params.set('parentLevel', parentLevel);
      params.set('parentValue', parentValue);
    }

    try {
      const response = await fetch(`/api/taxonomy?${params}`);
      const data = await response.json();
      if (data.success) {
        return data.data.options;
      }
    } catch (error) {
      console.error(`Failed to fetch ${level} options:`, error);
    }
    return [];
  }, [selectedSuperkingdoms]);

  // Update phylum options when superkingdoms change
  useEffect(() => {
    if (selectedSuperkingdoms.length > 0) {
      fetchTaxonomyOptions('phylum').then(setPhylumOptions);
    } else {
      setPhylumOptions([]);
    }
    // Reset lower levels
    setSelectedPhylum('');
    setClassOptions([]);
    setSelectedClass('');
    setOrderOptions([]);
    setSelectedOrder('');
    setFamilyOptions([]);
    setSelectedFamily('');
    setGenusOptions([]);
    setSelectedGenus('');
  }, [selectedSuperkingdoms, fetchTaxonomyOptions]);

  // Update class options when phylum changes
  useEffect(() => {
    if (selectedPhylum) {
      fetchTaxonomyOptions('class', 'phylum', selectedPhylum).then(setClassOptions);
    } else {
      setClassOptions([]);
    }
    setSelectedClass('');
    setOrderOptions([]);
    setSelectedOrder('');
    setFamilyOptions([]);
    setSelectedFamily('');
    setGenusOptions([]);
    setSelectedGenus('');
  }, [selectedPhylum, fetchTaxonomyOptions]);

  // Update order options when class changes
  useEffect(() => {
    if (selectedClass) {
      fetchTaxonomyOptions('order', 'class', selectedClass).then(setOrderOptions);
    } else {
      setOrderOptions([]);
    }
    setSelectedOrder('');
    setFamilyOptions([]);
    setSelectedFamily('');
    setGenusOptions([]);
    setSelectedGenus('');
  }, [selectedClass, fetchTaxonomyOptions]);

  // Update family options when order changes
  useEffect(() => {
    if (selectedOrder) {
      fetchTaxonomyOptions('family', 'order', selectedOrder).then(setFamilyOptions);
    } else {
      setFamilyOptions([]);
    }
    setSelectedFamily('');
    setGenusOptions([]);
    setSelectedGenus('');
  }, [selectedOrder, fetchTaxonomyOptions]);

  // Update genus options when family changes
  useEffect(() => {
    if (selectedFamily) {
      fetchTaxonomyOptions('genus', 'family', selectedFamily).then(setGenusOptions);
    } else {
      setGenusOptions([]);
    }
    setSelectedGenus('');
  }, [selectedFamily, fetchTaxonomyOptions]);

  // Execute search
  const executeSearch = async (newPage = 1) => {
    setLoading(true);
    setPage(newPage);

    const params = new URLSearchParams();
    params.set('page', String(newPage));
    selectedSuperkingdoms.forEach(sk => params.append('superkingdom', sk));
    if (selectedPhylum) params.set('phylum', selectedPhylum);
    if (selectedClass) params.set('class', selectedClass);
    if (selectedOrder) params.set('order', selectedOrder);
    if (selectedFamily) params.set('family', selectedFamily);
    if (selectedGenus) params.set('genus', selectedGenus);
    if (keyword) params.set('keyword', keyword);
    if (ecodClass) params.set('ecod_class', ecodClass);
    if (structureSource !== 'all') params.set('structure_source', structureSource);

    try {
      const response = await fetch(`/api/search/advanced?${params}`);
      const data = await response.json();
      if (data.success) {
        setResults(data.data);
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle superkingdom checkbox change
  const toggleSuperkingdom = (name: string) => {
    setSelectedSuperkingdoms(prev =>
      prev.includes(name)
        ? prev.filter(sk => sk !== name)
        : [...prev, name]
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedSuperkingdoms([]);
    setSelectedPhylum('');
    setSelectedClass('');
    setSelectedOrder('');
    setSelectedFamily('');
    setSelectedGenus('');
    setKeyword('');
    setEcodClass('');
    setStructureSource('all');
    setResults(null);
  };

  const hasFilters = selectedSuperkingdoms.length > 0 || keyword || ecodClass || structureSource !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Advanced Search</h1>
        <p className="text-gray-600 mt-1">
          Filter domains by taxonomy, structure source, and classification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-4 space-y-6">
            {/* Superkingdom */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Superkingdom</h3>
              {loadingSuperkingdoms ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-5 bg-gray-200 rounded w-3/4" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {superkingdomOptions.map(sk => (
                    <label key={sk.name} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSuperkingdoms.includes(sk.name)}
                        onChange={() => toggleSuperkingdom(sk.name)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{sk.name}</span>
                      <span className="text-xs text-gray-400">({sk.count.toLocaleString()})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Taxonomy Cascading Dropdowns */}
            {selectedSuperkingdoms.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Taxonomy</h3>

                {/* Phylum */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phylum</label>
                  <select
                    value={selectedPhylum}
                    onChange={e => setSelectedPhylum(e.target.value)}
                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">All phyla</option>
                    {phylumOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} ({opt.count.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class */}
                {classOptions.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Class</label>
                    <select
                      value={selectedClass}
                      onChange={e => setSelectedClass(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">All classes</option>
                      {classOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} ({opt.count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Order */}
                {orderOptions.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Order</label>
                    <select
                      value={selectedOrder}
                      onChange={e => setSelectedOrder(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">All orders</option>
                      {orderOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} ({opt.count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Family */}
                {familyOptions.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Family</label>
                    <select
                      value={selectedFamily}
                      onChange={e => setSelectedFamily(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">All families</option>
                      {familyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} ({opt.count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Genus */}
                {genusOptions.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Genus</label>
                    <select
                      value={selectedGenus}
                      onChange={e => setSelectedGenus(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">All genera</option>
                      {genusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} ({opt.count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Structure Source */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Structure Source</h3>
              <div className="space-y-2">
                {[
                  { value: 'all', label: 'All structures' },
                  { value: 'experimental', label: 'PDB (experimental)' },
                  { value: 'predicted', label: 'AlphaFold (predicted)' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="structureSource"
                      value={opt.value}
                      checked={structureSource === opt.value}
                      onChange={e => setStructureSource(e.target.value)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Keyword Filter */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Keyword</h3>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Protein or organism name"
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* ECOD Classification Filter */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">ECOD Classification</h3>
              <input
                type="text"
                value={ecodClass}
                onChange={e => setEcodClass(e.target.value)}
                placeholder="e.g., 1.1 or 1.1.1"
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => executeSearch(1)}
                disabled={!hasFilters || loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          {!results && !loading && (
            <div className="bg-blue-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">How to use Advanced Search</h2>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>1. Select one or more superkingdoms to filter by taxonomy</li>
                <li>2. Optionally narrow down with phylum, class, order, family, or genus</li>
                <li>3. Filter by structure source (PDB experimental or AlphaFold predicted)</li>
                <li>4. Add a keyword to search protein or organism names</li>
                <li>5. Optionally filter by ECOD classification (e.g., &quot;1.1&quot; for X-group)</li>
                <li>6. Click Search to find matching domains</li>
              </ul>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-4 bg-gray-200 rounded"></div>
                    <div className="w-32 h-4 bg-gray-200 rounded"></div>
                    <div className="w-48 h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results && !loading && (
            <div className="space-y-4">
              {/* Results summary */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-gray-900 font-medium">
                      {results.total.toLocaleString()} domain{results.total !== 1 ? 's' : ''} found
                    </p>
                    {results.totalPages > 1 && (
                      <p className="text-sm text-gray-500">
                        Page {results.page} of {results.totalPages}
                      </p>
                    )}
                  </div>

                  {/* Superkingdom summary badges */}
                  {results.summary.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {results.summary.map(s => (
                        <span
                          key={s.superkingdom || 'unknown'}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {s.superkingdom || 'Unknown'}: {s.count.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Results message */}
              {results.message && (
                <div className="bg-yellow-50 rounded-lg p-4 text-yellow-800">
                  {results.message}
                </div>
              )}

              {/* Domain results table */}
              {results.domains.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                          <th className="px-4 py-3 font-medium">Domain ID</th>
                          <th className="px-4 py-3 font-medium">Source</th>
                          <th className="px-4 py-3 font-medium">Organism</th>
                          <th className="px-4 py-3 font-medium">Family</th>
                          <th className="px-4 py-3 font-medium">Protein</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.domains.map(domain => (
                          <tr key={domain.uid} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {domain.isRep && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded" title="Representative">
                                    REP
                                  </span>
                                )}
                                <Link
                                  href={`/domain/${domain.uid}`}
                                  className="text-blue-600 hover:underline font-mono"
                                >
                                  {domain.id}
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 text-xs rounded ${
                                  domain.type === 'experimental structure'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {domainTypeLabels[domain.type] || domain.type}
                                </span>
                                {domain.sourceId && (
                                  <span className="font-mono text-gray-500 text-xs">{domain.sourceId}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                <span className="text-gray-900">{domain.organism || '-'}</span>
                                {domain.superkingdom && (
                                  <span className="text-xs text-gray-400 ml-1">({domain.superkingdom})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {domain.fid ? (
                                <Link
                                  href={`/tree?id=${encodeURIComponent(domain.fid)}`}
                                  className="text-blue-600 hover:underline font-mono text-xs"
                                >
                                  {domain.fid}
                                </Link>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-600 text-xs truncate block max-w-[200px]" title={domain.proteinName || undefined}>
                                {domain.proteinName || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {results.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => executeSearch(page - 1)}
                    disabled={page <= 1 || loading}
                    className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-gray-600">
                    Page {page} of {results.totalPages}
                  </span>

                  <button
                    onClick={() => executeSearch(page + 1)}
                    disabled={page >= results.totalPages || loading}
                    className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
