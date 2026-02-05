import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Base directory for pre-cut domain files
const DOMAIN_DATA_BASE = '/data/ECOD0/html/af2_pdb_d';

// Convert UID to sharded path
// Structure: {base}/{mid}/{padded_uid}/{padded_uid}.fa
// where mid = first 5 chars of padded UID (9 digits)
function getDomainFastaPath(uid: number): string {
  const paddedUid = uid.toString().padStart(9, '0');
  const mid = paddedUid.substring(0, 5);
  return path.join(DOMAIN_DATA_BASE, mid, paddedUid, `${paddedUid}.fa`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  // Validate UID
  const uidNum = parseInt(uid);
  if (isNaN(uidNum) || uidNum <= 0) {
    return NextResponse.json(
      { error: 'Invalid UID' },
      { status: 400 }
    );
  }

  const fastaPath = getDomainFastaPath(uidNum);

  // Check if file exists
  if (!existsSync(fastaPath)) {
    return NextResponse.json(
      { error: 'Domain FASTA file not found' },
      { status: 404 }
    );
  }

  try {
    const fastaContent = await readFile(fastaPath, 'utf-8');

    return new NextResponse(fastaContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="ecod_${uid}.fasta"`,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error) {
    console.error('Error reading domain FASTA:', error);
    return NextResponse.json(
      { error: 'Failed to read domain FASTA file' },
      { status: 500 }
    );
  }
}
