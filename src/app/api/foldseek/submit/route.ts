import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';

// Configuration
const FOLDSEEK_PATH = process.env.FOLDSEEK_PATH || '/usr/bin/foldseek';
const FOLDSEEK_DB = process.env.FOLDSEEK_DB || '/data/ECOD0/html/foldseekdb/ECOD_foldseek_DB';
const FOLDSEEK_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

// Validate evalue format to prevent command injection
function isValidEvalue(value: string): boolean {
  return /^\d*\.?\d+(e[+-]?\d+)?$/i.test(value);
}

// Input types
type InputType = 'pdb_file' | 'pdb_id' | 'alphafold_id';

interface SubmitRequest {
  inputType: InputType;
  structure?: string;      // PDB/mmCIF file content
  pdbId?: string;          // 4-letter PDB code
  alphafoldId?: string;    // UniProt accession
  chain?: string;          // Chain ID (optional)
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
  if (content.includes('data_') || content.includes('_atom_site.')) {
    format = 'mmcif';
    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
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

// Extract a single chain from mmCIF format
function extractChainFromMmcif(content: string, chainId: string): string {
  const lines = content.split('\n');
  const outputLines: string[] = [];
  let inAtomSiteHeader = false;
  let inAtomSiteData = false;
  let authAsymIdCol = -1;
  let columnNames: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of _atom_site loop
    if (line.trim() === 'loop_' && i + 1 < lines.length && lines[i + 1].startsWith('_atom_site.')) {
      inAtomSiteHeader = true;
      outputLines.push(line);
      continue;
    }

    // Parse column definitions
    if (inAtomSiteHeader && line.startsWith('_atom_site.')) {
      const colName = line.trim();
      columnNames.push(colName);
      if (colName === '_atom_site.auth_asym_id') {
        authAsymIdCol = columnNames.length - 1;
      }
      outputLines.push(line);
      continue;
    }

    // Transition from header to data
    if (inAtomSiteHeader && !line.startsWith('_atom_site.') && line.trim() !== '') {
      inAtomSiteHeader = false;
      inAtomSiteData = true;
    }

    // Parse atom data lines
    if (inAtomSiteData) {
      if (line.startsWith('#') || line.trim() === '') {
        // End of atom_site block
        inAtomSiteData = false;
        outputLines.push(line);
        continue;
      }

      // Parse fields - handle quoted strings
      const fields = parseMMCifLine(line);
      if (authAsymIdCol >= 0 && authAsymIdCol < fields.length) {
        if (fields[authAsymIdCol] === chainId) {
          outputLines.push(line);
        }
      }
    } else {
      // Keep all non-atom_site lines
      outputLines.push(line);
    }
  }

  return outputLines.join('\n');
}

// Parse mmCIF line handling quoted strings
function parseMMCifLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = '';
    } else if (!inQuote && /\s/.test(char)) {
      if (current) {
        fields.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    fields.push(current);
  }

  return fields;
}

// Extract a single chain from PDB format
function extractChainFromPdb(content: string, chainId: string): string {
  const lines = content.split('\n');
  const outputLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
      // Chain ID is at position 21 (0-indexed) in PDB format
      const lineChain = line.charAt(21);
      if (lineChain === chainId) {
        outputLines.push(line);
      }
    } else if (line.startsWith('TER')) {
      // Include TER if it matches our chain
      const lineChain = line.length > 21 ? line.charAt(21) : '';
      if (lineChain === chainId || lineChain === ' ') {
        outputLines.push(line);
      }
    } else {
      // Keep header lines
      outputLines.push(line);
    }
  }

  return outputLines.join('\n');
}

