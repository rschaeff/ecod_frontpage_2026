# ECOD Implementation Details

Specific implementation patterns and configurations extracted from the PHP codebase.

---

## Configuration Constants

### Database Connection

```
Host: asteria
Port: 45000
Database: ecod_af2_pdb
User: ecodweb
Password: serveruse421
Connect timeout: 10 seconds
```

**NextJS .env.local equivalent:**
```env
DATABASE_URL="postgresql://ecodweb:serveruse421@asteria:45000/ecod_af2_pdb?connect_timeout=10"
```

### File Paths

| Setting | Path | Purpose |
|---------|------|---------|
| `data_dir` | `/usr1/ECOD/html/af2_pdb_d/` | Domain structure files |
| `dist_dir` | `/usr1/ECOD/html/distributions/` | Bulk download files |
| `stat_path` | `/usr1/ECOD/html/statistics/ga_statistics.json` | Analytics data |
| `stat_city_path` | `/usr1/ECOD/html/statistics/ga_city.json` | City analytics |
| `stat_state_path` | `/usr1/ECOD/html/statistics/ga_state.json` | State analytics |
| `stat_country_path` | `/usr1/ECOD/html/statistics/ga_country.json` | Country analytics |
| `stat_visit_path` | `/usr1/ECOD/html/statistics/total_visitors` | Total visitor count |
| `tmp` | `./tmpdata/` | Temporary files (BLAST results) |

### PDB File Locations

```
# Primary PDB path
/usr2/PDB/all/pdb{pdb_id}.ent

# Gzipped PDB path
/usr2/pdb/data/structures/divided/pdb/{mid2}/pdb{pdb_id}.ent.gz

# mmCIF path (fallback)
/usr2/pdb/data/structures/divided/mmCIF/{mid2}/{pdb_id}.cif.gz
```

Where `{mid2}` = middle 2 characters of PDB ID (e.g., `1abc` → `ab`)

### AlphaFold Structure Paths

```
/data/ecod/af2_structures/human/ecod/{unp_acc}_F1/AF-{unp_acc}-F1-model_v1.pdb
```

---

## Utility Functions (TypeScript Equivalents)

### Level Label Detection

```typescript
const SPECIAL_CATEGORIES = [
  'coil', 'peptide', 'pss', 'synthetic', 'nonpeptide_poly',
  'mcc', 'linker', 'unstructured', 'fragment'
];

type HierarchyLevel = 'A' | 'X' | 'H' | 'T' | 'F' | 'R' | 'S';

function levelLabel(id: string): HierarchyLevel {
  if (id.startsWith('a')) {
    return 'A';
  }

  if (SPECIAL_CATEGORIES.includes(id)) {
    return 'S';
  }

  const dotCount = (id.match(/\./g) || []).length;

  switch (dotCount) {
    case 0:
      return id.startsWith('r') ? 'R' : 'X';
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
```

### Level Parents

```typescript
interface LevelParents {
  X: string;
  H: string;
  T: string;
  F: string;
}

function levelParents(id: string): LevelParents {
  const parts = id.split('.');

  switch (parts.length) {
    case 1:
      return { X: '', H: '', T: '', F: '' };
    case 2:
      return { X: parts[0], H: '', T: '', F: '' };
    case 3:
      return {
        X: parts[0],
        H: `${parts[0]}.${parts[1]}`,
        T: '',
        F: ''
      };
    case 4:
      return {
        X: parts[0],
        H: `${parts[0]}.${parts[1]}`,
        T: `${parts[0]}.${parts[1]}.${parts[2]}`,
        F: ''
      };
    default:
      return { X: '', H: '', T: '', F: '' };
  }
}
```

### Pad UID

```typescript
function padUID(uid: number): string {
  return uid.toString().padStart(9, '0');
}
```

### PyMOL Selection Parser

