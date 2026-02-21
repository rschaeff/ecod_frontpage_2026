import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { newsCache, CACHE_TTL, HTTP_CACHE_MAX_AGE, cachedQuery } from '@/lib/cache';
import type { NewsItem } from '@/types/ecod';

const NEWS_FILE = process.env.NEWS_FILE || '/data/ECOD0/html/distributions/news.json';

async function loadNews(): Promise<NewsItem[]> {
  try {
    const content = fs.readFileSync(NEWS_FILE, 'utf-8');
    const data = JSON.parse(content);
    const news: NewsItem[] = data.news || [];
    // Sort by date descending
    news.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return news;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '0');

    let news = await cachedQuery<NewsItem[]>(
      newsCache,
      'news',
      CACHE_TTL.NEWS,
      loadNews
    );

    if (limit > 0) {
      news = news.slice(0, limit);
    }

    return NextResponse.json(
      { success: true, data: { news } },
      {
        headers: {
          'Cache-Control': `public, max-age=${HTTP_CACHE_MAX_AGE.NEWS}, stale-while-revalidate=300`,
        },
      }
    );
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json(
      { success: false, error: { code: 'NEWS_ERROR', message: 'Failed to load news' } },
      { status: 500 }
    );
  }
}
