# Foldseek Structural Search Implementation Plan

**Date**: 2026-02-05
**Priority**: High
**Status**: Implemented (MVP)

---

## Overview

Implement structural similarity search using Foldseek, allowing users to upload protein structures and find ECOD domains with similar folds. This complements the existing BLAST sequence search.

### Why Foldseek?
- **Speed**: 20,000x faster than traditional structural aligners (DALI, TM-align)
- **Sensitivity**: Comparable to state-of-the-art structure comparison
- **3Di alphabet**: Encodes structural features as a sequence, enabling fast database search
- **Remote homology**: Finds structural similarity even without sequence similarity

---

## System Requirements

### Foldseek Installation
```
Location: /sw/apps/Anaconda3-2023.09-0/bin/foldseek
Version: 10.941cd33
```

### Environment Notes
- **CRITICAL**: Must unset `OMP_PROC_BIND` before running (SLURM sets this, causing Foldseek to fail)
- Memory: ~4GB for typical searches
- CPU: 4-8 cores recommended
- Time: 1-5 minutes for typical domains

---

## Phase 1: Database Setup

### 1.1 Using Existing DPAM Foldseek Database (Testing/MVP)

**Existing Database**: Repurposed from DPAM project
- Source: `/home/rschaeff/data/dpam_reference/ecod_data/ECOD_foldseek_DB`
- Symlinked to: `/data/ECOD0/html/foldseekdb/ECOD_foldseek_DB`
- Size: ~150MB (63,064 representative domains)
- Format: Padded UID with `.pdb` extension (e.g., `000000003.pdb`)

**Tested and Working**:
```bash
# Test command (6 second search time)
unset OMP_PROC_BIND
foldseek easy-search query.pdb /data/ECOD0/html/foldseekdb/ECOD_foldseek_DB output.m8 tmp/
```

**ID Mapping**: Strip `.pdb` extension, parse as integer → domain UID
```typescript
const uid = parseInt(targetId.replace('.pdb', ''), 10);
```

### 1.2 Future: Full Database (Deferred)

For production, build complete database from all 31.4M domains:

| Database | Description | Domains | Status |
|----------|-------------|---------|--------|
| `ECOD_foldseek_DB` | DPAM representatives | 63K | ✓ Active |
| `ecod_af2_pdb` | Full database | 31.4M | Deferred |
| `ecod_f99` | F99 representatives | ~500K | Deferred |

---

## Phase 2: API Implementation

### 2.1 Submit Endpoint

