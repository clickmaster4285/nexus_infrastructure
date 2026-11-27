/** @type {import('next').NextConfig} */
const nextConfig = {
  // Extra hosts allowed to load the dev server (e.g. your LAN IP). Comma-separated, set in .env.local.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
};

module.exports = nextConfig;
