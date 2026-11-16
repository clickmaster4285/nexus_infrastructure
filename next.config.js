/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-verify',
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.88.53", "127.0.0.1"],
  devIndicators: false,
};

module.exports = nextConfig;
