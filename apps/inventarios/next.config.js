const { webAppById } = require("@bd/config");

const app = webAppById("inventarios");

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  basePath: app.basePath,
  // En local el portal (3010) no reenvía el WebSocket de recarga. Los assets
  // de desarrollo salen del propio servidor para que la página no quede en blanco.
  assetPrefix: isDev ? `http://localhost:${app.localPort}${app.basePath}` : undefined,
  transpilePackages: [
    "@bd/auth",
    "@bd/config",
    "@inventario/ui",
    "@inventario/types",
    "@inventario/auth-invite",
    "@inventario/realtime",
  ],
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@supabase\/supabase-js/, message: /process\.version/ },
      { module: /@supabase\/realtime-js/, message: /process\.versions/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
