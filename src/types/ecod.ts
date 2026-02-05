/**
 * ECOD Type Definitions
 *
 * Types for the Evolutionary Classification of Protein Domains database
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type DomainType = 'experimental structure' | 'computed structural model';

export type HierarchyLevel = 'A' | 'X' | 'H' | 'T' | 'F' | 'R' | 'S';

export const SPECIAL_CATEGORIES = [
  'coil',
  'peptide',
  'pss',
  'synthetic',
  'nonpeptide_poly',
  'mcc',
  'linker',
  'unstructured',
  'fragment',
] as const;

export type SpecialCategory = (typeof SPECIAL_CATEGORIES)[number];

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Base domain from view_dom_clsrel_clsname
 */
export interface Domain {
  uid: number;
  id: string; // ECOD domain ID (e.g., "e1a1bA20")
  range: string; // Domain range (e.g., "A:10-50,B:100-150")
  type: DomainType;
  unp_acc: string | null;

  // Classification hierarchy IDs
  xid: string;
  hid: string;
  tid: string;
  fid: string;

  // Classification names
  xname: string;
  hname: string;
  tname: string;
  fname: string;

  // UniProt info
  name: string | null;
  full_name: string | null;
  gene_name: string | null;

  // Representative
  rep_ecod_uid: number | null;
  is_rep: boolean;

  // Ordering
  start_index: number;
}

/**
 * Domain with PDB info from view_dom_clsrel_pdbinfo
 */
export interface DomainPDB extends Domain {
  pdb_id: string;
  chain_str: string;
  pdb_range: string;
  source_id: string;

  // PDB chain info
  resolution: number | null;
  method: string | null;
  pdb_title: string | null;
  deposition_date: string | null;

  // DrugBank links
  drugdomain_acc: string | null;
  drugdomain_link: string | null;
}

/**
 * Domain with computed structure model info from view_dom_clsrel_csminfo
 */
export interface DomainCSM extends Domain {
  af_id: string;
  version: string;
  mean_plddt: number;
  source_id: string;

  // UniProt details
  protein_name: string;
  organism: string;
}

/**
 * Union type for any domain
 */
export type AnyDomain = DomainPDB | DomainCSM;

// ============================================================================
// Cluster Types
// ============================================================================

/**
 * Classification cluster/group
 */
export interface Cluster {
  id: string;
  name: string;
  parent: string | null;
  type: string;
  level: HierarchyLevel;
  pfam_acc: string | null;
  comment: string | null;
  domain_count?: number;
}

/**
 * Architecture (top-level classification)
 */
export interface Architecture {
  id: string;
  name: string;
  comment: string | null;
}

/**
 * Tree node for hierarchical display
 */
export interface TreeNode {
  id: string;
  name: string;
  level: HierarchyLevel;
  parent?: string;
  childCount?: number;
  domainCount?: number;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: TreeNode[];
}

// ============================================================================
// Search Types
// ============================================================================

export type SearchType = 'uid' | 'id' | 'unp_acc' | 'pdb_id' | 'keyword';

export interface SearchRequest {
  query: string;
  type?: SearchType;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  uid: number;
  id: string;
  type: DomainType;
  range: string;
  unp_acc: string | null;
  source_id: string;
  xname: string;
  hname: string;
  tname: string;
  fname: string;
  protein_name: string | null;
  relevance?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  clusters?: ClusterSearchResult[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ClusterSearchResult {
  id: string;
  name: string;
  level: HierarchyLevel;
  parent: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface ECODStats {
  version: string;
  updateDate: string;
  totalDomains: number;
  totalFamilies: number;
  experimentalDomains: number;
  computedDomains: number;
  totalPDBs: number;
  totalProteins: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine hierarchy level from cluster ID
 */
export function getLevelFromId(id: string): HierarchyLevel {
  if (id.startsWith('a')) return 'A';
  if (SPECIAL_CATEGORIES.includes(id as SpecialCategory)) return 'S';
  if (id.startsWith('r')) return 'R';

  const dotCount = (id.match(/\./g) || []).length;
  switch (dotCount) {
    case 0:
      return 'X';
    case 1:
      return 'H';
    case 2:
      return 'T';
    case 3:
      return 'F';
    default:
      return 'X';
  }
}

/**
 * Get parent IDs for a cluster ID
 */
export function getParentIds(id: string): { X: string; H: string; T: string; F: string } {
  const parts = id.split('.');
  const result = { X: '', H: '', T: '', F: '' };

  if (parts.length >= 1) result.X = parts[0];
  if (parts.length >= 2) result.H = `${parts[0]}.${parts[1]}`;
  if (parts.length >= 3) result.T = `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (parts.length >= 4) result.F = id;

  return result;
}

/**
 * Pad UID to 9-digit string
 */
export function padUID(uid: number): string {
  return uid.toString().padStart(9, '0');
}

/**
 * Get short UID (middle 5 digits) for file paths
 */
export function getShortUID(uid: number): string {
  return padUID(uid).slice(2, 7);
}

/**
 * Check if domain is experimental (PDB) structure
 */
export function isExperimental(domain: Domain): domain is DomainPDB {
  return domain.type === 'experimental structure';
}

/**
 * Check if domain is computed (AlphaFold) model
 */
export function isComputed(domain: Domain): domain is DomainCSM {
  return domain.type === 'computed structural model';
}

/**
 * Parse range string to PyMOL selection
 */
export function rangeToSelection(range: string): {
  selection: string;
  chains: string[];
} {
  const chains: string[] = [];
  const parts: string[] = [];

  for (const contig of range.split(',')) {
    const match = contig.match(/(?:([A-Za-z0-9]{1,4}):)?(-?\d+[A-Z]?)-(-?\d+[A-Z]?)/);
    if (match) {
      const chain = match[1] || 'A';
      const start = match[2].startsWith('-') ? `\\${match[2]}` : match[2];
      const end = match[3].startsWith('-') ? `\\${match[3]}` : match[3];

      parts.push(`c. ${chain} & i. ${start}-${end}`);
      if (!chains.includes(chain)) chains.push(chain);
    }
  }

  return {
    selection: parts.join(' | '),
    chains,
  };
}
