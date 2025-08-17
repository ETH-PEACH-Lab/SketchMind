import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "roughjs/bin/rough": path.join(
        path.dirname(require.resolve("roughjs/package.json")),
        "bin/rough.js"
      ),
    };
    return config;
  },
};

export default nextConfig;