**File**: `src/app/api/foldseek/submit/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Configuration
const FOLDSEEK_PATH = '/sw/apps/Anaconda3-2023.09-0/bin/foldseek';
const FOLDSEEK_DB = '/data/ECOD0/html/foldseekdb/ecod_f99';
const FOLDSEEK_TMP_DIR = '/data/ECOD0/html/af2_pdb/tmpdata';

// Input types
type InputType = 'pdb_file' | 'pdb_id' | 'alphafold_id';

interface SubmitRequest {
  inputType: InputType;
  structure?: string;      // PDB/mmCIF file content
  pdbId?: string;          // 4-letter PDB code
  alphafoldId?: string;    // UniProt accession
  chain?: string;          // Chain ID (optional)
  sensitivity?: 's1' | 's2' | 's3';  // Search sensitivity
  evalue?: string;         // E-value threshold
}

// Validate PDB/mmCIF file content
function validateStructure(content: string): {
  valid: boolean;
  format: 'pdb' | 'mmcif' | null;
  error?: string;
  atomCount?: number;
} {
  const lines = content.split('\n');
  let atomCount = 0;
  let format: 'pdb' | 'mmcif' | null = null;

  // Detect format
  if (content.includes('data_')) {
    format = 'mmcif';
    // Count _atom_site entries
    let inAtomSite = false;
    for (const line of lines) {
      if (line.startsWith('_atom_site.')) inAtomSite = true;
      if (inAtomSite && line.startsWith('ATOM') || line.startsWith('HETATM')) {
        atomCount++;
      }
    }
  } else {
    format = 'pdb';
    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        atomCount++;
      }
    }
  }

  if (atomCount === 0) {
    return { valid: false, format: null, error: 'No ATOM records found in structure file' };
  }

  if (atomCount > 100000) {
    return { valid: false, format, error: 'Structure too large (>100,000 atoms). Please use a single domain or chain.' };
  }

  if (atomCount < 10) {
    return { valid: false, format, error: 'Structure too small (<10 atoms). Please provide a valid protein structure.' };
  }

  return { valid: true, format, atomCount };
}

// Generate unique job ID
function generateJobId(): string {
  return 'fs_' + randomBytes(6).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRequest = await request.json();
    const { inputType, structure, pdbId, alphafoldId, chain, sensitivity = 's2', evalue = '0.01' } = body;

    let structureContent: string;
    let structureFormat: 'pdb' | 'mmcif' = 'pdb';

    // Handle different input types
    if (inputType === 'pdb_file') {
      if (!structure) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_STRUCTURE', message: 'No structure file provided' } },
          { status: 400 }
        );
      }

      const validation = validateStructure(structure);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STRUCTURE', message: validation.error } },
          { status: 400 }
        );
      }

      structureContent = structure;
      structureFormat = validation.format!;

    } else if (inputType === 'pdb_id') {
      if (!pdbId || !/^[a-zA-Z0-9]{4}$/.test(pdbId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PDB_ID', message: 'Invalid PDB ID format' } },
          { status: 400 }
        );
      }

      // Fetch from RCSB PDB
      const pdbUrl = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
      const response = await fetch(pdbUrl);
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: { code: 'PDB_FETCH_FAILED', message: `Could not fetch PDB ${pdbId}` } },
          { status: 400 }
        );
      }

      structureContent = await response.text();
      structureFormat = 'mmcif';

    } else if (inputType === 'alphafold_id') {
      if (!alphafoldId || !/^[A-Z0-9]+$/.test(alphafoldId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_UNIPROT', message: 'Invalid UniProt accession format' } },
          { status: 400 }
        );
      }

      // Fetch from AlphaFold EBI
      const afUrl = `https://alphafold.ebi.ac.uk/files/AF-${alphafoldId}-F1-model_v4.cif`;
      const response = await fetch(afUrl);
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: { code: 'ALPHAFOLD_FETCH_FAILED', message: `Could not fetch AlphaFold model for ${alphafoldId}` } },
          { status: 400 }
        );
      }

      structureContent = await response.text();
      structureFormat = 'mmcif';

    } else {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT_TYPE', message: 'Invalid input type' } },
        { status: 400 }
      );
    }

    // Create job
    const jobId = generateJobId();
    const jobDir = path.join(FOLDSEEK_TMP_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    // Write structure file
    const ext = structureFormat === 'mmcif' ? 'cif' : 'pdb';
    const structureFile = path.join(jobDir, `query.${ext}`);
    await writeFile(structureFile, structureContent);

    // Write job metadata
    await writeFile(path.join(jobDir, 'metadata.json'), JSON.stringify({
      inputType,
      pdbId,
      alphafoldId,
      chain,
      sensitivity,
      evalue,
      submitted: new Date().toISOString(),
    }));

    // Create SLURM script
    const outputFile = path.join(jobDir, 'results.m8');
    const slurmScript = `#!/bin/bash
#SBATCH --job-name=foldseek_${jobId}
#SBATCH --output=${jobDir}/job.out
#SBATCH --error=${jobDir}/job.err
#SBATCH --time=00:30:00
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G

# CRITICAL: Unset OMP_PROC_BIND (SLURM sets this, causing Foldseek to fail)
unset OMP_PROC_BIND

${FOLDSEEK_PATH} easy-search \\
    ${structureFile} \\
    ${FOLDSEEK_DB} \\
    ${outputFile} \\
    ${jobDir}/tmp \\
    --format-output "query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,alntmscore,qtmscore,ttmscore,lddt,prob" \\
    -e ${evalue} \\
    -s ${sensitivity === 's1' ? '7.5' : sensitivity === 's2' ? '9.5' : '11'} \\
    --threads 4

# Signal completion
touch ${jobDir}/completed
`;

    const scriptFile = path.join(jobDir, 'job.slurm');
    await writeFile(scriptFile, slurmScript);

    // Submit SLURM job
    const { stdout } = await execAsync(`sbatch ${scriptFile}`);
    const slurmJobId = stdout.match(/Submitted batch job (\\d+)/)?.[1];

    if (!slurmJobId) {
      return NextResponse.json(
        { success: false, error: { code: 'SUBMIT_FAILED', message: 'Failed to submit Foldseek job' } },
        { status: 500 }
      );
    }

    await writeFile(path.join(jobDir, 'slurm_job_id'), slurmJobId);

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        slurmJobId,
        message: 'Foldseek job submitted successfully',
      },
    });

  } catch (error) {
    console.error('Foldseek submit error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SUBMIT_ERROR', message: 'Failed to submit Foldseek job' } },
      { status: 500 }
    );
  }
}
```

### 2.2 Status/Results Endpoint

**File**: `src/app/api/foldseek/[jobId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { query } from '@/lib/db';

const execAsync = promisify(exec);
const FOLDSEEK_TMP_DIR = '/data/ECOD0/html/af2_pdb/tmpdata';

interface FoldseekHit {
  num: number;
  domainId: string;
  uid?: number;
  fid?: string;
  familyName?: string;
  // Alignment metrics
  pident: number;      // Percent identity
  alnLength: number;   // Alignment length
  evalue: number;
  bitScore: number;
  // Structure metrics
  tmScore: number;     // Alignment TM-score
  queryTmScore: number; // TM-score normalized by query
  targetTmScore: number; // TM-score normalized by target
  lddt: number;        // lDDT score
  prob: number;        // Probability (0-1)
  // Alignment coordinates
  queryStart: number;
  queryEnd: number;
  targetStart: number;
  targetEnd: number;
}

async function getJobStatus(jobDir: string, jobId: string): Promise<'pending' | 'running' | 'completed' | 'failed' | 'not_found'> {
  if (!existsSync(jobDir)) {
    return 'not_found';
  }

  // Check completion flag
  if (existsSync(path.join(jobDir, 'completed'))) {
    if (existsSync(path.join(jobDir, 'results.m8'))) {
      return 'completed';
    }
    return 'failed';
  }

  // Check SLURM job status
  try {
    const slurmJobIdFile = path.join(jobDir, 'slurm_job_id');
    if (existsSync(slurmJobIdFile)) {
      const slurmJobId = (await readFile(slurmJobIdFile, 'utf-8')).trim();
      const { stdout } = await execAsync(`squeue -j ${slurmJobId} -h -o "%t" 2>/dev/null || echo "DONE"`);
      const state = stdout.trim();

      if (state === 'PD') return 'pending';
      if (state === 'R') return 'running';
    }
  } catch {
    // squeue failed
  }

  return 'pending';
}

async function parseResults(jobDir: string): Promise<FoldseekHit[]> {
  const resultsFile = path.join(jobDir, 'results.m8');
  const content = await readFile(resultsFile, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l);

  const hits: FoldseekHit[] = [];
  const domainIds: string[] = [];

  // Parse M8 format with custom columns
  // query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,alntmscore,qtmscore,ttmscore,lddt,prob
  for (let i = 0; i < lines.length; i++) {
    const fields = lines[i].split('\t');
    if (fields.length < 17) continue;

    const domainId = fields[1];
    domainIds.push(domainId);

    hits.push({
      num: i + 1,
      domainId,
      pident: parseFloat(fields[2]) * 100,
      alnLength: parseInt(fields[3]),
      queryStart: parseInt(fields[6]),
      queryEnd: parseInt(fields[7]),
      targetStart: parseInt(fields[8]),
      targetEnd: parseInt(fields[9]),
      evalue: parseFloat(fields[10]),
      bitScore: parseFloat(fields[11]),
      tmScore: parseFloat(fields[12]),
      queryTmScore: parseFloat(fields[13]),
      targetTmScore: parseFloat(fields[14]),
      lddt: parseFloat(fields[15]),
      prob: parseFloat(fields[16]),
    });
  }

  // Batch lookup domain info
  if (domainIds.length > 0) {
    try {
      const placeholders = domainIds.map((_, i) => `$${i + 1}`).join(', ');
      const domains = await query<{ uid: number; id: string; fid: string; fname: string }>(`
        SELECT d.uid, d.id, d.fid, c.name as fname
        FROM domain d
        LEFT JOIN cluster c ON d.fid = c.id
        WHERE d.id IN (${placeholders})
      `, domainIds);

      const domainMap = new Map(domains.map(d => [d.id, d]));

      for (const hit of hits) {
        const info = domainMap.get(hit.domainId);
        if (info) {
          hit.uid = info.uid;
          hit.fid = info.fid;
          hit.familyName = info.fname;
        }
      }
    } catch (error) {
      console.error('Failed to fetch domain info:', error);
    }
  }

  return hits;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId || !/^fs_[A-Za-z0-9_-]+$/.test(jobId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JOB_ID', message: 'Invalid job ID' } },
      { status: 400 }
    );
  }

  const jobDir = path.join(FOLDSEEK_TMP_DIR, jobId);
  const status = await getJobStatus(jobDir, jobId);

  if (status === 'not_found') {
    return NextResponse.json(
      { success: false, error: { code: 'JOB_NOT_FOUND', message: 'Foldseek job not found' } },
      { status: 404 }
    );
  }

  if (status === 'failed') {
    let errorMessage = 'Foldseek job failed';
    try {
      const errFile = path.join(jobDir, 'job.err');
      errorMessage = await readFile(errFile, 'utf-8');
    } catch {}

    return NextResponse.json({
      success: true,
      data: { jobId, status: 'failed', error: errorMessage },
    });
  }

  if (status !== 'completed') {
    return NextResponse.json({
      success: true,
      data: { jobId, status },
    });
  }

  // Parse results
  try {
    const hits = await parseResults(jobDir);
    const metadata = JSON.parse(await readFile(path.join(jobDir, 'metadata.json'), 'utf-8'));

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'completed',
        metadata,
        hitCount: hits.length,
        hits,
      },
    });
  } catch (error) {
    console.error('Failed to parse Foldseek results:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse results' } },
      { status: 500 }
    );
  }
}
```

---

## Phase 3: Frontend Implementation

### 3.1 Search Page

**File**: `src/app/search/foldseek/page.tsx`

Key features:
- **File upload**: Drag-and-drop zone for PDB/mmCIF files
- **PDB ID input**: Fetch structure from RCSB PDB
- **AlphaFold ID input**: Fetch model from AlphaFold DB
- **Chain selection**: Optional chain filter for multi-chain structures
- **Sensitivity options**: s1 (fast), s2 (balanced), s3 (sensitive)
- **E-value threshold**: Similar to BLAST options

UI Layout:
```
┌─────────────────────────────────────────────────────────┐
│ Foldseek Structural Search                              │
│ Search ECOD domains by protein structure                │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │  [Tab: Upload File] [Tab: PDB ID] [Tab: AlphaFold] │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                     │ │
│ │   [Drag & drop PDB/mmCIF file here]                │ │
│ │           or click to browse                        │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Search Options                                          │
│ ┌─────────────────────┐ ┌───────────────────────────┐  │
│ │ Sensitivity:        │ │ Database:                 │  │
│ │ [s2 - Balanced ▼]   │ │ ECOD F99 representatives  │  │
│ └─────────────────────┘ └───────────────────────────┘  │
│ ┌─────────────────────┐                                 │
│ │ E-value: [0.01 ▼]   │                                 │
│ └─────────────────────┘                                 │
│                                                         │
│                                  [Search Foldseek →]   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Results Page

