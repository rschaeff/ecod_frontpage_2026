'use client';

import { useEffect, useState, useCallback } from 'react';
import TreeNode from './TreeNode';
import { basePath } from '@/lib/config';

export interface TreeNodeData {
  id: string;
  type: string;
  name: string;
  parent: string | null;
  domainCount: number | null;
  childCount: number;
  hasChildren: boolean;
  pfam?: {
    families: { acc: string; id: string; clan: string | null }[];
    clans: { acc: string; name: string }[];
  };
  clanDiversity?: {
    clanCount: number;
    pfamCount: number;
    clans: { acc: string; name: string }[];
  };
}

interface TreeViewProps {
  initialExpandedId?: string;
}

export default function TreeView({ initialExpandedId }: TreeViewProps) {
  const [roots, setRoots] = useState<TreeNodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, TreeNodeData[]>>({});

  // Compute ancestor IDs from a dot-separated cluster ID
  // e.g., "1.2.3.4" => ["1", "1.2", "1.2.3", "1.2.3.4"]
  function getAncestorIds(id: string): string[] {
    const parts = id.split('.');
    const ancestors: string[] = [];
    for (let i = 1; i <= parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('.'));
    }
    return ancestors;
  }

  // Fetch root nodes, then auto-expand to initialExpandedId if provided
  useEffect(() => {
    async function fetchRootsAndExpand() {
      try {
        const response = await fetch(`${basePath}/api/tree`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error?.message || 'Failed to load tree');
          return;
        }

        const rootNodes: TreeNodeData[] = data.data;
        setRoots(rootNodes);

        // Auto-expand to target node if requested
        if (initialExpandedId) {
          const ancestors = getAncestorIds(initialExpandedId);
          const xGroupId = ancestors[0]; // top-level X-group

          // Find which A-group contains this X-group by fetching children of each root
          let parentArchId: string | null = null;
          for (const root of rootNodes) {
            const childRes = await fetch(`${basePath}/api/tree?parent=${encodeURIComponent(root.id)}`);
            const childData = await childRes.json();
            if (childData.success) {
              setChildrenCache(prev => ({ ...prev, [root.id]: childData.data }));
              if (childData.data.some((c: TreeNodeData) => c.id === xGroupId)) {
                parentArchId = root.id;
                break;
              }
            }
          }

          if (parentArchId) {
            // Expand the architecture node
            const toExpand = new Set<string>([parentArchId]);

            // Sequentially fetch and expand each ancestor level
            for (const ancestorId of ancestors) {
              toExpand.add(ancestorId);
              const res = await fetch(`${basePath}/api/tree?parent=${encodeURIComponent(ancestorId)}`);
              const d = await res.json();
              if (d.success) {
                setChildrenCache(prev => ({ ...prev, [ancestorId]: d.data }));
              }
            }

            setExpandedNodes(toExpand);
          }
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchRootsAndExpand();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch children for a node
  const fetchChildren = useCallback(async (nodeId: string): Promise<TreeNodeData[]> => {
    // Check cache first
    if (childrenCache[nodeId]) {
      return childrenCache[nodeId];
    }

    try {
      const response = await fetch(`${basePath}/api/tree?parent=${encodeURIComponent(nodeId)}`);
      const data = await response.json();

      if (data.success) {
        // Cache the result
        setChildrenCache(prev => ({ ...prev, [nodeId]: data.data }));
        return data.data;
      }
    } catch (err) {
      console.error('Failed to fetch children:', err);
    }

    return [];
  }, [childrenCache]);

  // Toggle node expansion
  const toggleNode = useCallback(async (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
        // Fetch children when expanding
        fetchChildren(nodeId);
      }
      return next;
    });
  }, [fetchChildren]);

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse flex items-center gap-2 p-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded flex-1"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={collapseAll}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Collapse All
        </button>
      </div>

      {/* Tree */}
      <div className="space-y-1">
        {roots.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            isExpanded={expandedNodes.has(node.id)}
            onToggle={toggleNode}
            childrenCache={childrenCache}
            expandedNodes={expandedNodes}
            fetchChildren={fetchChildren}
            highlightId={initialExpandedId}
          />
        ))}
      </div>
    </div>
  );
}
