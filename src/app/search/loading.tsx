export default function SearchLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Search bar */}
      <div className="h-12 w-full max-w-2xl mx-auto bg-gray-200 dark:bg-gray-700 rounded-lg mb-8" />

      {/* Results count */}
      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />

      {/* Results table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 p-4 bg-gray-100 dark:bg-gray-800">
          <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-4 w-40 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
