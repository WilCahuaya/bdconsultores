"use client";

import { useEffect, useState } from "react";
import { Button } from "@inventario/ui";
import {
  compactarPaginas,
  contarPaginasPdf,
  describirPaginas,
  parsearPaginas,
  recortarPaginasPdf,
} from "@/lib/recortar-pdf";

export type EstadoPaginasCertificado =
  | { tipo: "completo" }
  | { tipo: "leyendo" }
  | {
      tipo: "elegir";
      total: number;
      elegidas: number[];
      paginaVista: number;
      vistaPagina: File | null;
      recorte: File | null;
      mostrandoRecorte: boolean;
    };

function esPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function SelectorPaginasPdf({
  file,
  disabled,
  onEstado,
}: {
  file: File;
  disabled?: boolean;
  onEstado: (estado: EstadoPaginasCertificado) => void;
}) {
  const [fase, setFase] = useState<"completo" | "leyendo" | "elegir">(() => (esPdf(file) ? "leyendo" : "completo"));
  const [total, setTotal] = useState(0);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [paginaVista, setPaginaVista] = useState(1);
  const [texto, setTexto] = useState("");
  const [textoError, setTextoError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vistaPagina, setVistaPagina] = useState<File | null>(null);
  const [vistaDe, setVistaDe] = useState<number | null>(null);
  const [recorte, setRecorte] = useState<File | null>(null);
  const [recorteFallo, setRecorteFallo] = useState(false);
  const [mostrandoRecorte, setMostrandoRecorte] = useState(false);

  useEffect(() => {
    if (!esPdf(file)) {
      setFase("completo");
      return;
    }
    let cancelado = false;
    setFase("leyendo");
    void contarPaginasPdf(file).then((result) => {
      if (cancelado) return;
      if (result.error || !result.total) {
        setAviso(result.error ?? "No se pudieron leer las páginas. Se guardará el PDF completo.");
        setFase("completo");
        return;
      }
      if (result.total === 1) {
        setAviso(null);
        setFase("completo");
        return;
      }
      setAviso(null);
      setTotal(result.total);
      setPaginaVista(1);
      setFase("elegir");
    });
    return () => {
      cancelado = true;
    };
  }, [file]);

  useEffect(() => {
    if (fase !== "elegir" || paginaVista < 1) return;
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void recortarPaginasPdf(file, [paginaVista]).then((result) => {
        if (cancelado || !result.file) return;
        setVistaPagina(result.file);
        setVistaDe(paginaVista);
      });
    }, 120);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [file, fase, paginaVista]);

  useEffect(() => {
    if (fase !== "elegir" || elegidas.length === 0) {
      setRecorte(null);
      return;
    }
    let cancelado = false;
    setRecorte(null);
    setRecorteFallo(false);
    const timer = window.setTimeout(() => {
      void recortarPaginasPdf(file, elegidas).then((result) => {
        if (cancelado) return;
        setRecorte(result.file ?? null);
        setRecorteFallo(!result.file);
      });
    }, 200);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [file, fase, elegidas]);

  useEffect(() => {
    if (fase === "leyendo") {
      onEstado({ tipo: "leyendo" });
      return;
    }
    if (fase !== "elegir") {
      onEstado({ tipo: "completo" });
      return;
    }
    onEstado({ tipo: "elegir", total, elegidas, paginaVista, vistaPagina, recorte, mostrandoRecorte });
  }, [fase, total, elegidas, paginaVista, vistaPagina, recorte, mostrandoRecorte, onEstado]);

  function fijarElegidas(paginas: number[], vista: number) {
    const ordenadas = [...new Set(paginas)].sort((a, b) => a - b);
    setElegidas(ordenadas);
    setTexto(compactarPaginas(ordenadas));
    setTextoError(null);
    setMostrandoRecorte(false);
    setPaginaVista(vista);
  }

  function marcarTexto() {
    const result = parsearPaginas(texto, total);
    if (result.error || !result.paginas) {
      setTextoError(result.error ?? "Use números de página, por ejemplo 2 o 4-6.");
      return;
    }
    fijarElegidas(result.paginas, result.paginas[0] ?? paginaVista);
  }

  if (fase === "leyendo") {
    return <p className="text-sm text-muted-foreground">Leyendo páginas…</p>;
  }

  if (fase === "completo") {
    return aviso ? <p className="text-sm text-muted-foreground">{aviso}</p> : null;
  }

  const paginas = Array.from({ length: total }, (_, indice) => indice + 1);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Páginas de este trabajador</p>
        <p className="text-sm text-muted-foreground">
          Este PDF tiene {total} páginas. Marque las de este trabajador.
          {mostrandoRecorte && recorte
            ? " La vista de la derecha muestra solo las páginas que se guardarán."
            : " La vista de la derecha muestra la página señalada."}
        </p>
      </div>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Páginas del certificado">
        {paginas.map((pagina) => {
          const marcada = elegidas.includes(pagina);
          const viendo = pagina === paginaVista && !mostrandoRecorte;
          return (
            <button
              key={pagina}
              type="button"
              disabled={disabled}
              aria-pressed={marcada}
              aria-current={viendo ? "true" : undefined}
              title={marcada ? `Página ${pagina}, marcada` : `Página ${pagina}`}
              onClick={() => {
                const siguiente = marcada ? elegidas.filter((item) => item !== pagina) : [...elegidas, pagina];
                fijarElegidas(siguiente, pagina);
              }}
              className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm disabled:cursor-default disabled:opacity-60 ${
                marcada
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              } ${viendo ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              {pagina}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-40 flex-1 space-y-1.5">
          <span className="text-sm font-medium">O escriba las páginas</span>
          <input
            value={texto}
            disabled={disabled}
            placeholder="2 o 4-6"
            inputMode="text"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              setTexto(event.target.value);
              setTextoError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                marcarTexto();
              }
            }}
          />
        </label>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={marcarTexto}>
          Marcar
        </Button>
      </div>
      {textoError ? <p className="text-sm text-destructive">{textoError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || paginaVista <= 1}
          onClick={() => {
            setMostrandoRecorte(false);
            setPaginaVista((actual) => Math.max(1, actual - 1));
          }}
        >
          Anterior
        </Button>
        <p className="text-sm text-foreground">
          {vistaDe === paginaVista ? `Página ${paginaVista} de ${total}` : `Cargando la página ${paginaVista}…`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || paginaVista >= total}
          onClick={() => {
            setMostrandoRecorte(false);
            setPaginaVista((actual) => Math.min(total, actual + 1));
          }}
        >
          Siguiente
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {elegidas.length === 1
          ? `Se guardará ${describirPaginas(elegidas)}.`
          : elegidas.length > 0
            ? `Se guardarán ${describirPaginas(elegidas)}.`
            : "Marque al menos una página."}
      </p>
      {elegidas.length > 0 && recorteFallo ? (
        <p className="text-sm text-muted-foreground">No se pudo preparar la vista. Puede guardar igual.</p>
      ) : elegidas.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !recorte}
          onClick={() => setMostrandoRecorte((actual) => !actual)}
        >
          {!recorte ? "Preparando vista…" : mostrandoRecorte ? `Ver la página ${paginaVista}` : "Ver lo que se guardará"}
        </Button>
      ) : null}
    </div>
  );
}
