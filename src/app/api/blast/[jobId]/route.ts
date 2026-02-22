import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { query } from '@/lib/db';

const BLAST_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

interface DomainInfo {
  uid: number;
  id: string;
  fid: string | null;
  fname: string | null;
}

interface BlastHit {
  num: number;
  domainId: string;
  range: string;
  uid?: number;
  fid?: string;
  familyName?: string;
  evalue: number;
  bitScore: number;
  identity: number;
  alignLength: number;
  gaps: number;
  queryStart: number;
  queryEnd: number;
  hitStart: number;
  hitEnd: number;
  qseq: string;
  hseq: string;
  midline: string;
}

async function getJobStatus(jobDir: string, jobId: string): Promise<'pending' | 'running' | 'completed' | 'failed' | 'not_found'> {
  if (!existsSync(jobDir)) {
    return 'not_found';
  }

  // Check status file written by the spawned process handler
  const statusFile = path.join(jobDir, 'status');
  if (existsSync(statusFile)) {
    const status = (await readFile(statusFile, 'utf-8')).trim();
    if (status === 'completed') {
      // Verify the result file is actually complete
      const resultFile = path.join(jobDir, `${jobId}_blast.xml`);
      if (existsSync(resultFile)) {
        const content = await readFile(resultFile, 'utf-8');
        if (content.includes('</BlastOutput>')) {
          return 'completed';
        }
      }
      return 'failed';
    }
    if (status === 'failed') return 'failed';
    if (status === 'running') return 'running';
  }

  return 'pending';
}

async function parseBlastResults(jobDir: string, jobId: string): Promise<BlastHit[]> {
  const resultFile = path.join(jobDir, `${jobId}_blast.xml`);
  const xmlContent = await readFile(resultFile, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  const result = parser.parse(xmlContent);
  const hits: BlastHit[] = [];

  const blastOutput = result.BlastOutput;
  if (!blastOutput) return hits;

  const iterations = blastOutput.BlastOutput_iterations?.Iteration;
  if (!iterations) return hits;

  // Handle single or multiple iterations
  const iterationList = Array.isArray(iterations) ? iterations : [iterations];
  const firstIteration = iterationList[0];

  const hitList = firstIteration.Iteration_hits?.Hit;
  if (!hitList) return hits;

  const hitsArray = Array.isArray(hitList) ? hitList : [hitList];

  // Collect domain IDs for batch lookup
  const domainIds: string[] = [];

  for (const hit of hitsArray) {
    const hitDef = hit.Hit_def || '';
    const [domainId] = hitDef.split(' ');
    domainIds.push(domainId);
  }

  // Batch lookup domain info from database
  const domainInfoMap = new Map<string, DomainInfo>();
  if (domainIds.length > 0) {
    try {
      const placeholders = domainIds.map((_, i) => `$${i + 1}`).join(', ');
      const domains = await query<DomainInfo>(`
        SELECT d.uid, d.id, d.fid, c.name as fname
        FROM domain d
        LEFT JOIN cluster c ON d.fid = c.id
        WHERE d.id IN (${placeholders})
      `, domainIds);

      for (const d of domains) {
        domainInfoMap.set(d.id, d);
      }
    } catch (error) {
      console.error('Failed to fetch domain info:', error);
    }
  }

  // Parse hits
  for (const hit of hitsArray) {
    const hitDef = hit.Hit_def || '';
    const [domainId, range] = hitDef.split(' ');
    const hitNum = parseInt(hit.Hit_num) || 0;

    // Get first HSP (high-scoring pair)
    const hsps = hit.Hit_hsps?.Hsp;
    const hsp = Array.isArray(hsps) ? hsps[0] : hsps;

    if (!hsp) continue;

    const domainInfo = domainInfoMap.get(domainId);

    hits.push({
      num: hitNum,
      domainId,
      range: range || '',
      uid: domainInfo?.uid,
      fid: domainInfo?.fid || undefined,
      familyName: domainInfo?.fname || undefined,
      evalue: parseFloat(hsp['Hsp_evalue']) || 0,
      bitScore: parseFloat(hsp['Hsp_bit-score']) || 0,
      identity: parseInt(hsp['Hsp_identity']) || 0,
      alignLength: parseInt(hsp['Hsp_align-len']) || 0,
      gaps: parseInt(hsp['Hsp_gaps']) || 0,
      queryStart: parseInt(hsp['Hsp_query-from']) || 0,
      queryEnd: parseInt(hsp['Hsp_query-to']) || 0,
      hitStart: parseInt(hsp['Hsp_hit-from']) || 0,
      hitEnd: parseInt(hsp['Hsp_hit-to']) || 0,
      qseq: hsp['Hsp_qseq'] || '',
      hseq: hsp['Hsp_hseq'] || '',
      midline: hsp['Hsp_midline'] || '',
    });
  }

  return hits;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId || !/^[A-Za-z0-9_-]+$/.test(jobId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JOB_ID', message: 'Invalid job ID' } },
      { status: 400 }
    );
  }

  const jobDir = path.join(BLAST_TMP_DIR, `blast${jobId}`);
  const status = await getJobStatus(jobDir, jobId);

  if (status === 'not_found') {
    return NextResponse.json(
      { success: false, error: { code: 'JOB_NOT_FOUND', message: 'BLAST job not found' } },
      { status: 404 }
    );
  }

  if (status === 'failed') {
    const errFile = path.join(jobDir, `${jobId}.err`);
    let errorMessage = 'BLAST job failed';
    try {
      errorMessage = await readFile(errFile, 'utf-8');
    } catch {
      // Use default message
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'failed',
        error: errorMessage,
      },
    });
  }

  if (status !== 'completed') {
    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status,
      },
    });
  }

  // Parse completed results
  try {
    const hits = await parseBlastResults(jobDir, jobId);

    // Read query info
    const seqFile = path.join(jobDir, `${jobId}.seq`);
    let queryLength = 0;
    if (existsSync(seqFile)) {
      const seqContent = await readFile(seqFile, 'utf-8');
      const seqLines = seqContent.split('\n').filter(l => !l.startsWith('>'));
      queryLength = seqLines.join('').replace(/\s/g, '').length;
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'completed',
        queryLength,
        hitCount: hits.length,
        hits,
      },
    });
  } catch (error) {
    console.error('Failed to parse BLAST results:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse BLAST results' } },
      { status: 500 }
    );
  }
}