**File**: `src/app/search/foldseek/[jobId]/page.tsx`

Key features:
- **Polling**: Auto-refresh until job completes
- **Hit table**: Domain ID, family, scores (TM-score, lDDT, E-value)
- **Score coloring**: Color by TM-score (structural similarity)
- **Expandable details**: Alignment coordinates, all metrics
- **3D alignment viewer**: (future) Show query-target superposition

Results Layout:
```
┌─────────────────────────────────────────────────────────────────┐
│ Foldseek Search Results                                         │
│ Job: fs_abc123  •  Submitted: 2 min ago                        │
├─────────────────────────────────────────────────────────────────┤
│ TM-score: ■ ≥0.8   ■ 0.5-0.8   ■ 0.3-0.5   ■ <0.3             │
├────┬────────────────┬──────────┬────────┬────────┬─────────────┤
│ #  │ Domain         │ Family   │TM-score│ lDDT   │ E-value     │
├────┼────────────────┼──────────┼────────┼────────┼─────────────┤
│ ■  │ e7abcA1        │ F.1.1.1  │ 0.92   │ 0.85   │ 1e-45       │
│ ■  │ e1xyzB2        │ F.1.1.2  │ 0.78   │ 0.72   │ 3e-32       │
│ ■  │ e2defC1        │ F.2.3.1  │ 0.45   │ 0.51   │ 2e-12       │
└────┴────────────────┴──────────┴────────┴────────┴─────────────┘
```

