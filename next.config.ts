import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",  // <=== enables static exports
  reactStrictMode: true,
};

export default nextConfig;
