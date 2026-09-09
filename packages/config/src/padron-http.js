function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function rucToken() {
  return process.env.SUNAT_RUC_API_TOKEN?.trim() || process.env.RENIEC_DNI_API_TOKEN?.trim();
}

function dniToken() {
  return process.env.RENIEC_DNI_API_TOKEN?.trim() || process.env.SUNAT_RUC_API_TOKEN?.trim();
}

function decolectaToken() {
  return rucToken() || dniToken();
}

/**
 * @param {string} url
 * @param {string} [token]
 * @returns {Promise<{ error?: string; data?: Record<string, unknown> }>}
 */
async function fetchPadronJson(url, token = decolectaToken()) {
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
    return { error: "El token de consulta no es válido." };
  }
  if (response.status === 429) {
    return { error: "Se alcanzó el límite de consultas. Espere un momento." };
  }
  if (response.status === 404) {
    return { error: "not_found", data };
  }
  if (!response.ok) {
    const message = pickString(data.message, data.error, data.msg);
    return { error: message || "No se pudo consultar el padrón.", data };
  }
  return { data };
}

module.exports = {
  pickString,
  decolectaToken,
  rucToken,
  dniToken,
  fetchPadronJson,
};
