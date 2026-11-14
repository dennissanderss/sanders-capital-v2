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
      // Execution Engine is verwijderd; oude (geïndexeerde) URL netjes
      // doorsturen naar de briefing i.p.v. een 404.
      {
        source: '/tools/execution',
        destination: '/tools/fx-selector/v2',
        permanent: true,
      },
      // Audit fase 6: verweesde oude dashboard-pagina. Die vuurde bij elk
      // bezoek POST's af die het trackrecord vervuilden (weekend-calls,
      // dubbele afrekeningen). Permanent doorsturen naar de huidige briefing.
      {
        source: '/tools/fx-selector/tool',
        destination: '/tools/fx-selector/v2',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
