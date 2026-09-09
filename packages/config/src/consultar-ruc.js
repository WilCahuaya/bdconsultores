/**
 * Consulta el padrón RUC (SUNAT) vía API intermediaria.
 * Token: SUNAT_RUC_API_TOKEN. URL opcional: SUNAT_RUC_API_URL.
 */

const DEFAULT_URL = "https://api.decolecta.com/v1/sunat/ruc";

function normalizeRuc(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function validarRuc(value) {
  const ruc = normalizeRuc(value);
  if (ruc.length !== 11) return "El RUC debe tener 11 dígitos.";
  return null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function direccionDesdeRespuesta(data) {
  const base = pickString(
    data.direccion,
    data.direccion_completa,
    data.domicilioFiscal,
    data.domicilio_fiscal,
  );
  const extra = [data.distrito, data.provincia, data.departamento]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
  if (base && extra && !base.toLowerCase().includes(extra.split(",")[0].trim().toLowerCase())) {
    return `${base}, ${extra}`;
  }
  return base || extra;
}

/**
 * @param {string} ruc
 * @returns {Promise<{ error?: string; ruc?: string; nombre?: string; direccion?: string; estado?: string }>}
 */
async function consultarRucSunat(ruc) {
  const numero = normalizeRuc(ruc);
  const invalid = validarRuc(numero);
  if (invalid) return { error: invalid };

  const token = process.env.SUNAT_RUC_API_TOKEN?.trim();
  if (!token) {
    return {
      error:
        "Falta configurar SUNAT_RUC_API_TOKEN (token de apis.net.pe / Decolecta) para consultar el RUC.",
    };
  }

  const base = (process.env.SUNAT_RUC_API_URL?.trim() || DEFAULT_URL).replace(/\?.*$/, "");
  const url = `${base}?numero=${encodeURIComponent(numero)}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: "No se pudo consultar el padrón. Intente de nuevo." };
  }

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (response.status === 401 || response.status === 403) {
    return { error: "El token de consulta RUC no es válido." };
  }
  if (response.status === 404) {
    return { error: "No se encontró ese RUC en el padrón." };
  }
  if (response.status === 429) {
    return { error: "Se alcanzó el límite de consultas. Espere un momento." };
  }
  if (!response.ok) {
    const message = pickString(data.message, data.error, data.msg);
    return { error: message || "No se pudo consultar el RUC." };
  }

  const nombre = pickString(data.razonSocial, data.razon_social, data.nombre, data.nombreComercial);
  if (!nombre) return { error: "El padrón no devolvió la razón social." };

  return {
    ruc: numero,
    nombre,
    direccion: direccionDesdeRespuesta(data),
    estado: pickString(data.estado, data.estadoDelContribuyente),
  };
}

module.exports = {
  normalizeRuc,
  validarRuc,
  consultarRucSunat,
};
