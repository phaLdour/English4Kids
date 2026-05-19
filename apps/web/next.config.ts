import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: [
    '@e4k/ui',
    '@e4k/audio',
    '@e4k/game-engine',
    '@e4k/content-schema',
    '@e4k/db',
  ],
};

export default nextConfig;
