/**
 * DrugBank drug names for DrugBank accessions linked from DrugDomain.
 *
 * Built offline by scripts/build_drug_names.py (DrugBank names via the RCSB PDB
 * Data API) and loaded once. Names are looked up by the DrugBank accession ECOD
 * itself stores, never by ligand code alone, so a name can only attach to the
 * drug it belongs to.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

interface DrugNameFile {
  meta: { source: string; generated: string };
  byDrugbank: Record<string, string>;
}

const FILE_PATHS = [path.join(process.cwd(), 'data', 'drug_names.json')];

let cache: DrugNameFile | null | undefined;

function load(): DrugNameFile | null {
  if (cache !== undefined) return cache;
  cache = null;
  const filePath = FILE_PATHS.find(p => existsSync(p));
  if (!filePath) {
    console.warn('drug_names.json not found; DrugBank names disabled');
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(filePath, 'utf-8')) as DrugNameFile;
  } catch (err) {
    console.error('Error loading drug names:', err);
  }
  return cache;
}

/** DrugBank's name for an accession (e.g. DB00619 -> "Imatinib"), or null. */
export function getDrugName(drugbankAcc: string | null | undefined): string | null {
  if (!drugbankAcc) return null;
  return load()?.byDrugbank[drugbankAcc] ?? null;
}
