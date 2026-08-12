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

  compiler: {
    // Strip the diagnostic logging from production bundles; warnings and
    // errors stay so real problems are still visible in the console.
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Powered-by header is pure overhead on every response
  poweredByHeader: false,
}

module.exports = nextConfig
