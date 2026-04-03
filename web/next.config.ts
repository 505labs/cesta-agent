import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Fix lit ESM resolution for @reown/appkit in SSR
    if (isServer) {
      config.externals.push("lit", "@lit/reactive-element");
    }
    // Force webpack to use browser export conditions for lit
    config.resolve.conditionNames = ["browser", "import", "default"];
    return config;
  },
};

export default nextConfig;
