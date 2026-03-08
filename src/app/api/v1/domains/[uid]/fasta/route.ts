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

  const fastaPath = getDomainDataPath(uidNum, 'fa');

  if (!existsSync(fastaPath)) {
    return NextResponse.json({ error: 'Domain FASTA file not found' }, { status: 404 });
  }

  try {
    const fastaContent = await readFile(fastaPath, 'utf-8');

    return new NextResponse(fastaContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="ecod_${uid}.fasta"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error reading domain FASTA:', error);
    return NextResponse.json({ error: 'Failed to read domain FASTA file' }, { status: 500 });
  }
}
