// import type { NextConfig } from "next";
// import path from "path";

// const nextConfig: NextConfig = {
//   output: "standalone",
//   webpack: (config) => {
//     config.resolve.alias = {
//       ...config.resolve.alias,
//       "roughjs/bin/rough": path.join(
//         path.dirname(require.resolve("roughjs/package.json")),
//         "bin/rough.js"
//       ),
//     };
//     return config;
//   },
// };

// export default nextConfig;
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   // Don’t fail the production build on ESLint issues
//   eslint: { ignoreDuringBuilds: true },

//   // Don’t fail the production build on TS errors
//   typescript: { ignoreBuildErrors: true },

//   // (optional) silence the dev origin warning you saw earlier
//   // experimental: {
//   //   allowedDevOrigins: ['http://localhost:5090'],
//   // },
// };

// module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    // 固定到容器内后端
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:5095/:path*' }];
  },
};
module.exports = nextConfig;

