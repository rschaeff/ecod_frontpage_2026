import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { cleanupOldJobs } from '@/lib/cleanup';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const JOB_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

function safeBearerEqual(authHeader: string | null, token: string): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${token}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // Require admin token
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: 'Admin endpoint not configured' },
      { status: 503 }
    );
  }

  if (!safeBearerEqual(request.headers.get('authorization'), ADMIN_TOKEN)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupOldJobs(JOB_TMP_DIR);
    return NextResponse.json({
      success: true,
      jobsRemoved: result.removed.length,
      jobsScanned: result.scanned,
      removed: result.removed,
      errors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Cleanup failed: ${error}` },
      { status: 500 }
    );
  }
}
