'use client';

import { useRef, useEffect, useState } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface DomainInfo {
  range: string;
  id?: string;
  colorIndex?: number;  // For PDB view: explicit color index
}

interface StructureViewerProps {
  uid?: number;           // Domain UID - for loading pre-cut domain PDB
  pdbId?: string | null;
  afId?: string | null;   // AlphaFold UniProt ID
  chainId?: string | null;
  range?: string | null;
  domainId?: string;
  ligandResidues?: string | null;  // e.g., "B:401,B:402,B:404"
  domains?: DomainInfo[];  // For protein/PDB view: array of domains with ranges
  nucleicAcidChains?: string[];  // Chain IDs that are RNA/DNA
  showLigands?: boolean;   // Show all ligands/cofactors (default: false)
  showNucleicAcids?: boolean;  // Show RNA/DNA (default: false)
  className?: string;
}

export default function StructureViewer({
  uid,
  pdbId,
  afId,
  chainId,
  range,
  domainId,
  ligandResidues,
  domains,
  nucleicAcidChains,
  showLigands = false,
  showNucleicAcids = false,
  className = '',
}: StructureViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountTime, setMountTime] = useState<number | null>(null);  // Client-only timestamp
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { resolvedTheme } = useTheme();

  // Generate timestamp on client side only to avoid hydration mismatch
  useEffect(() => {
    setMountTime(Date.now());
  }, []);

  // Build viewer URL with parameters (null until client-side timestamp is set)
  const viewerUrl = mountTime ? buildViewerUrl({ uid, pdbId, afId, chainId, range, domainId, ligandResidues, domains, nucleicAcidChains, showLigands, showNucleicAcids }, mountTime, resolvedTheme) : null;

  // Reset loading state when URL changes (skip initial null -> value transition)
  useEffect(() => {
    if (viewerUrl) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [viewerUrl]);

  function buildViewerUrl(
    props: StructureViewerProps,
    timestamp: number,
    theme: 'light' | 'dark'
  ): string | null {
    const { uid, pdbId, afId, chainId, range, domainId, ligandResidues, domains, nucleicAcidChains, showLigands, showNucleicAcids } = props;
    // Need either UID (for domain PDB) or pdbId/afId (for full structure)
    if (!uid && !pdbId && !afId) return null;

    const params = new URLSearchParams();
    params.set('theme', theme);

    if (uid) {
      params.set('uid', uid.toString());
    }
    if (pdbId) {
      params.set('pdb', pdbId);
    }
    if (afId) {
      params.set('af', afId);
    }
    if (chainId) {
      params.set('chain', chainId);
    }
    if (range) {
      params.set('range', range);
    }
    if (domainId) {
      params.set('domain', domainId);
    }
    if (ligandResidues) {
      params.set('ligands', ligandResidues);
    }
    if (domains && domains.length > 0) {
      // Pass domains as JSON for protein/PDB view multi-coloring
      params.set('domains', JSON.stringify(domains));
    }
    if (nucleicAcidChains && nucleicAcidChains.length > 0) {
      params.set('naChains', nucleicAcidChains.join(','));
    }
    if (showLigands) {
      params.set('showLigands', 'true');
    }
    if (showNucleicAcids) {
      params.set('showNucleicAcids', 'true');
    }

    // Add cache-busting timestamp to prevent stale iframe content
    params.set('_t', timestamp.toString());
    return `/viewer/index.html?${params.toString()}`;
  }

  // Handle iframe load events and cleanup
  useEffect(() => {
    if (!viewerUrl) return;  // Skip if URL not ready yet

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);

      // Signal viewer to cleanup on unmount
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { target: 'ecod-viewer', action: 'destroy' },
          '*'
        );
      }
    };
  }, [viewerUrl]);  // Re-run when URL changes

  // Send commands to the viewer
  const sendCommand = (action: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { target: 'ecod-viewer', action },
        '*'
      );
    }
  };

  // Show loading during SSR/hydration (before mountTime is set)
  if (!mountTime) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Loading viewer...</p>
        </div>
      </div>
    );
  }

  if (!viewerUrl) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center ${className}`}>
        <p className="text-gray-400">No structure available</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 mb-2">Failed to load structure viewer</p>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 rounded flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading viewer...</p>
          </div>
        </div>
      )}

      {/* Viewer iframe - key forces recreation on URL change */}
      <iframe
        key={viewerUrl}
        ref={iframeRef}
        src={viewerUrl}
        className="w-full h-full rounded border-0"
        title="3D Structure Viewer"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* External controls (optional, viewer has its own) */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => sendCommand('reset')}
          className="p-1.5 bg-white/90 hover:bg-white rounded border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          title="Reset view"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        {pdbId && (
          <a
            href={`https://www.rcsb.org/3d-view/${pdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-white/90 hover:bg-white rounded border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            title="Open in RCSB PDB"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
