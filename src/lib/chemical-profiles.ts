/**
 * Per-X-group chemical profiles of ligand binding.
 *
 * Built offline by scripts/build_chemical_profiles.py from DrugDomain
 * cross-references and a ClassyFire classification of PDB ligands, one file per
 * release, and loaded once. See that script for the method.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface EnrichmentRow {
  superclass: string;
  observed: number;     // proteins in the X-group binding the superclass
  expected: number;     // proteins expected from the overall frequency
  ratio: number | null; // observed / expected
  q: number | null;     // Benjamini-Hochberg q; null when not tested
  tested: boolean;      // expected >= meta.minExpected
}

export interface ChemicalProfile {
  name: string | null;
  proteins: number;
  superclasses: number;
  per20: number | null;           // superclasses per 20 proteins (rarefied)
  per20Percentile: number | null; // among X-groups with >= 20 proteins
  enrichment: EnrichmentRow[];
}

export interface ChemicalProfileMeta {
  release: string;
  generated: string;
  pairs: number;
  xGroups: number;
  rarefiedXGroups: number;
  k: number;
  minExpected: number;
  per20Median: number | null;
  testedCells: number;
}

interface ProfileFile {
  meta: ChemicalProfileMeta;
  profiles: Record<string, ChemicalProfile>;
}

const PROFILE_FILE_PATHS = [
  path.join(process.cwd(), 'data', 'chemical_profiles.json'),
];

let cache: ProfileFile | null | undefined;

function load(): ProfileFile | null {
  if (cache !== undefined) return cache;
  cache = null;
  const filePath = PROFILE_FILE_PATHS.find(p => existsSync(p));
  if (!filePath) {
    console.warn('chemical_profiles.json not found; chemical profiles disabled');
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(filePath, 'utf-8')) as ProfileFile;
  } catch (err) {
    console.error('Error loading chemical profiles:', err);
  }
  return cache;
}

/** The profile of an X-group, with the file's metadata, or null if none. */
export function getChemicalProfile(
  xGroupId: string
): { profile: ChemicalProfile; meta: ChemicalProfileMeta } | null {
  const f = load();
  const profile = f?.profiles[xGroupId];
  return f && profile ? { profile, meta: f.meta } : null;
}
