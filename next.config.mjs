/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabled to avoid double-initializing the Leaflet map in dev (StrictMode
  // mounts effects twice). Re-enable if you add StrictMode-safe guards.
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
