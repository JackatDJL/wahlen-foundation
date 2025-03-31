/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zqq91qvscm.ufs.sh",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "arvdoawqez6yhriu.public.blob.vercel-storage.com",
        pathname: "/wahlen/**",
      },
    ],
  },
};

import withVercelToolbar from "@vercel/toolbar/plugins/next";

const config = withVercelToolbar()(nextConfig); // Das Soll so / mein got ich musste die Types absuchen für diese Scheiße

export default config;
