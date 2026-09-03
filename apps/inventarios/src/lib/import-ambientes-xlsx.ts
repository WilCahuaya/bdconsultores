import {
  IMPORT_AMBIENTES_COLUMN_ERROR,
  IMPORT_AMBIENTES_HEADERS,
  MAX_IMPORT_AMBIENTES_FILAS,
  emptyImportAmbienteFila,
  importAmbienteErrorFilaFromItem,
  mapImportAmbienteHeaders,
  type ImportAmbienteErrorFila,
  type ImportAmbienteErrorItem,
  type ImportAmbienteFila,
} from "@inventario/types";

function slugFilename(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value).trim();
}

function filaVacia(fila: ImportAmbienteFila): boolean {
  return IMPORT_AMBIENTES_HEADERS.every((h) => !fila[h].trim());
}

export async function parseImportAmbientesWorkbook(
  file: File,
): Promise<{ filas: ImportAmbienteFila[]; error?: string }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { filas: [], error: "El archivo no tiene hojas." };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (matrix.length < 2) {
    return { filas: [], error: "El archivo no tiene filas de datos." };
  }

  const headerRow = (matrix[0] ?? []).map((c) => cellToString(c));
  const headerMap = mapImportAmbienteHeaders(headerRow);
  if (headerMap.size === 0) {
    return { filas: [], error: "No se reconocieron las columnas del archivo." };
  }

  const required = ["Nombre del ambiente", "Nombre de sucursal"] as const;
  const mappedHeaders = new Set(headerMap.values());
  const missing = required.filter((h) => !mappedHeaders.has(h));
  if (missing.length > 0) {
    return { filas: [], error: `Faltan columnas obligatorias: ${missing.join(", ")}.` };
  }

  const filas: ImportAmbienteFila[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const fila = emptyImportAmbienteFila();
    headerMap.forEach((header, colIndex) => {
      fila[header] = cellToString(row[colIndex]);
    });
    if (filaVacia(fila)) continue;
    filas.push(fila);
  }

  if (filas.length === 0) {
    return { filas: [], error: "No hay filas con datos para importar." };
  }
  if (filas.length > MAX_IMPORT_AMBIENTES_FILAS) {
    return {
      filas: [],
      error: `Máximo ${MAX_IMPORT_AMBIENTES_FILAS} filas por importación.`,
    };
  }

  return { filas };
}

export async function downloadImportAmbientesPlantilla(entidadNombre: string): Promise<void> {
  const XLSX = await import("xlsx");
  const ejemplo: ImportAmbienteFila = {
    "Nombre del ambiente": "Administración",
    "Descripción del ambiente": "Planta baja",
    "Nombre de sucursal": "Principal",
    "Dirección de sucursal": "",
    "Nombre de responsable": "María Pérez",
    "DNI de responsable": "12345678",
    "Correo de responsable": "maria@ejemplo.com",
    "Teléfono del responsable": "999888777",
  };

  const plantillaRows = [
    [...IMPORT_AMBIENTES_HEADERS],
    IMPORT_AMBIENTES_HEADERS.map((h) => ejemplo[h]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plantillaRows), "Plantilla");
  const slug = slugFilename(entidadNombre) || "entidad";
  XLSX.writeFile(wb, `plantilla-ambientes-${slug}.xlsx`);
}

export async function downloadImportAmbientesErrores(
  entidadNombre: string,
  errores: ImportAmbienteErrorItem[],
): Promise<void> {
  if (errores.length === 0) return;
  const XLSX = await import("xlsx");
  const headers = [...IMPORT_AMBIENTES_HEADERS, IMPORT_AMBIENTES_COLUMN_ERROR];
  const rows = errores.map((item) => {
    const fila = importAmbienteErrorFilaFromItem(item);
    return headers.map((h) => fila[h as keyof ImportAmbienteErrorFila] ?? "");
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Errores");
  const slug = slugFilename(entidadNombre) || "entidad";
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `importacion-ambientes-errores-${slug}-${fecha}.xlsx`);
}
