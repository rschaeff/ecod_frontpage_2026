import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getDomainDataPath } from '@/lib/domain-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  const uidNum = parseInt(uid);
  if (isNaN(uidNum) || uidNum < 0) {
    return NextResponse.json({ error: 'Invalid UID' }, { status: 400 });
  }

  const pdbPath = getDomainDataPath(uidNum, 'pdb');

  if (!existsSync(pdbPath)) {
    return NextResponse.json({ error: 'Domain PDB file not found' }, { status: 404 });
  }

  try {
    const pdbContent = await readFile(pdbPath, 'utf-8');

    return new NextResponse(pdbContent, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-pdb',
        'Content-Disposition': `attachment; filename="ecod_${uid}.pdb"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error reading domain PDB:', error);
    return NextResponse.json({ error: 'Failed to read domain PDB file' }, { status: 500 });
  }
}
