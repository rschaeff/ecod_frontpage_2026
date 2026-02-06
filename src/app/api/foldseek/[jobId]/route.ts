import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { query } from '@/lib/db';

const execAsync = promisify(exec);
const FOLDSEEK_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

interface DomainInfo {
  uid: number;
  id: string;
  fid: string | null;
  fname: string | null;
}

interface FoldseekHit {
  num: number;
  targetId: string;      // Raw target ID from foldseek (e.g., "000000003.pdb")
  domainId?: string;     // ECOD domain ID (e.g., "e1abcA1")
  uid?: number;          // Domain UID
  fid?: string;          // Family ID
  familyName?: string;   // Family name
  // Alignment metrics
  pident: number;        // Percent identity (0-100)
  alnLength: number;     // Alignment length
  evalue: number;
  bitScore: number;
  // Structure metrics
  tmScore: number;       // Alignment TM-score
  // Alignment coordinates
  queryStart: number;
  queryEnd: number;
  targetStart: number;
  targetEnd: number;
}

interface JobMetadata {
  inputType: string;
  source: { type: string; id?: string };
  chain?: string;
  evalue: string;
  submitted: string;
}

async function getJobStatus(jobDir: string): Promise<'pending' | 'running' | 'completed' | 'failed' | 'not_found'> {
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

      // Job finished but no completion flag yet - check for error
      if (state === 'DONE' || state === '') {
        const errFile = path.join(jobDir, 'job.err');
        if (existsSync(errFile)) {
          const errContent = await readFile(errFile, 'utf-8');
          if (errContent.trim().length > 0 && !existsSync(path.join(jobDir, 'results.m8'))) {
            return 'failed';
          }
        }
      }
    }
  } catch {
    // squeue failed, check for results directly
    if (existsSync(path.join(jobDir, 'results.m8'))) {
      return 'completed';
    }
  }

  return 'pending';
}

async function parseResults(jobDir: string): Promise<FoldseekHit[]> {
  const resultsFile = path.join(jobDir, 'results.m8');
  const content = await readFile(resultsFile, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l);

  const hits: FoldseekHit[] = [];
  const uidList: number[] = [];

  // Parse M8 format with custom columns
  // query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,alntmscore
  for (let i = 0; i < lines.length; i++) {
    const fields = lines[i].split('\t');
    if (fields.length < 13) continue;

    const targetId = fields[1];
    // Extract UID from target ID (e.g., "000000003.pdb" -> 3)
    const uidMatch = targetId.match(/^(\d+)\.pdb$/);
    const uid = uidMatch ? parseInt(uidMatch[1], 10) : undefined;

    if (uid !== undefined) {
      uidList.push(uid);
    }

    hits.push({
      num: i + 1,
      targetId,
      uid,
      pident: parseFloat(fields[2]) * 100,  // Convert fraction to percent
      alnLength: parseInt(fields[3]),
      queryStart: parseInt(fields[6]),
      queryEnd: parseInt(fields[7]),
      targetStart: parseInt(fields[8]),
      targetEnd: parseInt(fields[9]),
      evalue: parseFloat(fields[10]),
      bitScore: parseFloat(fields[11]),
      tmScore: parseFloat(fields[12]),
    });
  }

  // Batch lookup domain info from database
  if (uidList.length > 0) {
    try {
      const placeholders = uidList.map((_, i) => `$${i + 1}`).join(', ');
      const domains = await query<DomainInfo>(`
        SELECT d.uid, d.id, d.fid, c.name as fname
        FROM domain d
        LEFT JOIN cluster c ON d.fid = c.id
        WHERE d.uid IN (${placeholders})
      `, uidList);

      const domainMap = new Map(domains.map(d => [d.uid, d]));

      for (const hit of hits) {
        if (hit.uid !== undefined) {
          const info = domainMap.get(hit.uid);
          if (info) {
            hit.domainId = info.id;
            hit.fid = info.fid || undefined;
            hit.familyName = info.fname || undefined;
          }
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
      { success: false, error: { code: 'INVALID_JOB_ID', message: 'Invalid job ID format' } },
      { status: 400 }
    );
  }

  const jobDir = path.join(FOLDSEEK_TMP_DIR, jobId);
  const status = await getJobStatus(jobDir);

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
      if (existsSync(errFile)) {
        const errContent = await readFile(errFile, 'utf-8');
        if (errContent.trim()) {
          errorMessage = errContent.trim().split('\n').slice(-5).join('\n');
        }
      }
    } catch {
      // Use default message
    }

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

  // Parse completed results
  try {
    const hits = await parseResults(jobDir);

    let metadata: JobMetadata | null = null;
    try {
      const metadataContent = await readFile(path.join(jobDir, 'metadata.json'), 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch {
      // Metadata not available
    }

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
      { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse Foldseek results' } },
      { status: 500 }
    );
  }
}
