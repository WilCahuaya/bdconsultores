/**
 * Consulta DNI vía API intermediaria (datos RENIEC).
 * Token: el mismo SUNAT_RUC_API_TOKEN, o RENIEC_DNI_API_TOKEN si existe.
 * URL opcional: RENIEC_DNI_API_URL.
 */

const { pickString, dniToken, fetchPadronJson } = require("./padron-http");

const DEFAULT_URL = "https://api.decolecta.com/v1/reniec/dni";

function normalizeDni(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function validarDni(value) {
  const dni = normalizeDni(value);
  if (dni.length !== 8) return "El DNI debe tener 8 dígitos.";
  return null;
}

function fechaIso(value) {
  const raw = pickString(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return "";
}

/**
 * @param {string} dni
 * @returns {Promise<{
 *   error?: string;
 *   dni?: string;
 *   nombres?: string;
 *   apellido_paterno?: string;
 *   apellido_materno?: string;
 *   nombre_completo?: string;
 *   fecha_nacimiento?: string;
 * }>}
 */
async function consultarDniReniec(dni) {
  const numero = normalizeDni(dni);
  const invalid = validarDni(numero);
  if (invalid) return { error: invalid };

  const token = dniToken();
  if (!token) {
    return {
      error:
        "Falta configurar SUNAT_RUC_API_TOKEN (el mismo de Decolecta sirve para DNI) o RENIEC_DNI_API_TOKEN.",
    };
  }

  const base = (process.env.RENIEC_DNI_API_URL?.trim() || DEFAULT_URL).replace(/\?.*$/, "");
  const result = await fetchPadronJson(`${base}?numero=${encodeURIComponent(numero)}`, token);
  if (result.error === "not_found" || /^invalid request$/i.test(result.error ?? "")) {
    return { error: "No se encontró ese DNI." };
  }
  if (result.error) return { error: result.error };

  const data = result.data ?? {};
  const nombres = pickString(
    data.first_name,
    data.nombres,
    data.prenombres,
    data.nombresCompletos,
  );
  const apellidoPaterno = pickString(
    data.first_last_name,
    data.apellidoPaterno,
    data.apellido_paterno,
    data.apePaterno,
  );
  const apellidoMaterno = pickString(
    data.second_last_name,
    data.apellidoMaterno,
    data.apellido_materno,
    data.apeMaterno,
  );
  const nombreCompleto = pickString(
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "),
    data.full_name,
    data.nombreCompleto,
    data.nombre_completo,
  );

  if (!nombres && !nombreCompleto) return { error: "El padrón no devolvió el nombre." };

  return {
    dni: numero,
    nombres: nombres || nombreCompleto,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    nombre_completo: nombreCompleto || [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "),
    fecha_nacimiento: fechaIso(
      data.fechaNacimiento ?? data.fecha_nacimiento ?? data.fechaNac,
    ),
  };
}

module.exports = {
  normalizeDni,
  validarDni,
  consultarDniReniec,
};
