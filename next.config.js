/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to complete when linting errors exist
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to complete when TypeScript errors exist
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
