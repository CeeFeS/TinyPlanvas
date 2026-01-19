/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Ignore ESLint errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Ignore TypeScript errors during production build (optional, for faster builds)
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Enable experimental features for App Router
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

module.exports = nextConfig
