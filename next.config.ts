import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Floo's Dockerfile copies .next/standalone into a slim runtime image.
  output: "standalone",
};

export default nextConfig;
