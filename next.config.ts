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
};

export default nextConfig;
