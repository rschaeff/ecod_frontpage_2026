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

  // Fetch root nodes (architectures)
  useEffect(() => {
    async function fetchRoots() {
      try {
        const response = await fetch(`${basePath}/api/tree`);
        const data = await response.json();

        if (data.success) {
          setRoots(data.data);
        } else {
          setError(data.error?.message || 'Failed to load tree');
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchRoots();
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
          />
        ))}
      </div>
    </div>
  );
}
