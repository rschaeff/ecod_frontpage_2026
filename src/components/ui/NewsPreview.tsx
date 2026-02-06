'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { NewsItem } from '@/types/ecod';

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  release: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  update: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  announcement: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function NewsPreview() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news?limit=3')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNews(data.data.news);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Latest News</h2>
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (news.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Latest News</h2>
        <Link
          href="/news"
          className="text-base text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {news.map(item => {
          const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.update;
          const content = (
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 sm:w-64 shrink-0">
                <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                  {item.category}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatDate(item.date)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-base">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {item.summary}
                </p>
              </div>
            </div>
          );

          if (item.link) {
            const isExternal = item.link.startsWith('http');
            if (isExternal) {
              return (
                <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              );
            }
            return (
              <Link key={item.id} href={item.link}>
                {content}
              </Link>
            );
          }

          return <div key={item.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}
