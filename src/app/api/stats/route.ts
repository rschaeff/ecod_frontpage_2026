import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { statsCache, CACHE_TTL, cachedQuery } from '@/lib/cache';
import type { ECODStats } from '@/types/ecod';

export async function GET() {
  try {
    const stats = await cachedQuery<ECODStats>(
      statsCache as unknown as Parameters<typeof cachedQuery>[0],
      'ecod-stats',
      CACHE_TTL.STATS,
      async () => {
        // Get stats from info table (name/value pairs)
        const infoResult = await query<{ name: string; value: string }>(
          `SELECT name, value FROM info`
        );

        // Build lookup map
        const info: Record<string, string> = {};
        for (const row of infoResult) {
          info[row.name] = row.value;
        }

        // Get domain counts by type
        const domainCounts = await query<{ type: string; count: string }>(
          `SELECT type::text, COUNT(*) as count FROM domain GROUP BY type`
        );

        // Get PDB count
        const pdbCount = await query<{ count: string }>(
          `SELECT COUNT(DISTINCT pdb_id) as count FROM domain_pdb`
        );

        // Get protein count (UniProt)
        const proteinCount = await query<{ count: string }>(
          `SELECT COUNT(DISTINCT unp_acc) as count FROM domain WHERE unp_acc IS NOT NULL`
        );

        // Parse counts
        const expCount = domainCounts.find(d => d.type === 'experimental structure')?.count || '0';
        const csmCount = domainCounts.find(d => d.type === 'computed structural model')?.count || '0';

        return {
          version: info['version'] || 'develop',
          updateDate: info['update_date'] || new Date().toISOString().split('T')[0],
          totalDomains: parseInt(info['domain_number'] || '0'),
          totalFamilies: parseInt(info['f_number'] || '0'),
          experimentalDomains: parseInt(expCount),
          computedDomains: parseInt(csmCount),
          totalPDBs: parseInt(pdbCount[0]?.count || '0'),
          totalProteins: parseInt(proteinCount[0]?.count || '0'),
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to fetch statistics',
        },
      },
      { status: 500 }
    );
  }
}
