import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-builder/shared'],
  output: 'standalone',
}

export default nextConfig