// Generate unique job ID
function generateJobId(): string {
  return 'fs_' + randomBytes(6).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRequest = await request.json();
    const { inputType, structure, pdbId, alphafoldId, chain, evalue = '0.01' } = body;

    if (!isValidEvalue(evalue)) {
      return NextResponse.json(
        { error: 'Invalid evalue parameter' },
        { status: 400 }
      );
    }

    let structureContent: string;
    let structureFormat: 'pdb' | 'mmcif' = 'pdb';
    let sourceInfo: { type: string; id?: string } = { type: 'upload' };

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
      sourceInfo = { type: 'upload' };

    } else if (inputType === 'pdb_id') {
      if (!pdbId || !/^[a-zA-Z0-9]{4}$/.test(pdbId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PDB_ID', message: 'Invalid PDB ID format (must be 4 characters)' } },
          { status: 400 }
        );
      }

      if (!chain || !/^[A-Za-z0-9]+$/.test(chain)) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_CHAIN', message: 'Chain ID is required for PDB structures' } },
          { status: 400 }
        );
      }

      // Fetch from RCSB PDB
      const pdbUrl = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
      const response = await fetch(pdbUrl);
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: { code: 'PDB_FETCH_FAILED', message: `Could not fetch PDB ${pdbId.toUpperCase()} from RCSB` } },
          { status: 400 }
        );
      }

      let fullStructure = await response.text();

      // Extract only the specified chain
      structureContent = extractChainFromMmcif(fullStructure, chain.toUpperCase());
      structureFormat = 'mmcif';
      sourceInfo = { type: 'pdb', id: `${pdbId.toUpperCase()}_${chain.toUpperCase()}` };

      // Verify we got some atoms
      const atomCount = (structureContent.match(/^ATOM\s/gm) || []).length;
      if (atomCount === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'CHAIN_NOT_FOUND', message: `Chain ${chain.toUpperCase()} not found in PDB ${pdbId.toUpperCase()}` } },
          { status: 400 }
        );
      }

    } else if (inputType === 'alphafold_id') {
      if (!alphafoldId || !/^[A-Z][A-Z0-9]+$/.test(alphafoldId)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_UNIPROT', message: 'Invalid UniProt accession format' } },
          { status: 400 }
        );
      }

      // Fetch from AlphaFold EBI (v4 for API compatibility)
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
      sourceInfo = { type: 'alphafold', id: alphafoldId };

    } else {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT_TYPE', message: 'Invalid input type. Use pdb_file, pdb_id, or alphafold_id' } },
        { status: 400 }
      );
    }

    // Validate fetched structure
    if (inputType !== 'pdb_file') {
      const validation = validateStructure(structureContent);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STRUCTURE', message: validation.error } },
          { status: 400 }
        );
      }
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
      source: sourceInfo,
      chain,
      evalue,
      submitted: new Date().toISOString(),
    }));

    // Run foldseek as a background child process
    const outputFile = path.join(jobDir, 'results.m8');
    const errFile = path.join(jobDir, 'job.err');

    try {
      await writeFile(path.join(jobDir, 'status'), 'running');

      // Ensure OMP_PROC_BIND is unset (causes foldseek to fail)
      const { OMP_PROC_BIND: _, ...envWithoutOmp } = process.env;
      const childEnv = { ...envWithoutOmp, LD_LIBRARY_PATH: '/usr/lib64' };

      const child = spawn(FOLDSEEK_PATH, [
        'easy-search',
        structureFile,
        FOLDSEEK_DB,
        outputFile,
        path.join(jobDir, 'tmp'),
        '--format-output', 'query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,alntmscore',
        '-e', evalue,
        '--threads', '4',
      ], {
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: true,
        env: childEnv,
      });

      // Collect stderr
      let stderrData = '';
      child.stderr?.on('data', (chunk: Buffer) => { stderrData += chunk.toString(); });

      child.on('close', async (code) => {
        try {
          if (stderrData) await writeFile(errFile, stderrData);
          if (code === 0) {
            await writeFile(path.join(jobDir, 'completed'), '');
          }
          await writeFile(path.join(jobDir, 'status'), code === 0 ? 'completed' : 'failed');
        } catch { /* ignore */ }
      });

      child.unref();

      // Save PID for reference
      await writeFile(path.join(jobDir, 'pid'), String(child.pid));

      return NextResponse.json({
        success: true,
        data: {
          jobId,
          message: 'Foldseek job submitted successfully',
        },
      });
    } catch (spawnError) {
      try {
        await rm(jobDir, { recursive: true, force: true });
      } catch { /* ignore */ }
      return NextResponse.json(
        { success: false, error: { code: 'SUBMIT_FAILED', message: 'Failed to start Foldseek process' } },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Foldseek submit error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SUBMIT_ERROR', message: 'Failed to submit Foldseek job' } },
      { status: 500 }
    );
  }
}
