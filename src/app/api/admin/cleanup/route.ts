import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldJobs } from '@/lib/cleanup';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const JOB_TMP_DIR = process.env.JOB_TMP_DIR || '/data/ECOD0/html/af2_pdb/tmpdata';

export async function POST(request: NextRequest) {
  // Require admin token
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: 'Admin endpoint not configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
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
