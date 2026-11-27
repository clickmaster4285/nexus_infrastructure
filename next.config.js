/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production prerender cleanup deterministic on Windows.
  experimental: {
    cpus: 1,
  },
  allowedDevOrigins: ["192.168.88.53", "127.0.0.1"],
  devIndicators: false,
};

module.exports = nextConfig;
