# ECOD Data Structures

TypeScript interfaces for the data structures used in the ECOD application, derived from the PHP templates and handlers.

---

## Domain Data

### Domain (Basic)

From `view_dom_clsrel_clsname`:

```typescript
interface Domain {
  uid: number;
  id: string;              // ECOD domain ID (e.g., "e1a1bA20")
  range: string;           // Domain range (e.g., "A:10-50,B:100-150")
  unp_acc: string | null;  // UniProt accession
  type: 'experimental structure' | 'computed structural model';

  // Classification hierarchy
  xid: string;             // X-group ID (e.g., "1")
  hid: string;             // H-group ID (e.g., "1.1")
  tid: string;             // T-group ID (e.g., "1.1.1")
  fid: string;             // F-group ID (e.g., "1.1.1.1")

  // Classification names
  xname: string;           // X-group name
  hname: string;           // H-group name
  tname: string;           // T-group name
  fname: string;           // F-group name

  // UniProt info (joined)
  name: string | null;     // UniProt short name
  full_name: string | null; // UniProt full name
  gene_name: string | null; // Gene name

  // Representative info
  rep_ecod_uid: number | null; // Representative domain UID

  // Index for ordering
  start_index: number;
}
```

### Domain with PDB Info

From `view_dom_clsrel_pdbinfo`:

```typescript
interface DomainPDB extends Domain {
  pdb_id: string;          // 4-letter PDB ID
  chain_str: string;       // Chain ID(s)
  chain: string[];         // Array of chain IDs
  pdb_range: string;       // Range in PDB numbering

  // PDB chain info (joined)
  resolution: number | null;
  method: string | null;
  pdb_title: string | null;
  deposition_date: string | null;

  // DrugBank links
  drugdomain_acc: string | null;  // Comma-separated accessions
  drugdomain_link: string | null; // Comma-separated URLs
}
```

### Domain with CSM (Computed Structural Model) Info

From `view_dom_clsrel_csminfo`:

```typescript
interface DomainCSM extends Domain {
  af_id: string;           // AlphaFold ID
  version: string;         // AlphaFold version
  mean_plddt: number;      // Mean pLDDT confidence score

  // UniProt info (joined)
  protein_name: string;
  organism: string;
}
```

---

## Cluster Data

### Cluster

```typescript
interface Cluster {
  id: string;              // Cluster ID (e.g., "1.2.3")
  name: string;            // Cluster name
  parent: string | null;   // Parent cluster ID
  type: string;            // Cluster type
  level: 'A' | 'X' | 'H' | 'T' | 'F';

  // Pfam info
  pfam_acc: string | null;

  // Statistics
  domain_count?: number;
}
```

### Cluster Tree Node (for search results)

```typescript
interface ClusterTreeNode {
  id: string;
  name: string;
  label: 'X' | 'H' | 'T' | 'F';
  parents: {
    X: string;
    H: string;
    T: string;
    F: string;
  };
  children: ClusterTreeNode[];
}
```

---

## Search Data

### Search Request

```typescript
interface SearchRequest {
  kw: string;              // Search keyword
  type?: 'uid' | 'id' | 'unp_acc' | 'source_id' | 'keyword';
  page?: number;
  target?: 'domain' | 'cluster';
}
```

### Search Result

```typescript
interface SearchResult {
  domains: DomainSearchResult[];
  clusters?: ClusterTreeNode[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageNums: number[];
  };
  type: string;
  keyword: string;
}
```

### Domain Search Result

```typescript
interface DomainSearchResult {
  uid: number;
  id: string;
  range: string;
  unp_acc: string | null;
  tname: string;
  hname: string;
  xname: string;
  protein_name: string;
}
```

---

## Advanced Search

### Advanced Search Filters

```typescript
interface AdvancedSearchFilters {
  superkingdom: string[];
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  keyword: string;
  ecod_class: string;
  structure_source: 'all' | 'experimental' | 'predicted';
}
```

### Advanced Search Result

```typescript
interface AdvancedSearchResult extends DomainSearchResult {
  type: string;
  source_id: string;
  organism_name: string;
  superkingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
}
```

### Taxonomy Option

```typescript
interface TaxonomyOption {
  value: string;
  count: number;
}
```

### Superkingdom Summary

```typescript
interface SuperkingdomSummary {
  superkingdom: string;
  count: number;
}
```

---

## BLAST Data

### BLAST Job

```typescript
interface BlastJob {
  id: string;              // Job ID
  sequence: string;        // Input sequence
  status: 'queued' | 'running' | 'completed' | 'error';
  progress?: number;
  error?: string;
}
```

### BLAST Result

```typescript
interface BlastResult {
  query_id: string;
  query_length: number;
  hits: BlastHit[];
}

interface BlastHit {
  hit_id: string;
  hit_def: string;
  hit_accession: string;
  hit_length: number;
  hsps: BlastHSP[];
}

interface BlastHSP {
  bit_score: number;
  score: number;
  evalue: number;
  query_from: number;
  query_to: number;
  hit_from: number;
  hit_to: number;
  identity: number;
  positive: number;
  gaps: number;
  align_len: number;
  qseq: string;
  hseq: string;
  midline: string;
}
```

