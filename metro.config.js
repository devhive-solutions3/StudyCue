// @docs https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow bundling expo-sqlite / wa-sqlite WebAssembly artifacts on web.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// SharedArrayBuffer for SQLite WASM worker (dev server adds headers locally too).
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    // Expo SQLite web worker requires cross-origin isolation.
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

module.exports = config;
