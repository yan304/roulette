import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google profile pictures
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
};

export default nextConfig;
