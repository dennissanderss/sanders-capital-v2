import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // TODO: fix type errors and set to false
  },
  turbopack: {
    root: '.',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'chart.js', 'react-chartjs-2'],
  },
  async redirects() {
    return [
      // Alle oude tool-URL's (Execution Engine, oude dashboards, Daily
      // Macro Briefing) komen uit op de ene overgebleven tool: de
      // Fundamental Briefing (v4-engine). Zie docs/audit/fundamental-audit.md.
      {
        source: '/tools/execution',
        destination: '/tools/fundamental-briefing',
        permanent: true,
      },
      {
        source: '/tools/fx-selector/tool',
        destination: '/tools/fundamental-briefing',
        permanent: true,
      },
      {
        source: '/tools/fx-selector/v2',
        destination: '/tools/fundamental-briefing',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
