import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg'],
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
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
