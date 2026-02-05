import { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/search/SearchBar';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search ECOD domains by UID, domain ID, UniProt, PDB ID, or keyword',
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
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
}

interface ClusterResult {
  id: string;
  type: string;
  name: string;
  parent: string | null;
}

interface SearchResponse {
  success: boolean;
  data?: {
    domains: DomainResult[];
    clusters: ClusterResult[];
    searchType: string;
    query: string;
    total: number;
    page: number;
    totalPages: number;
  };
  error?: { code: string; message: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || '';
  const page = parseInt(params.page || '1');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Domains</h1>

      {/* Search Form */}
      <div className="mb-8">
        <SearchBar initialQuery={query} />
      </div>

      {/* Search Results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        {query ? (
          <SearchResults query={query} page={page} />
        ) : (
          <SearchHelp />
        )}
      </Suspense>
    </div>
  );
}

// Type badge colors
const typeColors: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800',
  X: 'bg-blue-100 text-blue-800',
  H: 'bg-green-100 text-green-800',
  T: 'bg-yellow-100 text-yellow-800',
  F: 'bg-orange-100 text-orange-800',
};

// Domain type labels
const domainTypeLabels: Record<string, string> = {
  'experimental structure': 'PDB',
  'computed structural model': 'AFDB',
};

// Search results component (fetches from API)
async function SearchResults({
  query,
  page,
}: {
  query: string;
  page: number;
}) {
  // Build API URL - use absolute URL for server-side fetch
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  const apiUrl = `${baseUrl}/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=20`;

  let data: SearchResponse['data'];
  let error: string | null = null;

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    const result: SearchResponse = await response.json();

    if (result.success && result.data) {
      data = result.data;
    } else {
      error = result.error?.message || 'Search failed';
    }
  } catch (err) {
    error = 'Failed to connect to search service';
    console.error('Search error:', err);
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-red-700">
        <p className="font-medium">Search Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { domains, clusters, searchType, total, totalPages } = data;

  // No results
  if (domains.length === 0 && clusters.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-600">No results found for &quot;{query}&quot;</p>
        <p className="text-sm text-gray-400 mt-2">
          Try a different search term or check the search tips below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>
          Found {total.toLocaleString()} result{total !== 1 ? 's' : ''} for &quot;{query}&quot;
          <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
            {searchType.replace('_', ' ')}
          </span>
        </p>
        {totalPages > 1 && (
          <p>Page {page} of {totalPages}</p>
        )}
      </div>

      {/* Cluster results */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">
              Matching Classifications ({clusters.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${typeColors[cluster.type] || 'bg-gray-100 text-gray-800'}`}>
                    {cluster.type}
                  </span>
                  <Link
                    href={`/tree?id=${encodeURIComponent(cluster.id)}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {cluster.id}
                  </Link>
                  <span className="text-gray-600">{cluster.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain results */}
      {domains.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">
              Domains {total > domains.length && `(showing ${domains.length} of ${total.toLocaleString()})`}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Domain ID</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Range</th>
                  <th className="px-4 py-2 font-medium">Family</th>
                  <th className="px-4 py-2 font-medium">UniProt</th>
                  <th className="px-4 py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {domains.map((domain) => (
                  <tr key={domain.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {domain.isRep && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded" title="Representative domain">
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
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          domain.type === 'experimental structure'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {domainTypeLabels[domain.type] || domain.type}
                        </span>
                        {domain.sourceId && (
                          <span className="font-mono text-gray-600">{domain.sourceId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-600 text-xs">
                      {domain.range || '-'}
                    </td>
                    <td className="px-4 py-2">
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
                    <td className="px-4 py-2">
                      {domain.unpAcc ? (
                        <a
                          href={`https://www.uniprot.org/uniprotkb/${domain.unpAcc}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {domain.unpAcc}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/domain/${domain.uid}`}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination query={query} currentPage={page} totalPages={totalPages} />
      )}
    </div>
  );
}

// Pagination component
function Pagination({
  query,
  currentPage,
  totalPages,
}: {
  query: string;
  currentPage: number;
  totalPages: number;
}) {
  const pages: (number | 'ellipsis')[] = [];

  // Build page numbers to show
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Previous
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm text-gray-300">Previous</span>
      )}

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-2 text-gray-400">...</span>
        ) : (
          <Link
            key={p}
            href={`/search?q=${encodeURIComponent(query)}&page=${p}`}
            className={`px-3 py-2 text-sm rounded ${
              p === currentPage
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm text-gray-300">Next</span>
      )}
    </nav>
  );
}

// Loading skeleton
function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Help text when no query
function SearchHelp() {
  return (
    <div className="bg-blue-50 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-blue-900 mb-4">Search Tips</h2>
      <ul className="space-y-3 text-blue-800">
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">123456789</span>
          <span>Search by UID (6-9 digit number)</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">e1abcA1</span>
          <span>Search by ECOD domain ID</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">P12345</span>
          <span>Search by UniProt accession</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">1abc</span>
          <span>Search by PDB ID (shows all domains from that structure)</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">1.2.3</span>
          <span>Search by cluster ID (shows domains in that classification)</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">kinase</span>
          <span>Search by keyword (searches cluster names and protein annotations)</span>
        </li>
      </ul>
    </div>
  );
}
