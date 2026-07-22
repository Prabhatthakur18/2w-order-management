import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads are served through authenticated route handlers, never statically.
  // Keep the body limit tight; artwork/receipts are compressed client-side first.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
