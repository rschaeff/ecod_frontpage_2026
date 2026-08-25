import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import { getClientIp, tryAcquire, release, activeCount, maxConcurrentPerIp } from '@/lib/job-limits';

// Configuration
const BLAST_DB = process.env.BLAST_DB || '/data/ECOD0/html/blastdb/ecod100_af2_pdb';
const BLAST_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';
const BLASTP_PATH = process.env.BLASTP_PATH || '/usr/bin/blastp';
const BLAST_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB — sequences max 10K AAs + JSON overhead

// Validate evalue format to prevent command injection
function isValidEvalue(value: string): boolean {
  return /^\d*\.?\d+(e[+-]?\d+)?$/i.test(value);
}

// Validate sequence (basic FASTA/raw protein sequence)
function validateSequence(seq: string): { valid: boolean; sequence: string; error?: string } {
  // Remove FASTA header if present
  const lines = seq.trim().split('\n');
  let sequence = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      continue; // Skip FASTA header
    }
    sequence += trimmed.toUpperCase();
  }

  // Remove whitespace
  sequence = sequence.replace(/\s/g, '');

  // Check for valid amino acid characters
  const validChars = /^[ACDEFGHIKLMNPQRSTVWXY*-]+$/;
  if (!validChars.test(sequence)) {
    return { valid: false, sequence: '', error: 'Invalid characters in sequence. Only standard amino acid codes are allowed.' };
  }

  // Check length
  if (sequence.length < 10) {
    return { valid: false, sequence: '', error: 'Sequence too short. Minimum 10 amino acids required.' };
  }

  if (sequence.length > 10000) {
    return { valid: false, sequence: '', error: 'Sequence too long. Maximum 10000 amino acids allowed.' };
  }

  return { valid: true, sequence };
}

// Generate a unique job ID
function generateJobId(): string {
  return randomBytes(6).toString('base64url');
}

export async function POST(request: NextRequest) {
  // Tracks the concurrency slot so the outer catch can free it if anything
  // between reservation and spawn throws.
  let reserved: { ip: string; jobId: string } | null = null;

  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 1 MB limit' } },
        { status: 413 }
      );
    }

    // Per-IP concurrent-job cap. Checked before parsing the body so a client at
    // the limit cannot make us do the expensive work; tryAcquire below is the
    // authoritative reservation.
    const clientIp = getClientIp(request);
    if (activeCount(clientIp) >= maxConcurrentPerIp()) {
      return NextResponse.json(
        { success: false, error: { code: 'TOO_MANY_JOBS', message: `Too many concurrent searches from this address (limit ${maxConcurrentPerIp()}). Wait for a running job to finish.` } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { sequence, evalue = '0.01' } = body;

    if (!isValidEvalue(evalue)) {
      return NextResponse.json(
        { error: 'Invalid evalue parameter' },
        { status: 400 }
      );
    }

    if (!sequence) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_SEQUENCE', message: 'No sequence provided' } },
        { status: 400 }
      );
    }

    // Validate sequence
    const validation = validateSequence(sequence);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SEQUENCE', message: validation.error } },
        { status: 400 }
      );
    }

    // Generate job ID and create directory
    const jobId = generateJobId();

    const slot = tryAcquire(clientIp, jobId);
    if (!slot.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'TOO_MANY_JOBS', message: `Too many concurrent searches from this address (limit ${slot.limit}). Wait for a running job to finish.` } },
        { status: 429 }
      );
    }
    reserved = { ip: clientIp, jobId };
    const jobDir = path.join(BLAST_TMP_DIR, `blast${jobId}`);

    // Create job directory
    await mkdir(jobDir, { recursive: true });

    // Write sequence file
    const seqFile = path.join(jobDir, `${jobId}.seq`);
    await writeFile(seqFile, `>query\n${validation.sequence}\n`);

    // Run blastp as a background child process
    const outputFile = path.join(jobDir, `${jobId}_blast.xml`);
    const errFile = path.join(jobDir, `${jobId}.err`);

    try {
      await writeFile(path.join(jobDir, 'status'), 'running');

      const child = spawn(BLASTP_PATH, [
        '-query', seqFile,
        '-db', BLAST_DB,
        '-out', outputFile,
        '-evalue', evalue,
        '-outfmt', '5',
        '-num_threads', '4',
      ], {
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: true,
        env: { ...process.env, LD_LIBRARY_PATH: '/usr/lib64' },
      });

      // Collect stderr
      let stderrData = '';
      child.stderr?.on('data', (chunk: Buffer) => { stderrData += chunk.toString(); });

      // Kill the process if it exceeds the timeout
      const timer = setTimeout(() => {
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch { /* already exited */ }
      }, BLAST_TIMEOUT_MS);
      timer.unref();

      child.on('close', async (code) => {
        release(clientIp, jobId);
        clearTimeout(timer);
        try {
          if (stderrData) await writeFile(errFile, stderrData);
          const timedOut = code === null || code === -1;
          const status = code === 0 ? 'completed' : 'failed';
          if (timedOut) stderrData += '\nProcess killed: exceeded time limit';
          await writeFile(path.join(jobDir, 'status'), status);
        } catch { /* ignore */ }
      });

      child.unref();

      // Save PID for reference
      await writeFile(path.join(jobDir, 'pid'), String(child.pid));

      return NextResponse.json({
        success: true,
        data: {
          jobId,
          message: 'BLAST job submitted successfully',
        },
      });
    } catch (spawnError) {
      release(clientIp, jobId);
      try {
        await rm(jobDir, { recursive: true, force: true });
      } catch { /* ignore */ }
      return NextResponse.json(
        { success: false, error: { code: 'SUBMIT_FAILED', message: 'Failed to start BLAST process' } },
        { status: 500 }
      );
    }

  } catch (error) {
    if (reserved) release(reserved.ip, reserved.jobId);
    console.error('BLAST submit error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SUBMIT_ERROR', message: 'Failed to submit BLAST job' } },
      { status: 500 }
    );
  }
}
