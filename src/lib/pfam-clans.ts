/**
 * Pfam clan lookup from Pfam-A.clans.tsv
 *
 * Loads the Pfam → Clan mapping once and provides lookup functions.
 * Used to enrich domain and cluster data with clan information.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface PfamClanEntry {
  pfamAcc: string;      // e.g., "PF00001"
  clanAcc: string;      // e.g., "CL0192" or "" if no clan
  clanName: string;     // e.g., "GPCR_A"
  pfamId: string;       // e.g., "7tm_1"
  pfamDescription: string;
}

export interface ClanInfo {
  acc: string;          // CL0192
  name: string;         // GPCR_A
}

export interface PfamInfo {
  acc: string;          // PF00001
  id: string;           // 7tm_1
  description: string;
  clan: ClanInfo | null;
}

// Singleton lookup maps
let pfamMap: Map<string, PfamClanEntry> | null = null;

const CLANS_FILE_PATHS = [
  // Production path
  '/data/ECOD0/html/distributions/Pfam-A.clans.tsv',
  // Dev/project path
  path.join(process.cwd(), 'data', 'Pfam-A.clans.tsv'),
];

function loadPfamClans(): Map<string, PfamClanEntry> {
  if (pfamMap) return pfamMap;

  pfamMap = new Map();

  let filePath: string | null = null;
  for (const p of CLANS_FILE_PATHS) {
    if (existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.warn('Pfam-A.clans.tsv not found at any expected path');
    return pfamMap;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      const [pfamAcc, clanAcc, clanName, pfamId, pfamDescription] = line.split('\t');
      if (pfamAcc) {
        pfamMap.set(pfamAcc, {
          pfamAcc,
          clanAcc: clanAcc || '',
          clanName: clanName || '',
          pfamId: pfamId || '',
          pfamDescription: pfamDescription || '',
        });
      }
    }
  } catch (err) {
    console.error('Error loading Pfam clans file:', err);
  }

  return pfamMap;
}

/**
 * Look up a single Pfam accession
 */
export function lookupPfam(pfamAcc: string): PfamInfo | null {
  const map = loadPfamClans();
  const entry = map.get(pfamAcc);
  if (!entry) return null;

  return {
    acc: entry.pfamAcc,
    id: entry.pfamId,
    description: entry.pfamDescription,
    clan: entry.clanAcc ? { acc: entry.clanAcc, name: entry.clanName } : null,
  };
}

/**
 * Resolve a comma-separated pfam_acc string (as stored in the cluster table)
 * into structured Pfam+Clan info.
 */
export function resolvePfamAccessions(pfamAccStr: string | null): PfamInfo[] {
  if (!pfamAccStr) return [];

  const map = loadPfamClans();
  const accs = pfamAccStr.split(',').map(s => s.trim()).filter(Boolean);
  const results: PfamInfo[] = [];

  for (const acc of accs) {
    const entry = map.get(acc);
    if (entry) {
      results.push({
        acc: entry.pfamAcc,
        id: entry.pfamId,
        description: entry.pfamDescription,
        clan: entry.clanAcc ? { acc: entry.clanAcc, name: entry.clanName } : null,
      });
    } else {
      // Pfam accession not in clans file - include without clan info
      results.push({
        acc,
        id: acc,
        description: '',
        clan: null,
      });
    }
  }

  return results;
}

/**
 * Get distinct clans from a list of PfamInfo entries
 */
export function getDistinctClans(pfamInfos: PfamInfo[]): ClanInfo[] {
  const seen = new Set<string>();
  const clans: ClanInfo[] = [];

  for (const info of pfamInfos) {
    if (info.clan && !seen.has(info.clan.acc)) {
      seen.add(info.clan.acc);
      clans.push(info.clan);
    }
  }

  return clans;
}
