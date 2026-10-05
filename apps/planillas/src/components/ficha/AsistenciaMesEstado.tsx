export type EstadoAsistenciaMes = "subido" | "falta" | "no-aplica";

const TITULO: Record<EstadoAsistenciaMes, string> = {
  subido: "Subido",
  falta: "Falta",
  "no-aplica": "No aplica",
};

export function AsistenciaMesEstado({
  estado,
  etiqueta,
  decorativo = false,
}: {
  estado: EstadoAsistenciaMes;
  etiqueta: string;
  decorativo?: boolean;
}) {
  const titulo = etiqueta ? `${etiqueta}: ${TITULO[estado]}` : TITULO[estado];
  if (estado === "subido") {
    return (
      <span title={titulo} aria-label={decorativo ? undefined : titulo} aria-hidden={decorativo || undefined} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5" aria-hidden>
          <path d="M5 12.5 9.5 17 19 7" />
        </svg>
      </span>
    );
  }
  if (estado === "falta") {
    return (
      <span title={titulo} aria-label={decorativo ? undefined : titulo} aria-hidden={decorativo || undefined} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden>
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </span>
    );
  }
  return (
    <span title={titulo} aria-label={decorativo ? undefined : titulo} aria-hidden={decorativo || undefined} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden>
        <path d="M7 12h10" />
      </svg>
    </span>
  );
}
