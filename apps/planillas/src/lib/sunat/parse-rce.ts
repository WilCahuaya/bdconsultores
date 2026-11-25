export type TipoCompraSunat = "01" | "02" | "03";

export interface CompraRce {
  tipo: TipoCompraSunat;
  serie: string;
  numero: string;
  numeroFinal: string | null;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  fechaEmision: string | null;
  moneda: string | null;
  base: number | null;
  igv: number | null;
  total: number | null;
  car: string | null;
}

const TIPOS = new Set<string>(["01", "02", "03"]);

/** Columnas del TXT de propuesta RCE que publica SUNAT, separadas por |. */
const COL = {
  car: 3,
  fecha: 4,
  tipo: 6,
  serie: 7,
  numero: 9,
  numeroFinal: 10,
  ruc: 12,
  razon: 13,
  base: 14,
  igv: 15,
  total: 24,
  moneda: 25,
} as const;

export function parseRce(contenido: string): CompraRce[] {
  const text = contenido.replace(/^\uFEFF/, "");
  const compras: CompraRce[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = splitRow(line);
    if (/^ruc$/i.test(cols[0] ?? "")) continue;
    const tipo = normalizarTipo(cols[COL.tipo] ?? "");
    if (!tipo) continue;
    const numero = (cols[COL.numero] ?? "").trim();
    if (!numero) continue;
    const numeroFinalRaw = (cols[COL.numeroFinal] ?? "").trim();
    compras.push({
      tipo,
      serie: (cols[COL.serie] ?? "").trim(),
      numero,
      numeroFinal: numeroFinalRaw && numeroFinalRaw !== numero ? numeroFinalRaw : null,
      rucEmisor: limpiarDoc(cols[COL.ruc] ?? ""),
      razonSocialEmisor: (cols[COL.razon] ?? "").trim() || null,
      fechaEmision: toIso(cols[COL.fecha] ?? ""),
      moneda: (cols[COL.moneda] ?? "").trim() || null,
      base: toNumber(cols[COL.base] ?? ""),
      igv: toNumber(cols[COL.igv] ?? ""),
      total: toNumber(cols[COL.total] ?? ""),
      car: (cols[COL.car] ?? "").trim() || null,
    });
  }
  return compras;
}

function normalizarTipo(value: string): TipoCompraSunat | null {
  const tipo = value.trim().padStart(2, "0");
  return TIPOS.has(tipo) ? (tipo as TipoCompraSunat) : null;
}

function limpiarDoc(value: string): string | null {
  const doc = value.trim();
  return doc || null;
}

export function splitRow(line: string): string[] {
  const delimiter = line.includes("|") ? "|" : ",";
  const cols: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cols.push(current.trim());
  return cols;
}

function toIso(value: string): string | null {
  const text = value.trim();
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function toNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const normalized = text.includes(",") && !text.includes(".")
    ? text.replace(/\s/g, "").replace(",", ".")
    : text.replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}
