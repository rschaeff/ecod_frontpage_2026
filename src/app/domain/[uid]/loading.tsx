export default function DomainLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex gap-2 mb-6">
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Title */}
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 3D Viewer placeholder */}
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />

        {/* Details panel */}
        <div className="space-y-4">
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mt-6" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
