"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, FileInput } from "@inventario/ui";
import {
  importarTrabajadores,
  previsualizarImportacionTrabajadores,
  type PreviewImportacion,
} from "@/lib/actions/importar-trabajadores";

const ESTADO: Record<PreviewImportacion["filas"][number]["estado"], string> = {
  listo: "Listo",
  revisar: "Revisar",
  omitido: "No entra",
};

export function ImportarTrabajadoresButton({ entidadId }: { entidadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function cerrar() {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setError(null);
    setResultado(null);
  }

  async function previsualizar(siguiente: File | null) {
    setFile(siguiente);
    setPreview(null);
    setResultado(null);
    setError(null);
    if (!siguiente) return;
    setCargando(true);
    const data = new FormData();
    data.set("archivo", siguiente);
    const result = await previsualizarImportacionTrabajadores(entidadId, data);
    setCargando(false);
    if (result.error || !result.preview) {
      setError(result.error ?? "No pude leer el Excel.");
      return;
    }
    setPreview(result.preview);
  }

  async function importar() {
    if (!file || !preview || preview.listos === 0) return;
    setCargando(true);
    setError(null);
    const data = new FormData();
    data.set("archivo", file);
    const result = await importarTrabajadores(entidadId, data);
    setCargando(false);
    if (result.error) {
      setError(
        result.importados
          ? `${result.error} Se importaron ${result.importados} antes de detenerse.`
          : result.error,
      );
      return;
    }
    setResultado(
      `Se importaron ${result.importados ?? 0} trabajadores${
        result.omitidos ? `. ${result.omitidos} filas no entraron.` : "."
      }`,
    );
    setPreview(null);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Importar
      </Button>
      <Dialog
        open={open}
        onClose={cerrar}
        title="Importar trabajadores"
        description="Una fila por trabajador actual de esta empresa."
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <FileInput
            id="importar-trabajadores"
            accept=".xlsx,.xls,.csv"
            file={file}
            disabled={cargando}
            buttonLabel="Elegir Excel"
            emptyLabel="Ningún archivo"
            hint="Ítem, Cargo, CENTRO, DNI, Nombre completo, ingreso, tiempo, remuneración, horario y Vida Ley."
            onFileChange={(siguiente) => {
              void previsualizar(siguiente);
            }}
          />
          {cargando ? (
            <p className="text-sm text-muted-foreground">{preview ? "Importando…" : "Leyendo el archivo…"}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {resultado ? <p className="text-sm text-foreground">{resultado}</p> : null}
          {preview ? (
            <>
              <p className="text-sm text-muted-foreground">
                {preview.listos} listos para crear. Las filas en revisar no se importan.
              </p>
              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nº</th>
                      <th className="px-3 py-2 font-medium">DNI</th>
                      <th className="px-3 py-2 font-medium">Nombre completo</th>
                      <th className="px-3 py-2 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas.map((fila) => (
                      <tr key={`${fila.fila}-${fila.dni}`} className="border-t border-border align-top">
                        <td className="px-3 py-2">{fila.numero || "—"}</td>
                        <td className="px-3 py-2">{fila.dni || "—"}</td>
                        <td className="px-3 py-2">
                          <div>{fila.nombre || "—"}</div>
                          <div className="text-xs text-muted-foreground">{fila.detalle}</div>
                        </td>
                        <td className="px-3 py-2">{ESTADO[fila.estado]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={cerrar} disabled={cargando}>
                  Cerrar
                </Button>
                <Button type="button" size="sm" onClick={() => void importar()} disabled={cargando || preview.listos === 0}>
                  Importar {preview.listos}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
