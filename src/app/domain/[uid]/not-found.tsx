import Link from 'next/link';

export default function DomainNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">404</div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Domain not found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The requested ECOD domain could not be found. It may have been reclassified or removed in a newer version.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/search"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Search ECOD
          </Link>
          <Link
            href="/tree"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
          >
            Browse tree
          </Link>
        </div>
      </div>
    </div>
  );
}
