# ECOD - Evolutionary Classification of Protein Domains

A modern web interface for the ECOD database, built with Next.js 14 and React.

## Overview

ECOD (Evolutionary Classification of Protein Domains) is a hierarchical classification of protein domains based on evolutionary relationships. This project provides a web interface for browsing, searching, and downloading ECOD data.

## Features

- **Browse Classification** - Navigate the hierarchical tree (A→X→H→T→F)
- **Search** - Find domains by UID, domain ID, UniProt, PDB ID, or keyword
- **Domain Details** - View domain information and 3D structures
- **Downloads** - Access bulk data downloads

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **3D Visualization**: Mol* (via iframe isolation)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ecod_frontpage_2026

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local

# Edit .env.local with your database credentials
```

### Configuration

Create a `.env.local` file with the following variables:

```env
# Database Configuration
DB_HOST=your-db-host
DB_PORT=45000
DB_NAME=ecod_af2_pdb
DB_USER=your-username
DB_PASSWORD=your-password

# Data Directories (server paths)
DATA_DIR=/path/to/domain/data/
DIST_DIR=/path/to/distributions/
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── domain/[uid]/      # Domain detail pages
│   ├── search/            # Search page
│   ├── tree/              # Classification browser
│   ├── distribution/      # Download page
│   └── documentation/     # Help page
├── components/            # React components
│   ├── layout/           # Header, Footer
│   ├── search/           # Search components
│   ├── tree/             # Tree navigation
│   └── visualization/    # 3D viewer components
├── lib/                   # Utilities
│   ├── db.ts             # Database connection
│   └── cache.ts          # Caching utilities
├── types/                 # TypeScript types
│   └── ecod.ts           # ECOD-specific types
└── contexts/              # React contexts
```

## 3D Structure Viewer

The 3D structure viewer uses an **iframe isolation strategy** to avoid React lifecycle conflicts with WebGL-based molecular viewers. The viewer is located at `/public/viewer/index.html` and communicates with the parent React app via postMessage.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Database statistics |
| `/api/search` | GET | Search domains |
| `/api/tree` | GET | Classification tree |
| `/api/domains/[uid]` | GET | Domain details |
| `/api/structures/[uid]` | GET | Structure file |
| `/api/sequences/[uid]` | GET | FASTA sequence |

## Documentation

See the `/docs` directory for additional documentation:

- `LEGACY_PHP_ANALYSIS.md` - Analysis of the original PHP site
- `DATABASE_SCHEMA.md` - Database schema reference
- `DATA_STRUCTURES.md` - TypeScript type definitions
- `MIGRATION_CHECKLIST.md` - Migration progress tracking
- `PREVIOUS_NEXTJS_ATTEMPT.md` - Lessons from prior implementation

## Citation

If you use ECOD in your research, please cite:

> Cheng H, Schaeffer RD, Liao Y, Kinch LN, Pei J, Shi S, Kim BH, Grishin NV.
> ECOD: An evolutionary classification of protein domains.
> *PLoS Comput Biol.* 2014;10(12):e1003926.

## License

Copyright (c) 2014-2026 Grishin Lab / HHMI / UT Southwestern Medical Center

## Links

- [Grishin Lab](http://prodata.swmed.edu/)
- [RCSB PDB](https://www.rcsb.org/)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
