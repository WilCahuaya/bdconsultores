import {
  IMPORT_ACTIVOS_COLUMN_ERROR,
  IMPORT_ACTIVOS_HEADERS,
  MAX_IMPORT_ACTIVOS_FILAS,
  emptyImportActivoFila,
  importErrorFilaFromItem,
  mapImportHeaders,
  normalizeImportDepreciacionRaw,
  type ImportActivoErrorFila,
  type ImportActivoErrorItem,
  type ImportActivoFila,
  type ImportUbicacionRef,
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

function excelSerialToDDMMYYYY(serial: number): string | null {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (value > 25000 && value < 120000) {
      return excelSerialToDDMMYYYY(value) ?? String(value);
    }
    return String(value);
  }
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value).trim();
}

function filaVacia(fila: ImportActivoFila): boolean {
  return IMPORT_ACTIVOS_HEADERS.every((h) => !fila[h].trim());
}

export async function parseImportActivosWorkbook(
  file: File,
): Promise<{ filas: ImportActivoFila[]; error?: string }> {
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
  const headerMap = mapImportHeaders(headerRow);
  if (headerMap.size === 0) {
    return { filas: [], error: "No se reconocieron las columnas del archivo." };
  }

  const required = ["Sucursal", "Ambiente", "Código catálogo"] as const;
  const mappedHeaders = new Set(headerMap.values());
  const missing = required.filter((h) => !mappedHeaders.has(h));
  if (missing.length > 0) {
    return { filas: [], error: `Faltan columnas obligatorias: ${missing.join(", ")}.` };
  }

  const filas: ImportActivoFila[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const fila = emptyImportActivoFila();
    headerMap.forEach((header, colIndex) => {
      const cell = cellToString(row[colIndex]);
      fila[header] =
        header === "% Deprec." ? normalizeImportDepreciacionRaw(cell) : cell;
    });
    if (filaVacia(fila)) continue;
    filas.push(fila);
  }

  if (filas.length === 0) {
    return { filas: [], error: "No hay filas con datos para importar." };
  }
  if (filas.length > MAX_IMPORT_ACTIVOS_FILAS) {
    return {
      filas: [],
      error: `Máximo ${MAX_IMPORT_ACTIVOS_FILAS} filas por importación.`,
    };
  }

  return { filas };
}

export async function downloadImportActivosPlantilla(
  entidadNombre: string,
  ubicaciones: ImportUbicacionRef[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const fisicos = ubicaciones.filter((u) => !u.esPreregistro);
  const ejemploUbicacion = fisicos[0] ?? ubicaciones[0];
  const ejemplo: ImportActivoFila = {
    Categoría: "Activo",
    "Código catálogo": "12345678",
    Marca: "",
    Modelo: "",
    Serie: "",
    Color: "",
    Medidas: "",
    Detalle: "",
    Estado: "Bueno",
    "Fecha de adquisición": "",
    "Precio de adquisición (S/)": "",
    "Valor de mercado (S/)": "",
    "% Deprec.": "",
    Observaciones: "",
    "Código cuenta contable": "",
    "Nombre cuenta contable": "",
    Sucursal: ejemploUbicacion?.sedeNombre ?? "Principal",
    Ambiente: ejemploUbicacion?.ambienteNombre ?? "",
  };

  const plantillaRows = [[...IMPORT_ACTIVOS_HEADERS], IMPORT_ACTIVOS_HEADERS.map((h) => ejemplo[h])];
  const ubicacionRows = [
    ["Sucursal", "Ambiente", "Uso en importación"],
    ...ubicaciones.map((u) => [
      u.sedeNombre,
      u.ambienteNombre,
      u.esPreregistro
        ? "Preregistro (use este nombre o alias «preregistro» en columna Ambiente)"
        : "Ubicación al registrar el activo",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plantillaRows), "Plantilla");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ubicacionRows), "Ubicaciones");
  const slug = slugFilename(entidadNombre) || "entidad";
  XLSX.writeFile(wb, `plantilla-importacion-${slug}.xlsx`);
}

export async function downloadImportActivosErrores(
  entidadNombre: string,
  errores: ImportActivoErrorItem[],
): Promise<void> {
  if (errores.length === 0) return;
  const XLSX = await import("xlsx");
  const headers = [...IMPORT_ACTIVOS_HEADERS, IMPORT_ACTIVOS_COLUMN_ERROR];
  const rows = errores.map((item) => {
    const fila = importErrorFilaFromItem(item);
    return headers.map((h) => fila[h as keyof ImportActivoErrorFila] ?? "");
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Errores");
  const slug = slugFilename(entidadNombre) || "entidad";
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `importacion-errores-${slug}-${fecha}.xlsx`);
}