---

## Phase 4: Integration

### 4.1 Navigation Updates

Add Foldseek to search options:

**File**: `src/app/search/page.tsx`

```tsx
// Add alongside BLAST link
<Link href="/search/foldseek" className="...">
  Structure Search (Foldseek)
</Link>
```

### 4.2 Home Page Updates

Add structure search to home page quick actions:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <SearchCard type="text" title="Search by ID" />
  <SearchCard type="blast" title="Sequence Search" />
  <SearchCard type="foldseek" title="Structure Search" />
</div>
```

---

## Implementation Timeline

### Week 1: Backend
- [ ] Build Foldseek database from ECOD domains
- [ ] Implement submit API endpoint
- [ ] Implement status/results API endpoint
- [ ] Test on sample structures

### Week 2: Frontend
- [ ] Create search page with file upload
- [ ] Create results page with polling
- [ ] Add score visualization
- [ ] Add help/documentation

### Week 3: Polish
- [ ] Error handling edge cases
- [ ] Performance optimization
- [ ] Integration with domain pages
- [ ] User testing

---

## Technical Considerations

### File Size Limits
- Max upload: 10MB (covers most protein structures)
- Max atoms: 100,000 (prevents searching entire large complexes)
- Recommendation: Search individual domains or chains

### Job Cleanup
- Delete job files after 7 days
- Implement cron job for cleanup:
```bash
find /data/ECOD0/html/af2_pdb/tmpdata/fs_* -mtime +7 -exec rm -rf {} \;
```

### Rate Limiting
- Consider implementing rate limiting for submit endpoint
- Suggested: 10 jobs per IP per hour

### Database Updates
- Rebuild Foldseek DB when ECOD version updates
- Store database version in metadata
- Show database version in results

---

## Future Enhancements

1. **3D Alignment Viewer**: Show query-target structural superposition in Mol*
2. **Batch Search**: Upload multiple structures
3. **Multimer Search**: Search for complex-level similarity
4. **Custom Database**: Allow searching against user-defined subsets
5. **API Access**: Provide programmatic access for power users

---

## References

- [Foldseek Paper](https://www.nature.com/articles/s41587-023-01773-0) - van Kempen et al., Nature Biotechnology 2023
- [Foldseek GitHub](https://github.com/steineggerlab/foldseek)
- [3Di Alphabet](https://github.com/steineggerlab/foldseek/wiki/3Di-alphabet) - Structure-to-sequence encoding
