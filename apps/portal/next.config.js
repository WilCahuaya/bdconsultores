const { portalRewrites } = require("@bd/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@bd/auth", "@bd/config", "@inventario/ui", "@inventario/types", "@inventario/auth-invite"],
  async rewrites() {
    return portalRewrites();
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
