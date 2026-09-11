const { webAppById } = require("@bd/config");

const app = webAppById("planillas");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: app.basePath,
  transpilePackages: ["@bd/auth", "@bd/config", "@inventario/ui", "@inventario/types", "@inventario/auth-invite"],
  experimental: {
    serverComponentsExternalPackages: ["docx", "xlsx-js-style"],
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
