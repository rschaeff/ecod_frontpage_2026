# ECOD Legacy PHP Website Analysis

**Analysis Date**: 2026-02-05
**Source Location**: `/data/ECOD0/html/af2_pdb`
**Purpose**: Document existing production website to inform NextJS/React replacement

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Routing & Entry Points](#routing--entry-points)
5. [Database Architecture](#database-architecture)
6. [ECOD Classification Hierarchy](#ecod-classification-hierarchy)
7. [Core Features](#core-features)
8. [Template System](#template-system)
9. [Frontend Assets](#frontend-assets)
10. [API & AJAX Endpoints](#api--ajax-endpoints)
11. [Caching Strategy](#caching-strategy)
12. [Configuration](#configuration)
13. [Migration Recommendations](#migration-recommendations)

---

## Overview

The ECOD (Evolutionary Classification of Protein Domains) website provides a hierarchical classification browser for protein domains. The current production site is built on the Fat-Free Framework (F3), a lightweight PHP MVC framework, with PostgreSQL as the backend database.

The site serves two primary types of domain structures:
- **Experimental structures** from the Protein Data Bank (PDB)
- **Computed structural models** from AlphaFold (AF2)

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Fat-Free Framework (F3) | 3.0.6 |
| Language | PHP | 7.x+ |
| Database | PostgreSQL | 9.x+ |
| Web Server | Apache | 2.x |
| Frontend | jQuery | 1.10.2 |
| UI Components | jQuery UI | 1.10.3 |
| 3D Viewer | JSmol/Jmol | HTML5 |
| Lightbox | FancyBox | 2.1.5 |
| Analytics | Google Analytics | UA-56484349-1 |

---

## Directory Structure

```
/data/ECOD0/html/af2_pdb/
├── index.php                 # Entry point, routing & configuration
├── jmol.php                  # Legacy Jmol viewer
├── .htaccess                 # Apache rewrite rules
├── cleanup_tmpdata.sh        # Maintenance script for temp files
│
├── lib/                      # Core framework and utilities
│   ├── base.php              # Fat-Free Framework core
│   ├── db/                   # Database layer
│   │   ├── sql.php           # PDO wrapper for PostgreSQL
│   │   ├── sql/mapper.php    # ORM mapper
│   │   └── sql/session.php   # Session management
│   ├── template.php          # Template engine
│   ├── web.php               # HTTP utilities
│   ├── auth.php              # Authentication
│   ├── session.php           # Session handling
│   ├── audit.php             # Activity logging
│   ├── image.php             # Image processing
│   ├── markdown.php          # Markdown parsing
│   └── matrix.php            # Matrix operations
│
├── handles/                  # Route handlers (controllers)
│   ├── MainPage.php          # Tree view rendering
│   ├── Domain.php            # Domain page display
│   ├── Search.php            # Search functionality
│   ├── Load.php              # AJAX tree/cluster loading
│   ├── Blast.php             # BLAST search implementation
│   ├── Structure.php         # PDB file download
│   ├── Sequence.php          # FASTA download
│   ├── Pymol.php             # PyMOL script generation
│   ├── Distribution.php      # Download page & statistics
│   ├── Documentation.php     # Help/documentation
│   ├── pic.php               # Image serving
│   ├── famtree.php           # Family tree visualization
│   └── utils.php             # Shared utility functions
│
├── views/                    # HTML templates (F3 syntax)
│   ├── treeView.htm          # Main tree navigation
│   ├── domain_exp.htm        # Experimental structure domain page
│   ├── domain_csm.htm        # Computed model domain page
│   ├── loadCluster.htm       # Cluster group rendering
│   ├── loadDomain.htm        # Domain listing
│   ├── searchWrapper.htm     # Search results wrapper
│   ├── blastWrapper.htm      # BLAST results
│   ├── header.htm            # Navigation header
│   └── [additional templates]
│
├── css/                      # Stylesheets (~668 lines total)
│   ├── mainnew.css           # Main tree styles (290 lines)
│   ├── domain.css            # Domain page styles (66 lines)
│   ├── base.css              # Base styles (74 lines)
│   ├── search.css            # Search results styles (53 lines)
│   ├── group.css             # Cluster group styling (61 lines)
│   ├── af2_pdb_main.css      # Main page overrides (71 lines)
│   └── statistics.css        # Analytics page (47 lines)
│
├── js/                       # JavaScript (~827 lines total)
│   ├── tools.js              # Core tree/UI functionality (120 lines)
│   ├── domain.js             # Domain page interactions (86 lines)
│   ├── group.js              # Group/cluster operations (137 lines)
│   ├── assignment.js         # Structure assignment UI (277 lines)
│   ├── glmolhelper.js        # GLmol helper functions (143 lines)
│   └── bb.js                 # Backbone interactions (64 lines)
│
├── tmpdata/                  # Temporary files
│   └── blast*/               # BLAST result directories
│
└── backups/                  # Backup folder
```

---

## Routing & Entry Points

### Main Routes (index.php)

| Route | Handler | Method | Purpose |
|-------|---------|--------|---------|
| `/` | `MainPage->treeView` | GET | Tree view home page |
| `/tree` | `MainPage->treeView` | GET | Tree navigation |
| `/load` | `Load->ajaxLoad` | GET | AJAX tree node loading |
| `/domain/@id` | `Domain->domainPage` | GET | Individual domain page |
| `/search` | `Search->searchAll` | GET | Search interface |
| `/search/blast` | `Search->searchBLAST` | POST | BLAST search submission |
| `/search/advanced` | `Search->advancedSearchPage` | GET | Taxonomy search form |
| `/search/advanced` | `Search->advancedSearchExecute` | POST | Execute advanced search |
| `/blast/@id` | `Blast->check` | GET [ajax] | BLAST status check |
| `/blast/@id` | `Blast->resultPage` | GET | BLAST results page |
| `/distribution` | `Distribution->page` | GET | Download/distribution page |
| `/documentation` | `Documentation->page` | GET | Help documentation |
| `/pymol` | `Pymol->download` | GET | PyMOL script download |
| `/pymol/preset` | `Pymol->downloadPreset` | GET | PyMOL preset |
| `/structure` | `Structure->download` | GET | PDB file download |
| `/sequence` | `Sequence->download` | GET | FASTA sequence download |
| `/pic` | `pic->domainPic` | GET | Domain structure image |

### URL Rewriting (.htaccess)

```apache
Options -Indexes
Options +FollowSymLinks
RewriteEngine On
RewriteBase /ecod/af2_pdb/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule .* index.php [L,QSA]
```

---

## Database Architecture

### Connection Configuration

```php
$f3->set('db_path', 'pgsql:host=asteria;port=45000;dbname=ecod_af2_pdb');
$f3->set('db_user', 'ecodweb');  // Read-only web access
$f3->set('db_pass', '***');
```

### Key Database Views

| View | Purpose |
|------|---------|
| `view_dom_clsrel_clsname` | Joined domain/cluster/taxonomy view |
| `view_dom_clsrel_pdbinfo` | Domain with PDB chain info |
| `view_dom_clsrel_csminfo` | Domain with computed structure info |

### Core Tables

| Table | Purpose |
|-------|---------|
| `domain` | Core domain records |
| `cluster` | Hierarchical classification (A/X/H/T/F levels) |
| `domain_pdb` | PDB experimental structure links |
| `pdb_chain_info` | PDB chain metadata |
| `unp_info` | UniProt information |
| `special` | Special domain categories |

### Query Patterns

```php
// Using Fat-Free ORM Mapper
$db = new DB\SQL($f3->get('db_path'));
$mapper = new DB\SQL\Mapper($db, 'table_name');
$mapper->load(array('condition=?', $value));

// Direct queries with pagination
$results = $db->exec('
    SELECT *, COUNT(*) OVER() as total_count
    FROM view_dom_clsrel_clsname
    WHERE cluster_id = ?
    LIMIT 20 OFFSET ?
', [$cluster_id, $offset]);
```

---

## ECOD Classification Hierarchy

### Hierarchy Levels

| Level | Code | Name | Description |
|-------|------|------|-------------|
| 1 | **A** | Architecture | Root level, protein folds |
| 2 | **X** | Possible Homology | Secondary grouping |
| 3 | **H** | Homology | Tertiary, confirmed homologous |
| 4 | **T** | Topology | Domain family groups |
| 5 | **F** | Family | Individual domain families |
| 6 | **R** | Representative | Representative domain instances |
| - | **Special** | Special | Peptides, coils, fragments, etc. |

### ID Formats

| Type | Format | Example |
|------|--------|---------|
| Hierarchical ID | `A.X.H.T.F` | `1.2.3.4.5` |
| Domain ID | `e[pdb][chain][range]` | `e1a1bA20` |
| UID | 9-digit padded | `000123456` |

### Hierarchy Navigation Functions

```php
// Determine level from ID
function levelLabel($id) {
    $depth = substr_count($id, '.');
    return ['A', 'X', 'H', 'T', 'F'][$depth] ?? 'R';
}

// Get parent IDs
function levelParents($id) {
    $parts = explode('.', $id);
    $parents = [];
    for ($i = 1; $i <= count($parts); $i++) {
        $parents[] = implode('.', array_slice($parts, 0, $i));
    }
    return $parents;
}
```

---

## Core Features

### 1. Tree Navigation

**Files**: `handles/MainPage.php`, `handles/Load.php`, `views/treeView.htm`, `js/tools.js`

- Collapsible hierarchy with lazy loading
- AJAX-based cluster loading via `/load` endpoint
- Toggle expand/collapse with animated arrows
- Synchronized highlighting for selected domains
- Deep-linking support via URL parameters

**JavaScript API**:
```javascript
function toggleCluster(id) {
    // Expand/collapse cluster node
    // Loads children via AJAX if not cached
}

function loadDomains(clusterId, page) {
    // Load paginated domain list for cluster
}
```

### 2. Domain Pages

**Files**: `handles/Domain.php`, `views/domain_exp.htm`, `views/domain_csm.htm`

Two templates based on structure type:
- `domain_exp.htm` - Experimental PDB structures
- `domain_csm.htm` - AlphaFold computed structural models

**Content Sections**:
- Domain metadata (UID, classification, UniProt)
- 3D structure visualization (JSmol/Jmol HTML5)
- Related domains in same protein
- External links (PDB, AFDB, UniProt)
- Image thumbnails (domain, chain context, pLDDT confidence)

### 3. Search Functionality

**Files**: `handles/Search.php`, `views/searchWrapper.htm`

**Search Types**:
| Type | Pattern | Example |
|------|---------|---------|
| UID | 6-9 digit numeric | `123456789` |
| Domain ID | `e[pdb][chain][range]` | `e1a1bA20` |
| UniProt | Accession pattern | `P12345` |
| PDB ID | 4-character | `1A1B` |
| Keyword | Full-text (TSVECTOR) | `kinase domain` |

**Advanced Search**: Taxonomic filtering with species selection

**Pagination**: 20 results per page with COUNT(*) OVER() for total

### 4. BLAST Integration

**Files**: `handles/Blast.php`, `views/blastWrapper.htm`, `views/blastTemplate.htm`

- Queue-based BLAST job submission
- Results stored in `/tmpdata/blast[ID]/`
- XML parsing of BLAST output
- Color-coded bit scores:
  - Red: >200
  - Purple: 80-200
  - Green: 50-80
  - Blue: 40-50
  - Black: <40
- Alignment visualization with formatted output

### 5. File Downloads

**Files**: `handles/Structure.php`, `handles/Sequence.php`, `handles/Pymol.php`

| Endpoint | Type | Content-Type |
|----------|------|--------------|
| `/structure?uid=X` | PDB coordinates | `chemical/x-pdb` |
| `/sequence?uid=X` | FASTA sequence | `text/plain` |
| `/pymol?uid=X` | PyMOL script | `application/x-pymol` |

**Data Directories**:
```php
$f3->set('data_dir', '/usr1/ECOD/html/af2_pdb_d/');  // Domain structures
$f3->set('dist_dir', '/usr1/ECOD/html/distributions/'); // Bulk downloads
```

### 6. Distribution Page

**Files**: `handles/Distribution.php`, `views/distribution.htm`

- Version history from `stats.txt`
- Filtered domain sets (F40, F70, F99)
- Bulk download availability
- Statistics display

---

## Template System

### F3 Template Syntax

| Tag | Purpose | Example |
|-----|---------|---------|
| `<check if="">` | Conditional | `<check if="{{ @count > 0 }}">` |
| `<true>` / `<false>` | Conditional branches | Nested in `<check>` |
| `<repeat group="" value="">` | Loop | `<repeat group="{{ @items }}" value="{{ @item }}">` |
| `<include href="">` | Include template | `<include href="header.htm">` |
| `{{ @var }}` | Variable output | `{{ @domain.name }}` |
| `{{ @var \| raw }}` | Unescaped output | `{{ @html \| raw }}` |
| `{{ @var \| esc }}` | HTML escaped | `{{ @user_input \| esc }}` |

### Template Files

| Template | Purpose |
|----------|---------|
| `header.htm` | Navigation header with search |
| `treeView.htm` | Main tree structure layout |
| `domain_exp.htm` | Experimental domain detail |
| `domain_csm.htm` | Computed model detail |
| `loadDomain.htm` | Domain list item rendering |
| `loadCluster.htm` | Cluster group rendering |
| `searchWrapper.htm` | Search results container |
| `blastWrapper.htm` | BLAST results container |
| `blastTemplate.htm` | Individual BLAST hit |
| `blastTable.htm` | BLAST alignment table |
| `distribution.htm` | Download page |
| `documentation.htm` | Help documentation |

---

## Frontend Assets

### CSS Architecture (~668 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `mainnew.css` | 290 | Primary tree/layout styles |
| `base.css` | 74 | Typography, utilities |
| `af2_pdb_main.css` | 71 | Main page overrides |
| `domain.css` | 66 | Domain page tabs/panels |
| `group.css` | 61 | Cluster group styling |
| `search.css` | 53 | Search results |
| `statistics.css` | 47 | Analytics page |

### JavaScript Architecture (~827 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `assignment.js` | 277 | Structure visualization setup |
| `glmolhelper.js` | 143 | GLmol/3D viewer helpers |
| `group.js` | 137 | Group/cluster operations |
| `tools.js` | 120 | Core tree toggle/load |
| `domain.js` | 86 | Domain page interactions |
| `bb.js` | 64 | Backbone.js integration |

### External Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| jQuery | 1.10.2 | DOM manipulation |
| jQuery UI | 1.10.3 | Tabs, dialogs |
| FancyBox | 2.1.5 | Image lightbox |
| JSmol | HTML5 | 3D structure viewer |
| Bootstrap | CSS only | Grid, utilities |

---

## API & AJAX Endpoints

### AJAX Endpoints

| Endpoint | Method | Parameters | Response |
|----------|--------|------------|----------|
| `/load` | GET | `id`, `page` | HTML fragment |
| `/blast/@id` | GET | - | JSON status |
| `/search/taxa` | GET | `q` | JSON taxonomy options |

### Load Endpoint Details

```
GET /load?id=1.2.3&page=1

Response: HTML fragment containing:
- Cluster children (if cluster node)
- Domain list (if family node)
- Pagination controls
```

### BLAST Status Response

```json
{
    "status": "running|complete|error",
    "progress": 45,
    "message": "Processing..."
}
```

---

## Caching Strategy

### HTTP Cache Headers

| Resource | Cache-Control | TTL |
|----------|---------------|-----|
| Domain pages | `max-age=86400` | 24 hours |
| Tree nodes | `max-age=3600` | 1 hour |
| Structure files | `max-age=31536000` | 1 year |
| Search results | `max-age=3600` | 1 hour |
| Images | `max-age=604800` | 1 week |

### Execution Timeouts

| Handler | Timeout |
|---------|---------|
| Global default | 120 seconds |
| MainPage/Domain | 30 seconds |
| Search | 60 seconds |
| Load/AJAX | 30 seconds |
| BLAST parsing | 60 seconds |

---

## Configuration

### index.php Settings

```php
// Branch identification
$f3->set('branch', 'af2_pdb');

// Database connection
$f3->set('db_path', 'pgsql:host=asteria;port=45000;dbname=ecod_af2_pdb');
$f3->set('db_user', 'ecodweb');
$f3->set('db_pass', '***');

// File paths
$f3->set('data_dir', '/usr1/ECOD/html/af2_pdb_d/');
$f3->set('dist_dir', '/usr1/ECOD/html/distributions/');
$f3->set('tmp', '/data/ECOD0/html/af2_pdb/tmpdata/');
$f3->set('TEMP', '/tmp/');

// Framework settings
$f3->set('DEBUG', 3);
$f3->set('UI', 'views/');
$f3->set('AUTOLOAD', 'handles/');
```

### Security Measures

- **Input validation**: Regex patterns for domain IDs
- **SQL injection prevention**: Parameterized queries (? placeholders)
- **XSS prevention**: Template escaping (esc filter)
- **Database access**: Read-only web user
- **Connection timeout**: 10 seconds to prevent hanging

---

## Migration Recommendations

### Architecture

| Current | Recommended |
|---------|-------------|
| PHP F3 MVC | Next.js App Router |
| Server-rendered templates | React Server Components + Client Components |
| jQuery DOM manipulation | React state management |
| Apache + mod_rewrite | Next.js built-in routing |

### Database

| Consideration | Recommendation |
|---------------|----------------|
| ORM | Prisma or Drizzle ORM |
| Connection pooling | PgBouncer or Prisma connection pool |
| Migrations | Prisma Migrate |
| Type safety | Generated TypeScript types |

### Frontend

| Current | Recommended |
|---------|-------------|
| jQuery 1.10 | React 18+ hooks |
| jQuery UI tabs | Radix UI or shadcn/ui |
| FancyBox | React lightbox component |
| JSmol | Mol* (Molstar) or NGL Viewer |
| Custom CSS | Tailwind CSS |

### API Design

| Current | Recommended |
|---------|-------------|
| Mixed HTML/JSON responses | Separate API routes (JSON) |
| Query string parameters | RESTful paths + query params |
| No API versioning | `/api/v1/` prefix |
| Session-based state | Stateless JWT (if auth needed) |

### Key Migration Tasks

1. **Database schema documentation** - Generate ERD from PostgreSQL
2. **API specification** - OpenAPI/Swagger for new endpoints
3. **Component library** - Design system with Storybook
4. **Tree state management** - React Context or Zustand
5. **Search implementation** - Consider Algolia or maintain TSVECTOR
6. **3D viewer integration** - Mol* React component
7. **BLAST integration** - Queue system (Bull/BullMQ) with status polling
8. **Caching layer** - Redis for API responses, SWR/React Query client-side
9. **Analytics** - Next.js Analytics or Plausible
10. **Deployment** - Docker containers, CI/CD pipeline

---

## Appendix: Utility Functions

### Database Utilities (utils.php)

```php
// Shared database singleton
function getDB() {
    static $db = null;
    if (!$db) {
        $f3 = Base::instance();
        $db = new DB\SQL(
            $f3->get('db_path'),
            $f3->get('db_user'),
            $f3->get('db_pass')
        );
    }
    return $db;
}

// Format UID to 9-digit string
function padUID($uid) {
    return str_pad($uid, 9, '0', STR_PAD_LEFT);
}

// Get UniProt protein name
function getUnpName($unp_acc) { ... }

// Get PDB structure name
function getPDBName($pdb_id) { ... }
```

### ECOD-Specific Utilities

```php
// Parse range to PyMOL selection
function getPymolSele($range) {
    // "A:10-50,B:100-150" -> "chain A and resi 10-50 or chain B and resi 100-150"
}

// Cyclic color assignment for PyMOL
function pymolColor($index) {
    $colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta', ...];
    return $colors[$index % count($colors)];
}
```

---

*Document generated for ECOD NextJS/React migration project*
