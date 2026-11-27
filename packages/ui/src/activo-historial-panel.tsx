"use client";

import { useMemo } from "react";
import {
  buildHistorialEventos,
  type HistorialActivoEventoTipo,
  type HistorialActivoItem,
  type HistorialLookupMaps,
} from "@inventario/types";
import { PanelEmptyState } from "./panel";

export interface ActivoHistorialPanelProps {
  loading?: boolean;
  offline?: boolean;
  error?: string | null;
  items: HistorialActivoItem[];
  lookups?: HistorialLookupMaps;
}

function formatHistorialFecha(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHistorialFechaRelativa(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `Hace ${diffD} d`;
  return formatHistorialFecha(iso);
}

const TIPO_STYLES: Record<
  HistorialActivoEventoTipo,
  { dot: string; badge: string }
> = {
  alta: {
    dot: "bg-emerald-500 ring-emerald-500/25",
    badge: "text-emerald-800 dark:text-emerald-200",
  },
  validacion: {
    dot: "bg-sky-500 ring-sky-500/25",
    badge: "text-sky-800 dark:text-sky-200",
  },
  ubicacion: {
    dot: "bg-violet-500 ring-violet-500/25",
    badge: "text-violet-800 dark:text-violet-200",
  },
  baja: {
    dot: "bg-red-500 ring-red-500/25",
    badge: "text-red-800 dark:text-red-200",
  },
  recuperacion: {
    dot: "bg-amber-500 ring-amber-500/25",
    badge: "text-amber-800 dark:text-amber-200",
  },
  edicion: {
    dot: "bg-primary ring-primary/25",
    badge: "text-foreground",
  },
  otro: {
    dot: "bg-muted-foreground ring-muted-foreground/25",
    badge: "text-foreground",
  },
};

function CambioRow({
  label,
  anterior,
  nuevo,
}: {
  label: string;
  anterior?: string;
  nuevo?: string;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/70 px-2.5 py-2 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">
        {anterior && nuevo ? (
          <>
            <span className="text-muted-foreground line-through uppercase">{anterior}</span>
            <span className="mx-1.5 text-muted-foreground">→</span>
            <span className="font-medium uppercase">{nuevo}</span>
          </>
        ) : nuevo ? (
          <span className="font-medium uppercase">{nuevo}</span>
        ) : anterior ? (
          <span className="uppercase text-muted-foreground">{anterior}</span>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}

export function ActivoHistorialPanel({
  loading = false,
  offline = false,
  error = null,
  items,
  lookups,
}: ActivoHistorialPanelProps) {
  const eventos = useMemo(() => buildHistorialEventos(items, lookups), [items, lookups]);

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Historial de cambios</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quién modificó el bien y qué cambió
        </p>
      </div>
      <div className="p-4">
        {offline ? (
          <PanelEmptyState message="El historial se consulta en línea. Conéctese a internet para ver los cambios registrados." />
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : eventos.length === 0 ? (
          <PanelEmptyState message="Aún no hay cambios registrados en este bien." />
        ) : (
          <ol className="max-h-72 space-y-0 overflow-y-auto pr-1">
            {eventos.map((evento, index) => {
              const estilo = TIPO_STYLES[evento.tipo];
              return (
                <li key={evento.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < eventos.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-4 h-[calc(100%-4px)] w-px bg-border/80"
                    />
                  )}
                  <span
                    aria-hidden
                    className={`relative z-[1] mt-1.5 size-3.5 shrink-0 rounded-full ring-4 ${estilo.dot}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className={`text-sm font-semibold ${estilo.badge}`}>{evento.titulo}</p>
                      <p
                        className="mt-0.5 text-xs text-muted-foreground"
                        title={formatHistorialFecha(evento.fecha)}
                      >
                        {formatHistorialFechaRelativa(evento.fecha)}
                        {evento.usuarioNombre ? ` · ${evento.usuarioNombre}` : ""}
                      </p>
                    </div>
                    {evento.cambios.length > 0 && (
                      <div className="space-y-1.5">
                        {evento.cambios.map((cambio) => (
                          <CambioRow
                            key={`${evento.id}-${cambio.campo}`}
                            label={cambio.label}
                            anterior={cambio.anterior}
                            nuevo={cambio.nuevo}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
