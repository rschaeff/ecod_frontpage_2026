import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Configuration
const BLAST_DB = '/data/ECOD0/html/blastdb/ecod100_af2_pdb';
const BLAST_TMP_DIR = '/data/ECOD0/html/af2_pdb/tmpdata';
const BLASTP_PATH = '/sw/apps/ncbi-blast-2.15.0+/bin/blastp';

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
  try {
    const body = await request.json();
    const { sequence, evalue = '0.01' } = body;

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
    const jobDir = path.join(BLAST_TMP_DIR, `blast${jobId}`);

    // Create job directory
    await mkdir(jobDir, { recursive: true });

    // Write sequence file
    const seqFile = path.join(jobDir, `${jobId}.seq`);
    await writeFile(seqFile, `>query\n${validation.sequence}\n`);

    // Create SLURM job script
    const outputFile = path.join(jobDir, `${jobId}_blast.xml`);
    const slurmScript = `#!/bin/bash
#SBATCH --job-name=blast_${jobId}
#SBATCH --output=${jobDir}/${jobId}.out
#SBATCH --error=${jobDir}/${jobId}.err
#SBATCH --time=00:10:00
#SBATCH --cpus-per-task=4
#SBATCH --mem=4G

${BLASTP_PATH} -query ${seqFile} -db ${BLAST_DB} -out ${outputFile} -evalue ${evalue} -outfmt 5 -num_threads 4
`;

    const scriptFile = path.join(jobDir, `${jobId}.slurm`);
    await writeFile(scriptFile, slurmScript);

    // Submit SLURM job
    const { stdout } = await execAsync(`sbatch ${scriptFile}`);
    const slurmJobId = stdout.match(/Submitted batch job (\d+)/)?.[1];

    if (!slurmJobId) {
      return NextResponse.json(
        { success: false, error: { code: 'SUBMIT_FAILED', message: 'Failed to submit BLAST job' } },
        { status: 500 }
      );
    }

    // Save SLURM job ID for status checking
    await writeFile(path.join(jobDir, 'slurm_job_id'), slurmJobId);

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        slurmJobId,
        message: 'BLAST job submitted successfully',
      },
    });

  } catch (error) {
    console.error('BLAST submit error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SUBMIT_ERROR', message: 'Failed to submit BLAST job' } },
      { status: 500 }
    );
  }
}
