import path from 'node:path';
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['roughjs/bin/rough'] = path.resolve(
      './node_modules/roughjs/bin/rough.js'
    );
    return config;
  },
  // 让 Next 确保打包这个包（有时也有帮助）
  transpilePackages: ['@excalidraw/excalidraw'],
};
export default nextConfig;
