# ECOD Frontpage Roadmap

## Current State (2026-02-05)

Minimal complete implementation covering:
- Home page with tabbed search (keyword/sequence/structure), news, citations, stats
- Tree navigation with lazy-loading A/X/H/T/F hierarchy
- Search with auto-detection (UID, domain ID, PDB, UniProt, cluster, keyword)
- Domain detail pages with classification, 3D viewer (Mol*), downloads
- BLAST sequence search and Foldseek structure search
- Advanced taxonomic search with filtering
- Distribution/download page with filesystem scanning
- Documentation with glossary, search guide, API reference
- News system backed by JSON file
- Dark mode with GDPR cookie consent
- API caching (in-memory TTL + HTTP Cache-Control)

## Potential Directions

### 1. External Data Source Integration
Deeper integration with RCSB PDB, UniProt, and InterPro. Could pull in functional annotations, cross-references, ligand information, and structure metadata directly into domain pages rather than just linking out. Would make ECOD a more self-contained starting point for researchers.

### 2. Sequence Range Visualization
Use a track-based viewer library like [Nightingale](https://github.com/ebi-webcomponents/nightingale) to render domain boundaries, secondary structure, disorder predictions, and other features along the protein sequence. Would replace or augment the current text-based range display on domain pages.

### 3. Data Table Improvements
Better pagination and column sorting for search results and domain listings. Current implementation is functional but basic. At the scale of ECOD (millions of domains), users need efficient ways to navigate large result sets with sortable columns, adjustable page sizes, and possibly virtual scrolling.

### 4. Search Filtering
More prominent filtering options in search results. Many users will want experimental-only results foregrounded, so a PDB/AlphaFold toggle should be easy to reach. Could also add filters for classification level, organism, and sequence length directly in the results view rather than requiring the advanced search page.

### 5. Classification Group Landing Pages
Dedicated pages for X-groups, H-groups, T-groups, and F-groups that go beyond the compact tree view. These would provide:
- Group-level properties and descriptions
- Summary statistics (domain count, organism distribution, structure source breakdown)
- Representative structure gallery
- Subgroup listing with counts
- Narrative context for what defines each group

This would give the hierarchy a browsable, Wikipedia-like quality rather than being purely a tree navigation tool.
