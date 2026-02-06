import { readdir, stat, rm } from 'fs/promises';
import path from 'path';

const DEFAULT_MAX_AGE_DAYS = 7;

export interface CleanupResult {
  removed: string[];
  errors: string[];
  scanned: number;
}

export async function cleanupOldJobs(
  tmpDir: string,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS
): Promise<CleanupResult> {
  const result: CleanupResult = { removed: [], errors: [], scanned: 0 };
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  let entries: string[];
  try {
    entries = await readdir(tmpDir);
  } catch (err) {
    result.errors.push(`Failed to read directory ${tmpDir}: ${err}`);
    return result;
  }

  for (const entry of entries) {
    result.scanned++;
    const fullPath = path.join(tmpDir, entry);

    try {
      const stats = await stat(fullPath);
      if (!stats.isDirectory()) continue;

      if (stats.mtimeMs < cutoff) {
        // Safety: only remove if path is under tmpDir
        if (!fullPath.startsWith(path.resolve(tmpDir))) {
          result.errors.push(`Skipped suspicious path: ${fullPath}`);
          continue;
        }
        await rm(fullPath, { recursive: true, force: true });
        result.removed.push(entry);
      }
    } catch (err) {
      result.errors.push(`Error processing ${entry}: ${err}`);
    }
  }

  return result;
}
