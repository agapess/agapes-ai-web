/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-builder/shared'],
  output: 'standalone',
}

module.exports = nextConfig
