import { DOCUMENTO_MAX_BYTES } from "@/lib/documento-storage";

export function compactarPaginas(paginas: number[]): string {
  if (paginas.length === 0) return "";
  const ordenadas = [...paginas].sort((a, b) => a - b);
  const partes: string[] = [];
  let inicio = ordenadas[0];
  let fin = ordenadas[0];
  for (let i = 1; i <= ordenadas.length; i++) {
    const pagina = ordenadas[i];
    if (pagina === fin + 1) {
      fin = pagina;
      continue;
    }
    partes.push(inicio === fin ? String(inicio) : `${inicio}-${fin}`);
    inicio = pagina;
    fin = pagina;
  }
  return partes.join(", ");
}

export function parsearPaginas(texto: string, total: number): { paginas?: number[]; error?: string } {
  const limpio = texto.trim();
  if (!limpio) return { paginas: [] };
  const elegidas = new Set<number>();
  for (const parte of limpio.split(/[,;]+/)) {
    const item = parte.trim();
    if (!item) continue;
    const rango = /^(\d+)\s*-\s*(\d+)$/.exec(item);
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = Number(rango[2]);
      if (desde > hasta) return { error: "El rango debe ir de menor a mayor." };
      if (desde < 1 || hasta > total) return { error: "Hay una página fuera del documento." };
      for (let pagina = desde; pagina <= hasta; pagina++) elegidas.add(pagina);
      continue;
    }
    if (!/^\d+$/.test(item)) return { error: "Use números de página, por ejemplo 2 o 4-6." };
    const pagina = Number(item);
    if (pagina < 1 || pagina > total) return { error: "Hay una página fuera del documento." };
    elegidas.add(pagina);
  }
  return { paginas: [...elegidas].sort((a, b) => a - b) };
}

export function describirPaginas(paginas: number[]): string {
  const ordenadas = [...paginas].sort((a, b) => a - b);
  if (ordenadas.length === 0) return "";
  if (ordenadas.length === 1) return `la página ${ordenadas[0]}`;
  const ultima = ordenadas[ordenadas.length - 1];
  return `las páginas ${ordenadas.slice(0, -1).join(", ")} y ${ultima}`;
}

type PdfDoc = import("pdf-lib").PDFDocument;

const documentos = new WeakMap<File, Promise<PdfDoc>>();
const colas = new WeakMap<File, Promise<unknown>>();

function copiaBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  return copia;
}

function documentoDe(file: File): Promise<PdfDoc> {
  const existente = documentos.get(file);
  if (existente) return existente;
  const pendiente = import("pdf-lib").then(({ PDFDocument }) =>
    file.arrayBuffer().then((bytes) => PDFDocument.load(bytes, { ignoreEncryption: true })),
  );
  documentos.set(file, pendiente);
  pendiente.catch(() => {
    if (documentos.get(file) === pendiente) documentos.delete(file);
  });
  return pendiente;
}

function encolar<T>(file: File, tarea: () => Promise<T>): Promise<T> {
  const anterior = colas.get(file) ?? Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colas.set(
    file,
    siguiente.then(
      () => undefined,
      () => undefined,
    ),
  );
  return siguiente;
}

export async function contarPaginasPdf(file: File): Promise<{ total?: number; error?: string }> {
  try {
    const total = await encolar(file, async () => (await documentoDe(file)).getPageCount());
    if (total < 1) return { error: "El PDF no tiene páginas." };
    return { total };
  } catch {
    return { error: "No se pudieron leer las páginas de este PDF." };
  }
}

export async function recortarPaginasPdf(
  file: File,
  paginas: number[],
): Promise<{ file?: File; error?: string }> {
  const indices = [...new Set(paginas)].filter((pagina) => Number.isInteger(pagina) && pagina >= 1).sort((a, b) => a - b);
  if (indices.length === 0) return { error: "Marque las páginas de este trabajador." };
  try {
    const bytes = await encolar(file, async () => {
      const origen = await documentoDe(file);
      const total = origen.getPageCount();
      if (indices.some((pagina) => pagina > total)) throw new Error("fuera");
      const { PDFDocument } = await import("pdf-lib");
      const destino = await PDFDocument.create();
      const copiadas = await destino.copyPages(
        origen,
        indices.map((pagina) => pagina - 1),
      );
      for (const pagina of copiadas) destino.addPage(pagina);
      return destino.save();
    });
    if (bytes.byteLength > DOCUMENTO_MAX_BYTES) return { error: "El PDF resultante supera 10 MB." };
    const base = file.name.replace(/\.pdf$/i, "").trim() || "certificado";
    return { file: new File([copiaBytes(bytes)], `${base}.pdf`, { type: "application/pdf" }) };
  } catch {
    return { error: "No se pudieron separar las páginas." };
  }
}
