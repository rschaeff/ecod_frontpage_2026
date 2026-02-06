import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { distributionsCache, CACHE_TTL, HTTP_CACHE_MAX_AGE, cachedQuery } from '@/lib/cache';

const DISTRIBUTIONS_DIR = '/data/ECOD0/html/distributions';
const BASE_URL = 'http://prodata.swmed.edu/ecod/distributions';

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  url: string;
  modified: string;
}

interface VersionInfo {
  version: string;
  date: string;
  releaseNotes?: string;
  files: {
    main: FileInfo[];
    f40: FileInfo[];
    f70: FileInfo[];
    f99: FileInfo[];
    blast: FileInfo[];
    other: FileInfo[];
  };
}

interface DistributionData {
  currentVersion: VersionInfo | null;
  previousVersions: { version: string; date: string }[];
  specialDatasets: {
    marginalDomains: FileInfo[];
    other: FileInfo[];
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileInfo(filename: string): FileInfo | null {
  try {
    const filepath = path.join(DISTRIBUTIONS_DIR, filename);
    const stats = fs.statSync(filepath);
    return {
      name: filename,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      url: `${BASE_URL}/${filename}`,
      modified: stats.mtime.toISOString().split('T')[0],
    };
  } catch {
    return null;
  }
}

function parseVersionFromFilename(filename: string): { version: string; type: string } | null {
  // Match patterns like ecod.v293.1.domains.txt or ecod.develop292.domains.txt
  const match = filename.match(/^ecod\.(v[\d.]+|develop\d+)\.(.+)$/);
  if (match) {
    return { version: match[1], type: match[2] };
  }
  return null;
}

function getVersionDate(version: string): string {
  // Try to read release notes for date, otherwise estimate from files
  const releaseNotesFile = `RELEASE_NOTES_${version.toUpperCase().replace('.', '_')}.md`;
  try {
    const content = fs.readFileSync(path.join(DISTRIBUTIONS_DIR, releaseNotesFile), 'utf-8');
    const dateMatch = content.match(/Release Date:\*?\*?\s*(.+)/i);
    if (dateMatch) {
      return dateMatch[1].trim();
    }
  } catch {
    // Ignore - use file dates instead
  }

  // Try to get date from domain file
  try {
    const domainFile = path.join(DISTRIBUTIONS_DIR, `ecod.${version}.domains.txt`);
    const stats = fs.statSync(domainFile);
    return stats.mtime.toISOString().split('T')[0];
  } catch {
    return 'Unknown';
  }
}

function getReleaseNotes(version: string): string | undefined {
  const variants = [
    `RELEASE_NOTES_${version.toUpperCase().replace(/\./g, '_')}.md`,
    `RELEASE_NOTES_${version.toUpperCase()}.md`,
  ];

  for (const filename of variants) {
    try {
      const content = fs.readFileSync(path.join(DISTRIBUTIONS_DIR, filename), 'utf-8');
      return content;
    } catch {
      continue;
    }
  }
  return undefined;
}

function categorizeVersionFiles(version: string, files: string[]): VersionInfo['files'] {
  const result: VersionInfo['files'] = {
    main: [],
    f40: [],
    f70: [],
    f99: [],
    blast: [],
    other: [],
  };

  const prefix = `ecod.${version}.`;
  const versionFiles = files.filter(f => f.startsWith(prefix));

  for (const filename of versionFiles) {
    const info = getFileInfo(filename);
    if (!info) continue;

    const suffix = filename.slice(prefix.length);

    if (suffix.startsWith('F40.')) {
      result.f40.push(info);
    } else if (suffix.startsWith('F70.')) {
      result.f70.push(info);
    } else if (suffix.startsWith('F99.')) {
      result.f99.push(info);
    } else if (suffix.startsWith('blast.')) {
      result.blast.push(info);
    } else if (['domains.txt', 'names.txt', 'fa', 'hierarchy.txt', 'md5', 'f_id_pfam_acc.txt'].some(s => suffix === s)) {
      result.main.push(info);
    } else {
      result.other.push(info);
    }
  }

  // Sort each category by filename
  for (const category of Object.keys(result) as (keyof typeof result)[]) {
    result[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

async function buildDistributionData(): Promise<DistributionData> {
  const files = fs.readdirSync(DISTRIBUTIONS_DIR);

  // Find all versions
  const versions = new Set<string>();
  for (const file of files) {
    const parsed = parseVersionFromFilename(file);
    if (parsed) {
      versions.add(parsed.version);
    }
  }

  // Sort versions (v### > develop###, then by number)
  const sortedVersions = Array.from(versions).sort((a, b) => {
    const aIsV = a.startsWith('v');
    const bIsV = b.startsWith('v');
    if (aIsV !== bIsV) return bIsV ? 1 : -1; // v versions first

    // Extract numbers for comparison
    const aNum = parseFloat(a.replace(/^(v|develop)/, ''));
    const bNum = parseFloat(b.replace(/^(v|develop)/, ''));
    return bNum - aNum; // Descending
  });

  // Current version is the first one
  const currentVersion = sortedVersions[0];

  // Build current version info
  let currentVersionInfo: VersionInfo | null = null;
  if (currentVersion) {
    currentVersionInfo = {
      version: currentVersion,
      date: getVersionDate(currentVersion),
      releaseNotes: getReleaseNotes(currentVersion),
      files: categorizeVersionFiles(currentVersion, files),
    };
  }

  // Previous versions (just basic info, limit to 5)
  const previousVersions = sortedVersions.slice(1, 6).map(version => ({
    version,
    date: getVersionDate(version),
  }));

  // Special datasets (marginal domains, etc.)
  const marginalDomainFiles = files
    .filter(f => f.includes('af2_all') || f.includes('partial') || f.includes('simple_topology') || f.includes('low_confidence'))
    .map(f => getFileInfo(f))
    .filter((f): f is FileInfo => f !== null);

  // Other special files
  const otherSpecialFiles = files
    .filter(f =>
      (f.includes('unassigned') || f.includes('no_pfam') || f.includes('target')) &&
      !f.startsWith('ecod.')
    )
    .map(f => getFileInfo(f))
    .filter((f): f is FileInfo => f !== null);

  return {
    currentVersion: currentVersionInfo,
    previousVersions,
    specialDatasets: {
      marginalDomains: marginalDomainFiles,
      other: otherSpecialFiles,
    },
  };
}

export async function GET() {
  try {
    const data = await cachedQuery<DistributionData>(
      distributionsCache,
      'distributions',
      CACHE_TTL.DISTRIBUTIONS,
      buildDistributionData
    );

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${HTTP_CACHE_MAX_AGE.DISTRIBUTIONS}, stale-while-revalidate=300`,
      },
    });
  } catch (error) {
    console.error('Error reading distributions:', error);
    return NextResponse.json(
      { error: 'Failed to read distribution data' },
      { status: 500 }
    );
  }
}
