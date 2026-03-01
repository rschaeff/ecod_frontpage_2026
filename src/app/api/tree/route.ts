import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { treeCache, CACHE_TTL, HTTP_CACHE_MAX_AGE, cachedQuery } from '@/lib/cache';
import { resolvePfamAccessions, getDistinctClans } from '@/lib/pfam-clans';

interface ClusterRow {
  id: string;
  type: string;
  name: string;
  parent: string | null;
  domain_number: number | null;
  child_count: string;
  pfam_acc: string | null;
  clan_acc: string | null;
}

interface ClanDiversityRow {
  parent_id: string;
  clan_count: string;
  pfam_count: string;
  clan_list: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parentId = searchParams.get('parent');

  const cacheKey = `tree-${parentId || 'root'}`;

  try {
    const nodes = await cachedQuery(
      treeCache,
      cacheKey,
      CACHE_TTL.TREE,
      async () => {
        let clusters: ClusterRow[];

        if (!parentId) {
          // Fetch root level - Architectures (type = 'A')
          clusters = await query<ClusterRow>(`
            SELECT
              c.id,
              c.type,
              c.name,
              c.parent,
              c.domain_number,
              c.pfam_acc,
              c.clan_acc,
              (SELECT COUNT(*) FROM cluster WHERE parent = c.id)::text as child_count
            FROM cluster c
            WHERE c.type = 'A' AND (c.is_obsolete IS NULL OR c.is_obsolete = false)
            ORDER BY c.ordinal NULLS LAST, c.id
          `);
        } else {
          // Fetch children of the given parent
          clusters = await query<ClusterRow>(`
            SELECT
              c.id,
              c.type,
              c.name,
              c.parent,
              c.domain_number,
              c.pfam_acc,
              c.clan_acc,
              (SELECT COUNT(*) FROM cluster WHERE parent = c.id)::text as child_count
            FROM cluster c
            WHERE c.parent = $1 AND (c.is_obsolete IS NULL OR c.is_obsolete = false)
            ORDER BY c.ordinal NULLS LAST, c.id
          `, [parentId]);
        }

        // For H-groups and T-groups, compute clan diversity using clan_acc from DB
        const tNodes = clusters.filter(c => c.type === 'T');
        const hNodes = clusters.filter(c => c.type === 'H');
        const clanDiversityMap = new Map<string, { clanCount: number; pfamCount: number; clans: { acc: string; name: string }[] }>();

        // Batch query for T-groups: count distinct clans across child F-groups
        if (tNodes.length > 0) {
          const tIds = tNodes.map(n => n.id);
          const placeholders = tIds.map((_, i) => `$${i + 1}`).join(', ');
          const rows = await query<ClanDiversityRow>(`
            SELECT
              f.parent as parent_id,
              COUNT(DISTINCT ca.clan)::text as clan_count,
              COUNT(DISTINCT pa.pfam)::text as pfam_count,
              string_agg(DISTINCT ca.clan, ',' ORDER BY ca.clan) as clan_list
            FROM cluster f
            CROSS JOIN LATERAL unnest(string_to_array(f.clan_acc, ',')) AS ca(clan)
            CROSS JOIN LATERAL unnest(string_to_array(f.pfam_acc, ',')) AS pa(pfam)
            WHERE f.parent IN (${placeholders}) AND f.type = 'F'
              AND f.clan_acc IS NOT NULL AND f.clan_acc != ''
              AND (f.is_obsolete IS NULL OR f.is_obsolete = false)
            GROUP BY f.parent
          `, tIds);

          for (const row of rows) {
            const clans = row.clan_list ? row.clan_list.split(',').map(acc => {
              const trimmed = acc.trim();
              return { acc: trimmed, name: trimmed };
            }) : [];
            clanDiversityMap.set(row.parent_id, {
              clanCount: parseInt(row.clan_count),
              pfamCount: parseInt(row.pfam_count),
              clans,
            });
          }
        }

        // Batch query for H-groups: count distinct clans across grandchild F-groups
        if (hNodes.length > 0) {
          const hIds = hNodes.map(n => n.id);
          const placeholders = hIds.map((_, i) => `$${i + 1}`).join(', ');
          const rows = await query<ClanDiversityRow>(`
            SELECT
              t.parent as parent_id,
              COUNT(DISTINCT ca.clan)::text as clan_count,
              COUNT(DISTINCT pa.pfam)::text as pfam_count,
              string_agg(DISTINCT ca.clan, ',' ORDER BY ca.clan) as clan_list
            FROM cluster f
            JOIN cluster t ON f.parent = t.id
            CROSS JOIN LATERAL unnest(string_to_array(f.clan_acc, ',')) AS ca(clan)
            CROSS JOIN LATERAL unnest(string_to_array(f.pfam_acc, ',')) AS pa(pfam)
            WHERE t.parent IN (${placeholders}) AND f.type = 'F'
              AND f.clan_acc IS NOT NULL AND f.clan_acc != ''
              AND (f.is_obsolete IS NULL OR f.is_obsolete = false)
              AND (t.is_obsolete IS NULL OR t.is_obsolete = false)
            GROUP BY t.parent
          `, hIds);

          for (const row of rows) {
            const clans = row.clan_list ? row.clan_list.split(',').map(acc => {
              const trimmed = acc.trim();
              return { acc: trimmed, name: trimmed };
            }) : [];
            clanDiversityMap.set(row.parent_id, {
              clanCount: parseInt(row.clan_count),
              pfamCount: parseInt(row.pfam_count),
              clans,
            });
          }
        }

        // Resolve clan names from the lookup table for diversity badges
        const allClanAccs = new Set<string>();
        for (const d of clanDiversityMap.values()) {
          for (const cl of d.clans) allClanAccs.add(cl.acc);
        }
        const clanNameMap = new Map<string, string>();
        if (allClanAccs.size > 0) {
          const clanAccList = Array.from(allClanAccs);
          const placeholders = clanAccList.map((_, i) => `$${i + 1}`).join(', ');
          const nameRows = await query<{ clan_acc: string; clan_name: string }>(`
            SELECT DISTINCT clan_acc, clan_name FROM pfam_clan_lookup
            WHERE clan_acc IN (${placeholders})
          `, clanAccList);
          for (const row of nameRows) {
            clanNameMap.set(row.clan_acc, row.clan_name);
          }
          // Update clan names in the diversity map
          for (const d of clanDiversityMap.values()) {
            for (const cl of d.clans) {
              cl.name = clanNameMap.get(cl.acc) || cl.acc;
            }
          }
        }

        return clusters.map(c => {
          // Resolve Pfam/clan for F-groups
          let pfam = undefined;
          if (c.type === 'F' && c.pfam_acc) {
            const pfamInfos = resolvePfamAccessions(c.pfam_acc);
            const clans = getDistinctClans(pfamInfos);
            pfam = {
              families: pfamInfos.map(p => ({
                acc: p.acc,
                id: p.id,
                clan: p.clan ? p.clan.acc : null,
              })),
              clans: clans.map(cl => ({ acc: cl.acc, name: cl.name })),
            };
          }

          // Clan diversity for H/T-groups
          let clanDiversity = undefined;
          const diversity = clanDiversityMap.get(c.id);
          if (diversity && diversity.clanCount > 0) {
            clanDiversity = {
              clanCount: diversity.clanCount,
              pfamCount: diversity.pfamCount,
              clans: diversity.clans,
            };
          }

          return {
            id: c.id,
            type: c.type,
            name: c.name || `Unnamed ${c.type}-group`,
            parent: c.parent,
            domainCount: c.domain_number,
            childCount: parseInt(c.child_count) || 0,
            hasChildren: parseInt(c.child_count) > 0,
            ...(pfam ? { pfam } : {}),
            ...(clanDiversity ? { clanDiversity } : {}),
          };
        });
      }
    );

    return NextResponse.json(
      { success: true, data: nodes },
      {
        headers: {
          'Cache-Control': `public, max-age=${HTTP_CACHE_MAX_AGE.TREE}, stale-while-revalidate=60`,
        },
      }
    );
  } catch (error) {
    console.error('Error fetching tree:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TREE_ERROR',
          message: 'Failed to fetch tree data',
        },
      },
      { status: 500 }
    );
  }
}
