const { webAppById } = require("@bd/config");

const app = webAppById("planillas");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: app.basePath,
  transpilePackages: ["@bd/auth", "@bd/config", "@inventario/ui", "@inventario/types", "@inventario/auth-invite"],
  experimental: {
    serverComponentsExternalPackages: ["docx"],
  },
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
