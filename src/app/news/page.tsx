'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { NewsItem } from '@/types/ecod';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  release: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Release' },
  update: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Update' },
  announcement: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Announcement' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/news')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load news');
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setNews(data.data.news);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">News & Updates</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Announcements, releases, and updates from ECOD.
        </p>
      </div>

      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && news.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No news items available.</p>
        </div>
      )}

      {!loading && news.length > 0 && (
        <div className="space-y-4">
          {news.map(item => {
            const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.update;

            return (
              <article
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <time className="text-sm text-gray-500 dark:text-gray-400" dateTime={item.date}>
                    {formatDate(item.date)}
                  </time>
                </div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {item.title}
                </h2>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {item.summary}
                </p>

                {item.link && (
                  <NewsLink href={item.link} />
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function NewsLink({ href }: { href: string }) {
  const isExternal = href.startsWith('http');
  const label = isExternal ? 'Read more →' : 'View details →';

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
      {label}
    </Link>
  );
}
