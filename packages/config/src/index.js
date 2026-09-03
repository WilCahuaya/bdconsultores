/**
 * Registro de apps web detrás del Portal.
 * Para sumar un módulo (contabilidad, facturación…): añadir una entrada aquí
 * y crear `apps/<id>` con el mismo `basePath`.
 *
 * @typedef {Object} WebApp
 * @property {string} id
 * @property {string} label
 * @property {string} basePath  Ruta pública, con slash inicial (ej. "/inventarios")
 * @property {number} localPort Puerto de `next dev`
 * @property {string} originEnv Variable de entorno con el origin del deploy (sin path)
 */

/** @type {readonly WebApp[]} */
const webApps = Object.freeze([
  {
    id: "inventarios",
    label: "Inventarios",
    basePath: "/inventarios",
    localPort: 3011,
    originEnv: "INVENTARIOS_ORIGIN",
  },
  {
    id: "planillas",
    label: "Planillas",
    basePath: "/planillas",
    localPort: 3012,
    originEnv: "PLANILLAS_ORIGIN",
  },
]);

const portal = Object.freeze({
  id: "portal",
  label: "Portal",
  localPort: 3010,
});

/**
 * @param {string} id
 * @returns {WebApp}
 */
function webAppById(id) {
  const app = webApps.find((item) => item.id === id);
  if (!app) {
    throw new Error(`App web desconocida: ${id}`);
  }
  return app;
}

/** Origin del Portal (dominio único). */
function portalOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_PORTAL_ORIGIN;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return `http://127.0.0.1:${portal.localPort}`;
}

/**
 * @param {WebApp} app
 * @returns {string}
 */
function originFor(app) {
  const fromEnv = process.env[app.originEnv];
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return `http://127.0.0.1:${app.localPort}`;
}

/**
 * Rewrites del Portal (Next.js Multi Zones).
 * El navegador sigue en el dominio del Portal; Next proxy a cada app.
 *
 * @returns {Array<{ source: string, destination: string }>}
 */
function portalRewrites() {
  return webApps.flatMap((app) => {
    const origin = originFor(app);
    return [
      {
        source: app.basePath,
        destination: `${origin}${app.basePath}`,
      },
      {
        source: `${app.basePath}/:path*`,
        destination: `${origin}${app.basePath}/:path*`,
      },
    ];
  });
}

module.exports = {
  portal,
  webApps,
  webAppById,
  originFor,
  portalOrigin,
  portalRewrites,
};