```typescript
interface PymolSelection {
  selection: string;
  chainSelection: string;
  chains: string[];
}

function getPymolSelection(range: string): PymolSelection {
  let selection = '';
  const chains: string[] = [];
  let chainSelection = '';

  const contigs = range.split(',');

  for (const contig of contigs) {
    // Pattern: [chain:]start-end (e.g., "A:10-50" or "10-50")
    const match = contig.match(/(?:([A-Za-z0-9]{1,4}):)?(-?[0-9]+[A-Z]?)-(-?[0-9]+[A-Z]?)/);

    if (match) {
      const chain = match[1] || 'A';
      const start = match[2].startsWith('-') ? `\\${match[2]}` : match[2];
      const end = match[3].startsWith('-') ? `\\${match[3]}` : match[3];

      const seg = `c. ${chain} & i. ${start}-${end}`;
      selection = selection ? `${selection} | ${seg}` : seg;

      if (!chains.includes(chain)) {
        chains.push(chain);
        const chainSeg = `c. ${chain}`;
        chainSelection = chainSelection ? `${chainSelection} | ${chainSeg}` : chainSeg;
      }
    }
  }

  return { selection, chainSelection, chains };
}
```

### PyMOL Colors

```typescript
const PYMOL_COLORS = [
  'red', 'green', 'blue', 'yellow', 'magenta', 'cyan',
  'orange', 'wheat', 'palegreen', 'lightblue', 'paleyellow',
  'lightpink', 'palecyan', 'lightorange', 'bluewhite'
];

function pymolColor(index: number): string {
  return PYMOL_COLORS[index % PYMOL_COLORS.length];
}
```

### Read PDB File

```typescript
import { readFileSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';

interface PDBContent {
  content: string;
  format: 'pdb' | 'cif';
}

function readPDB(pdbId: string): PDBContent | null {
  const pdb = pdbId.toLowerCase();
  const mid2 = pdb.slice(1, 3);

  // Try paths in order
  const paths = [
    { path: `/usr2/PDB/all/pdb${pdb}.ent`, format: 'pdb' as const, gz: false },
    { path: `/usr2/pdb/data/structures/divided/pdb/${mid2}/pdb${pdb}.ent.gz`, format: 'pdb' as const, gz: true },
    { path: `/usr2/pdb/data/structures/divided/mmCIF/${mid2}/${pdb}.cif.gz`, format: 'cif' as const, gz: true },
  ];

  for (const { path, format, gz } of paths) {
    if (existsSync(path)) {
      const raw = readFileSync(path);
      const content = gz ? gunzipSync(raw).toString() : raw.toString();
      return { content, format };
    }
  }

  return null;
}
```

---

## Route Handlers

### Active Routes (from index.php)

| Route | Method | Handler | Notes |
|-------|--------|---------|-------|
| `/` | GET | `MainPage->treeView` | Home page |
| `/tree` | GET | `MainPage->treeView` | Tree alias |
| `/load` | GET | `Load->ajaxLoad` | AJAX lazy load |
| `/pic` | GET | `pic->domainPic` | Domain images |
| `/distribution` | GET | `Distribution->page` | Downloads |
| `/documentation` | GET | `Documentation->page` | Help |
| `/search/blast` | POST | `Search->searchBLAST` | BLAST submit |
| `/search/advanced` | GET | `Search->advancedSearchPage` | Taxonomy form |
| `/search/advanced` | POST | `Search->advancedSearchExecute` | Taxonomy search |
| `/search/taxa` | GET | `Search->getTaxonomyOptions` | Taxonomy autocomplete |
| `/search` | GET/POST | `Search->searchAll` | General search |
| `/domain/@id` | GET | `Domain->domainPage` | Domain detail |
| `/blast/@id` | GET [ajax] | `Blast->check` | BLAST status |
| `/blast/@id` | GET | `Blast->resultPage` | BLAST results |
| `/pymol` | GET | `Pymol->download` | PyMOL script |
| `/pymol/preset` | GET | `Pymol->downloadPreset` | PyMOL preset |
| `/pymol/conservation` | GET | `ConservationPymol->download` | Conservation coloring |
| `/structure` | GET | `Structure->download` | PDB download |
| `/sequence` | GET | `Sequence->download` | FASTA download |

### Commented/Disabled Routes

These routes exist but are currently disabled:

- `/famtree` - Family tree visualization
- `/user-statistics` - User statistics page
- `/search/tmalign` - TM-align structural search
- `/family/@id` - Family page
- `/family/@id/alignment` - Family alignment
- `/family/@id/taxa` - Family taxonomy data
- `/tmalign/*` - TM-align routes
- `/mustang/*` - MUSTANG alignment routes
- `/pymol/contact` - Contact map
- `/pdb/@pdbid` - PDB download by ID
- `/network` - Network view
- `/component/@compid` - Component page

