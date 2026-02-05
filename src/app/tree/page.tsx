import { Metadata } from 'next';
import TreeView from '@/components/tree/TreeView';

export const metadata: Metadata = {
  title: 'Browse Classification',
  description: 'Browse the ECOD hierarchical classification of protein domains',
};

interface TreePageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function TreePage({ searchParams }: TreePageProps) {
  const params = await searchParams;
  const initialId = params.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Browse Classification
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with legend */}
        <aside className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-20">
            <h2 className="font-semibold text-gray-900 mb-4">Hierarchy Levels</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">A</span>
                <span>Architecture</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">X</span>
                <span>Possible homology</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-green-100 text-green-800 flex items-center justify-center font-bold text-xs">H</span>
                <span>Homology</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-xs">T</span>
                <span>Topology</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xs">F</span>
                <span>Family</span>
              </li>
            </ul>

            <hr className="my-4" />

            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Tip:</strong> Click on a row to expand/collapse</p>
              <p>Click &quot;View&quot; to see cluster details</p>
            </div>
          </div>
        </aside>

        {/* Main tree content */}
        <main className="lg:col-span-3 order-1 lg:order-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 min-h-[500px]">
            <TreeView initialExpandedId={initialId} />
          </div>
        </main>
      </div>
    </div>
  );
}
