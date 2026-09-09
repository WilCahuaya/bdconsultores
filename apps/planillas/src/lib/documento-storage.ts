export const DOCUMENTOS_PLANILLAS_BUCKET = "documentos-planillas";

export const DOCUMENTO_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

export const DOCUMENTO_MAX_BYTES = 10 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function extensionDocumento(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return null;
  return ext === "jpeg" ? "jpg" : ext;
}

export function pathDocumento(entidadId: string, relacionId: string, documentoId: string, ext: string): string {
  return `${entidadId}/${relacionId}/${documentoId}.${ext}`;
}

export function pathDocumentoValido(entidadId: string, relacionId: string, path: string): boolean {
  if (!isUuid(entidadId) || !isUuid(relacionId)) return false;
  const prefix = `${entidadId}/${relacionId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  const [id, ext] = rest.split(".");
  return Boolean(id && isUuid(id) && ext && ALLOWED_EXT.has(ext));
}

export function pathPerteneceAlDocumento(
  entidadId: string,
  relacionId: string,
  documentoId: string,
  path: string,
): boolean {
  if (!isUuid(documentoId) || !pathDocumentoValido(entidadId, relacionId, path)) return false;
  return path.startsWith(`${entidadId}/${relacionId}/${documentoId}.`);
}

export function nombreDescargaDocumento(tipoLabel: string, path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "pdf";
  const base = tipoLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "documento"}.${ext}`;
}

export function errorArchivoDocumento(file: File): string | null {
  if (file.size > DOCUMENTO_MAX_BYTES) return "El archivo no puede superar 10 MB.";
  if (!extensionDocumento(file.name)) return "Solo se admiten PDF, JPG, PNG o WEBP.";
  return null;
}