---

## Search Patterns

### UID Detection

```typescript
// 6-9 digit numeric string
function isUID(query: string): boolean {
  return /^\d{6,9}$/.test(query);
}
```

### Domain ID Detection

```typescript
// Pattern: e[pdb_id][chain][range_num]
// Example: e1a1bA20
function isDomainId(query: string): boolean {
  return /^e[0-9a-z]{4}[A-Za-z0-9]+\d+$/i.test(query);
}
```

### PDB ID Detection

```typescript
// 4-character alphanumeric
function isPdbId(query: string): boolean {
  return /^[0-9][a-z0-9]{3}$/i.test(query);
}
```

### UniProt Accession Detection

```typescript
// UniProt accession pattern
function isUnpAcc(query: string): boolean {
  return /^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/i.test(query);
}
```

---

## BLAST Integration

### Job Directory Structure

```
/tmpdata/blast{job_id}/
├── query.fasta      # Input sequence
├── blast.xml        # BLAST output (XML format)
├── blast.log        # Execution log
└── status.json      # Job status
```

### BLAST Score Color Coding

| Score Range | Color | Hex |
|-------------|-------|-----|
| > 200 | Red | `#FF0000` |
| 80-200 | Purple | `#800080` |
| 50-80 | Green | `#008000` |
| 40-50 | Blue | `#0000FF` |
| < 40 | Black | `#000000` |

```typescript
function blastScoreColor(bitScore: number): string {
  if (bitScore > 200) return '#FF0000';
  if (bitScore >= 80) return '#800080';
  if (bitScore >= 50) return '#008000';
  if (bitScore >= 40) return '#0000FF';
  return '#000000';
}
```

---

## Execution Timeouts

| Context | Timeout (seconds) |
|---------|-------------------|
| Global default | 120 |
| MainPage/Domain | 30 |
| Search | 60 |
| Load/AJAX | 30 |
| BLAST parsing | 60 |

```typescript
// Next.js API route config example
export const config = {
  maxDuration: 30, // seconds
};
```

---

## Special Categories

The ECOD classification includes special categories for non-standard domain types:

| Category | Description |
|----------|-------------|
| `coil` | Coiled-coil regions |
| `peptide` | Small peptides |
| `pss` | Protein secondary structure |
| `synthetic` | Synthetic constructs |
| `nonpeptide_poly` | Non-peptide polymers |
| `mcc` | Multi-chain complex |
| `linker` | Linker regions |
| `unstructured` | Unstructured regions |
| `fragment` | Structural fragments |

---

## Browser Detection

The PHP site detects browsers for content negotiation:

```typescript
const BROWSER_PREFIXES = [
  'Mozilla/', 'Opera/', 'Lynx/', 'Links ', 'Elinks ', 'ELinks/',
  'Midori/', 'w3m/', 'Webkit/', 'Vimprobable/', 'Dooble/',
  'Dillo/', 'Surf/', 'NetSurf/', 'Galaxy/', 'Cyberdog/',
  'iCab/', 'IBrowse/', 'IBM WebExplorer /', 'AmigaVoyager/',
  'HotJava/', 'retawq/', 'uzbl ', 'Uzbl ', 'NCSA Mosaic/',
  'NCSA_Mosaic/'
];

function isBrowser(userAgent: string): boolean {
  if (!userAgent) return false;
  return BROWSER_PREFIXES.some(prefix => userAgent.startsWith(prefix))
    || userAgent === 'WorldWideweb (NEXT)';
}
```

---

## HTTP Cache Headers

Example cache header implementation:

```typescript
// Next.js API route
export async function GET(request: Request) {
  // Domain data - cache for 24 hours
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'application/json',
    },
  });
}

// Structure files - cache for 1 year (immutable)
export async function GET(request: Request) {
  return new Response(pdbContent, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'chemical/x-pdb',
      'Content-Disposition': `attachment; filename="${pdbId}.pdb"`,
    },
  });
}
```

---

*Implementation details for ECOD NextJS/React migration*