---

## Domain Page Data

### Domain Page Props (Experimental)

```typescript
interface DomainExpPageProps {
  dm: DomainPDB;
  dm_pdb: DomainPDB;

  // Related domains
  dmsChain: DomainPDB[];   // Domains on same chain
  dmsPDB: DomainPDB[];     // All domains in same PDB

  // Names
  name: string;            // PDB chain name
  Aname: string;           // Architecture name

  // UID formatting
  UIDstr: string;          // 9-digit padded UID
  shortUIDstr: string;     // 5-digit middle portion

  // Representative
  rep_id: string | false;

  // UniProt
  unp_acc?: string;
  unp_name?: string;
  unp_full_name?: string;
  unp_gene_name?: string;

  // DrugBank
  drugdomain?: Array<{
    acc: string;
    link: string;
  }>;

  type: 'experimental structure';
}
```

### Domain Page Props (Computed Model)

```typescript
interface DomainCSMPageProps {
  dm: DomainCSM;
  dm_csm: DomainCSM;

  // Related domains
  dmsChain: DomainCSM[];   // Domains on same UniProt
  dmsProtein: DomainCSM[]; // All domains for protein

  // Names
  name: string;            // UniProt name
  Aname: string;           // Architecture name

  // UID formatting
  UIDstr: string;
  shortUIDstr: string;

  // Representative
  rep_id: string | false;

  // UniProt
  unp_acc: string;
  unp_name: string;
  unp_full_name: string;
  unp_gene_name?: string;

  // DrugBank
  drugdomain?: Array<{
    acc: string;
    link: string;
  }>;

  type: 'computed structural model';
}
```

---

## Tree View Data

### Tree Node

```typescript
interface TreeNode {
  id: string;
  name: string;
  level: 'A' | 'X' | 'H' | 'T' | 'F' | 'S';
  parent?: string;
  childCount?: number;
  domainCount?: number;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: TreeNode[];
}
```

### Tree Load Response (AJAX)

```typescript
interface TreeLoadResponse {
  html: string;            // Pre-rendered HTML (legacy)
  // Or for modern API:
  nodes: TreeNode[];
  pagination?: {
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}
```

---

## Distribution Data

### Version Info

```typescript
interface VersionInfo {
  version: string;
  date: string;
  domain_count: number;
  family_count: number;
  pdb_count: number;
  downloads: {
    full: string;
    f40: string;
    f70: string;
    f99: string;
  };
}
```

### Statistics

```typescript
interface Statistics {
  total_domains: number;
  total_families: number;
  total_pdbs: number;
  by_superkingdom: SuperkingdomSummary[];
  by_structure_type: {
    experimental: number;
    computed: number;
  };
}
```

---

## File Download Data

### Structure Download

```typescript
interface StructureDownload {
  uid: number;
  format: 'pdb' | 'cif';
  filename: string;
  content: string;
}
```

### Sequence Download

```typescript
interface SequenceDownload {
  uid: number;
  format: 'fasta';
  filename: string;
  header: string;
  sequence: string;
}
```

### PyMOL Script

```typescript
interface PymolScript {
  uid: number;
  filename: string;
  script: string;
  selection: string;
  chains: string[];
}
```

---

## API Response Types

### Generic API Response

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
```

### Domain API Response

```typescript
type DomainResponse = ApiResponse<DomainPDB | DomainCSM>;
type DomainsListResponse = ApiResponse<(DomainPDB | DomainCSM)[]>;
```

### Cluster API Response

```typescript
type ClusterResponse = ApiResponse<Cluster>;
type ClusterChildrenResponse = ApiResponse<Cluster[]>;
```

### Search API Response

```typescript
type SearchResponse = ApiResponse<{
  domains: DomainSearchResult[];
  clusters: ClusterTreeNode[];
}>;
```

---

## React Component Props

### TreeView Props

```typescript
interface TreeViewProps {
  initialId?: string;      // Initial expanded node
  onSelectDomain?: (uid: number) => void;
  onSelectCluster?: (id: string) => void;
}
```

### DomainCard Props

```typescript
interface DomainCardProps {
  domain: Domain;
  showClassification?: boolean;
  showProteinName?: boolean;
  compact?: boolean;
}
```

### StructureViewer Props

```typescript
interface StructureViewerProps {
  uid: number;
  type: 'experimental' | 'computed';
  range: string;
  highlightDomain?: boolean;
  showPlddt?: boolean;
  width?: number;
  height?: number;
}
```

### SearchBar Props

```typescript
interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string, type?: string) => void;
  showTypeSelector?: boolean;
}
```

---

*Data structures for ECOD NextJS/React migration*
