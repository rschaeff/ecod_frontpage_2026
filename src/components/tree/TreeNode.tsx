'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { TreeNodeData } from './TreeView';
import { basePath } from '@/lib/config';

// Type colors matching the PHP site
const typeColors: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800',
  X: 'bg-blue-100 text-blue-800',
  H: 'bg-green-100 text-green-800',
  T: 'bg-yellow-100 text-yellow-800',
  F: 'bg-orange-100 text-orange-800',
  S: 'bg-gray-100 text-gray-800',
};

// Domain type labels
const domainTypeLabels: Record<string, { label: string; bg: string; text: string }> = {
  'experimental structure': { label: 'PDB', bg: 'bg-blue-100', text: 'text-blue-700' },
  'computed structural model': { label: 'AF', bg: 'bg-purple-100', text: 'text-purple-700' },
};

interface DomainPreview {
  uid: number;
  id: string;
  type: string;
  range: string;
  sourceId: string | null;
  isRep: boolean | null;
}

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
  const [domains, setDomains] = useState<DomainPreview[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [totalDomains, setTotalDomains] = useState<number | null>(null);

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

  // Load representative domains for F-groups when expanded
  useEffect(() => {
    if (isExpanded && node.type === 'F' && domains.length === 0 && !loadingDomains) {
      setLoadingDomains(true);
      fetch(`${basePath}/api/tree/domains?cluster=${encodeURIComponent(node.id)}&limit=5`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setDomains(data.data.domains);
            setTotalDomains(data.data.pagination.total);
          }
        })
        .catch(err => console.error('Failed to fetch domains:', err))
        .finally(() => setLoadingDomains(false));
    }
  }, [isExpanded, node.type, node.id, domains.length, loadingDomains]);

  // F-groups are always expandable (to show domains), others need hasChildren
  const isExpandable = node.type === 'F' || node.hasChildren;

  const handleToggle = () => {
    if (isExpandable) {
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
          } ${!isExpandable ? 'invisible' : ''}`}
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

          {/* Show domains for F-groups */}
          {node.type === 'F' && !loadingChildren && children.length === 0 && (
            <div style={{ paddingLeft: `${indent + 28}px` }} className="py-2 space-y-1">
              {loadingDomains ? (
                <span className="text-sm text-gray-400">Loading domains...</span>
              ) : (
                <>
                  {/* Representative domains */}
                  {domains.map(domain => (
                    <div key={domain.uid} className="flex items-center gap-2 py-0.5 group">
                      <span className="w-5 h-5 flex items-center justify-center">
                        <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 8 8">
                          <circle cx="4" cy="4" r="2" />
                        </svg>
                      </span>
                      {domain.isRep && (
                        <span className="px-1 py-0.5 bg-green-100 text-green-700 text-xs rounded" title="Representative">
                          REP
                        </span>
                      )}
                      <span className={`px-1 py-0.5 text-xs rounded ${domainTypeLabels[domain.type]?.bg || 'bg-gray-100'} ${domainTypeLabels[domain.type]?.text || 'text-gray-700'}`}>
                        {domainTypeLabels[domain.type]?.label || domain.type}
                      </span>
                      <Link
                        href={`/domain/${domain.uid}`}
                        className="text-sm font-mono text-blue-600 hover:underline"
                      >
                        {domain.id}
                      </Link>
                      {domain.sourceId && (
                        <span className="text-xs text-gray-400">{domain.sourceId}</span>
                      )}
                      {domain.range && (
                        <span className="text-xs text-gray-400 font-mono">{domain.range}</span>
                      )}
                    </div>
                  ))}

                  {/* Browse all link */}
                  {(totalDomains !== null ? totalDomains : node.domainCount || 0) > 0 && (
                    <Link
                      href={`/search?q=${encodeURIComponent(node.id)}`}
                      className="inline-block mt-1 text-sm text-blue-600 hover:underline"
                    >
                      {domains.length > 0
                        ? `Browse all ${(totalDomains ?? node.domainCount ?? 0).toLocaleString()} domains →`
                        : `Browse ${(totalDomains ?? node.domainCount ?? 0).toLocaleString()} domains →`
                      }
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
