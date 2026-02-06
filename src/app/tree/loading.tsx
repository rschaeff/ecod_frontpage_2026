export default function TreeLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Tree sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${80 + Math.random() * 80}px` }} />
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="lg:col-span-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
