const { webAppById } = require("@bd/config");

const app = webAppById("planillas");

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  basePath: app.basePath,
  assetPrefix: isDev ? `http://localhost:${app.localPort}${app.basePath}` : undefined,
  transpilePackages: ["@bd/auth", "@bd/config", "@inventario/ui", "@inventario/types", "@inventario/auth-invite"],
  experimental: {
    serverComponentsExternalPackages: ["docx", "xlsx-js-style", "fflate"],
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@supabase\/supabase-js/, message: /process\.version/ },
      { module: /@supabase\/realtime-js/, message: /process\.versions/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
