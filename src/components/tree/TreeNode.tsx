'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TreeNodeData } from './TreeView';

// Type colors matching the PHP site
const typeColors: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800',
  X: 'bg-blue-100 text-blue-800',
  H: 'bg-green-100 text-green-800',
  T: 'bg-yellow-100 text-yellow-800',
  F: 'bg-orange-100 text-orange-800',
  S: 'bg-gray-100 text-gray-800',
};

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  childrenCache: Record<string, TreeNodeData[]>;
  expandedNodes: Set<string>;
  fetchChildren: (id: string) => Promise<TreeNodeData[]>;
}

export default function TreeNode({
  node,
  level,
  isExpanded,
  onToggle,
  childrenCache,
  expandedNodes,
  fetchChildren,
}: TreeNodeProps) {
  const [children, setChildren] = useState<TreeNodeData[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Load children when expanded
  useEffect(() => {
    if (isExpanded && node.hasChildren) {
      if (childrenCache[node.id]) {
        setChildren(childrenCache[node.id]);
      } else {
        setLoadingChildren(true);
        fetchChildren(node.id).then(data => {
          setChildren(data);
          setLoadingChildren(false);
        });
      }
    }
  }, [isExpanded, node.id, node.hasChildren, childrenCache, fetchChildren]);

  const handleToggle = () => {
    if (node.hasChildren) {
      onToggle(node.id);
    }
  };

  const indent = level * 20;
  const typeColor = typeColors[node.type] || 'bg-gray-100 text-gray-800';

  return (
    <div>
      {/* Node row */}
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer group"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand/collapse icon */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          } ${!node.hasChildren ? 'invisible' : ''}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Type badge */}
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${typeColor}`}>
          {node.type}
        </span>

        {/* Node name - clickable for leaf nodes */}
        <span
          onClick={handleToggle}
          className="flex-1 text-sm text-gray-800 truncate"
        >
          {node.name}
        </span>

        {/* Domain count for F-groups */}
        {node.type === 'F' && node.domainCount !== null && (
          <span className="text-xs text-gray-400">
            {node.domainCount.toLocaleString()} domains
          </span>
        )}

        {/* Child count for non-F groups */}
        {node.type !== 'F' && node.childCount > 0 && (
          <span className="text-xs text-gray-400">
            {node.childCount.toLocaleString()}
          </span>
        )}

        {/* Link to browse this cluster */}
        <Link
          href={`/tree?id=${encodeURIComponent(node.id)}`}
          className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
      </div>

      {/* Children */}
      {isExpanded && (
        <div>
          {loadingChildren ? (
            <div style={{ paddingLeft: `${indent + 28}px` }} className="py-2">
              <span className="text-sm text-gray-400">Loading...</span>
            </div>
          ) : (
            children.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                isExpanded={expandedNodes.has(child.id)}
                onToggle={onToggle}
                childrenCache={childrenCache}
                expandedNodes={expandedNodes}
                fetchChildren={fetchChildren}
              />
            ))
          )}

          {/* Show domains link for F-groups */}
          {node.type === 'F' && !loadingChildren && children.length === 0 && (
            <div style={{ paddingLeft: `${indent + 28}px` }} className="py-2">
              <Link
                href={`/search?cluster=${encodeURIComponent(node.id)}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Browse {node.domainCount?.toLocaleString() || 0} domains →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
