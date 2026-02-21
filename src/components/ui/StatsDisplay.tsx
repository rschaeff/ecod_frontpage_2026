'use client';

import { useEffect, useState } from 'react';
import type { ECODStats } from '@/types/ecod';
import { basePath } from '@/lib/config';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toLocaleString();
}

export default function StatsDisplay() {
  const [stats, setStats] = useState<ECODStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${basePath}/api/stats`);
        const data = await response.json();

        if (data.success) {
          setStats(data.data);
        } else {
          setError(data.error?.message || 'Failed to load stats');
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        <StatCard label="Total Domains" value="—" />
        <StatCard label="Families" value="—" />
        <StatCard label="From PDB" value="—" />
        <StatCard label="From AFDB" value="—" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
      <StatCard
        label="Total Domains"
        value={formatNumber(stats.totalDomains)}
        subtitle="classified"
      />
      <StatCard
        label="Families"
        value={formatNumber(stats.totalFamilies)}
        subtitle="F-groups"
      />
      <StatCard
        label="From PDB"
        value={formatNumber(stats.experimentalDomains)}
        subtitle="experimental domains"
      />
      <StatCard
        label="From AFDB"
        value={formatNumber(stats.computedDomains)}
        subtitle="predicted domains"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {subtitle && (
        <div className="text-xs text-gray-400">{subtitle}</div>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-20"></div>
    </div>
  );
}
