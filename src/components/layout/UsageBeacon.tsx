'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { basePath } from '@/lib/config';

/**
 * Reports one anonymous page view per route change (including client-side
 * navigation). No cookies or storage are used; see /privacy.
 */
export default function UsageBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer || null });
    const url = `${basePath}/api/usage`;
    try {
      if (!navigator.sendBeacon?.(url, body)) {
        void fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      // never let statistics break the page
    }
  }, [pathname]);

  return null;
}
