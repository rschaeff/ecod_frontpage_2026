import { NextResponse } from 'next/server';
import { healthCheck, getPoolStats } from '@/lib/db';
import { existsSync, statfsSync } from 'fs';

const BLASTP_PATH = process.env.BLASTP_PATH || '/sw/apps/ncbi-blast-2.15.0+/bin/blastp';
const FOLDSEEK_PATH = process.env.FOLDSEEK_PATH || '/sw/apps/Anaconda3-2023.09-0/bin/foldseek';
const JOB_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

export async function GET() {
  const checks: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  };

  // Database check
  try {
    const dbResult = await healthCheck();
    const poolStats = getPoolStats();
    checks.database = { connected: dbResult.ok, latency: dbResult.latency, pool: poolStats };
  } catch {
    checks.database = { connected: false, error: 'Health check failed' };
    checks.status = 'degraded';
  }

  // Binary checks
  checks.binaries = {
    blastp: existsSync(BLASTP_PATH),
    foldseek: existsSync(FOLDSEEK_PATH),
  };

  if (!existsSync(BLASTP_PATH) || !existsSync(FOLDSEEK_PATH)) {
    checks.status = 'degraded';
  }

  // Disk space check
  try {
    const stats = statfsSync(JOB_TMP_DIR);
    const freeGB = (stats.bfree * stats.bsize) / (1024 * 1024 * 1024);
    const totalGB = (stats.blocks * stats.bsize) / (1024 * 1024 * 1024);
    checks.disk = {
      path: JOB_TMP_DIR,
      freeGB: Math.round(freeGB * 100) / 100,
      totalGB: Math.round(totalGB * 100) / 100,
      usedPercent: Math.round((1 - freeGB / totalGB) * 10000) / 100,
    };

    if (freeGB < 1) {
      checks.status = 'degraded';
    }
  } catch {
    checks.disk = { error: 'Could not check disk space' };
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
