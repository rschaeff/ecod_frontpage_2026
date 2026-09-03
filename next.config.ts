import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || '';

// Directories belonging to the legacy PHP site, still reachable at /ecod-legacy.
// Deliberately EXCLUDES the app's own routes (note: legacy "distributions" is in
// the list, the app's singular "distribution" page is not) and build/backup
// detritus that was never a served surface.
const LEGACY_DIRS = [
  'af2', 'af2_d', 'af2_pdb', 'af2_pdb_test', 'aln', 'assignment', 'bin', 'blastdb',
  'complete', 'css', 'data', 'distributions', 'ecodf', 'fancyBox', 'ferredoxin',
  'ferredoxin_shi', 'foldseekdb', 'GLmol', 'human', 'human_d', 'img',
  'jmol-14\\.0\\.4', 'jmol-14\\.1\\.5', 'lib', 'network_component', 'rep',
  'repnonrep', 'rimd', 'rimd_d', 'saltyp', 'sqlite_complete', 'sqlite_test',
  'statistics', 'test', 'tmalign',
].join('|');

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg'],
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Published /ecod/... links that belonged to the legacy site. Since the cutover
  // these reach this app, which has no such routes, and 404. They include our own
  // 2025 paper (index_pdb.php), per-domain data files third parties build from the
  // ecod_uid column of every distributable, and the bulk-download tree cited in
  // papers. sangala's Apache is no longer in the request path, so this is the only
  // place we can catch them. basePath:false so source and destination are both
  // literal and the /ecod prefix is not doubled.
  async redirects() {
    if (!basePath) return [];
    return [
      {
        source: `${basePath}/:file(index[^/]*\\.php)`,
        destination: '/ecod-legacy/:file',
        basePath: false,
        permanent: true,
      },
      {
        // :path+ (one or more), NOT :path* — a bare directory target makes the
        // legacy Apache issue its own trailing-slash 301 to an ABSOLUTE URL built
        // from its internal /ecod//<dir>/ view, which bounces back here and loops.
        // Restricting to sub-paths keeps every file-shaped link working (the bulk
        // downloads, per-uid data files, assets) and leaves bare directory URLs
        // 404ing exactly as they did before, rather than looping. Widen this to
        // :path* only once the double-slash bug at the proxy is fixed.
        source: `${basePath}/:dir(${LEGACY_DIRS})/:path+`,
        destination: '/ecod-legacy/:dir/:path+',
        basePath: false,
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.ebi.ac.uk",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.ebi.ac.uk",
              "font-src 'self' https://fonts.gstatic.com https://www.ebi.ac.uk",
              "img-src 'self' data: blob: https:",
              "frame-src 'self' https://www.ebi.ac.uk",
              "connect-src 'self' https://www.ebi.ac.uk https://files.rcsb.org https://alphafold.ebi.ac.uk",
              "worker-src 'self' blob:",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
