import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const remoteApiBaseUrl = process.env.REMOTE_API_BASE_URL?.trim();

    // Default to this app's own routes. Only proxy when a remote backend is explicitly configured.
    if (!remoteApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${remoteApiBaseUrl}/api/:path*`,
      },
      {
        source: "/r/:slug",
        destination: `${remoteApiBaseUrl}/r/:slug`,
      },
    ];
  },
};

export default nextConfig;
