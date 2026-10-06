"use client";

import { useEffect, useState } from "react";
import type { VisitaCampoHistorial, VisitaCampoReporte, VisitaCampoReporteItem } from "@inventario/types";
import { estadoBienLabel } from "@inventario/types";
import { Dialog } from "@inventario/ui";
import { getVisitaCampoReporte } from "@/lib/actions/visitas-campo";

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function lugar(item: VisitaCampoReporteItem) {
  return item.sede_nombre
    ? `${item.ambiente_nombre} · ${item.sede_nombre}`
    : item.ambiente_nombre;
}

function agrupar(items: VisitaCampoReporteItem[]) {
  const groups = new Map<string, VisitaCampoReporteItem[]>();
  for (const item of items) {
    const key = lugar(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function cambioDeEstado(item: VisitaCampoReporteItem) {
  return (
    item.estado_anterior != null &&
    item.estado_nuevo != null &&
    item.estado_anterior !== item.estado_nuevo
  );
}

function LineaBien({ item, resaltar }: { item: VisitaCampoReporteItem; resaltar?: "faltante" | "baja" | "estado" }) {
  const cambio = cambioDeEstado(item);
  return (
    <li className="rounded-md border border-border/60 bg-card px-3 py-2">
      <p className="font-medium text-foreground">{item.nombre}</p>
      {item.codigo_barras ? (
        <p className="font-mono text-xs text-muted-foreground">{item.codigo_barras}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{lugar(item)}</p>
      {resaltar === "faltante" ? (
        <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">Pasó a faltante</p>
      ) : null}
      {resaltar === "baja" ? (
        <p className="mt-1 text-sm font-medium text-destructive">De baja</p>
      ) : null}
      {cambio ? (
        <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
          {estadoBienLabel(item.estado_anterior)} → {estadoBienLabel(item.estado_nuevo)}
        </p>
      ) : item.estado_nuevo ? (
        <p className="mt-1 text-xs text-muted-foreground">{estadoBienLabel(item.estado_nuevo)}</p>
      ) : null}
      {item.motivo ? <p className="mt-1 text-xs text-muted-foreground">{item.motivo}</p> : null}
      {item.revisado_por_nombre || item.revisado_at ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatFecha(item.revisado_at)}
          {item.revisado_por_nombre ? ` · ${item.revisado_por_nombre}` : ""}
        </p>
      ) : null}
    </li>
  );
}

function Seccion({
  titulo,
  items,
  resaltar,
}: {
  titulo: string;
  items: VisitaCampoReporteItem[];
  resaltar?: "faltante" | "baja" | "estado";
}) {
  if (items.length === 0) return null;
  const grupos = agrupar(items);
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {titulo}{" "}
        <span className="font-normal text-muted-foreground">({items.length})</span>
      </h3>
      {grupos.map(([ambiente, filas]) => (
        <div key={ambiente} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ambiente}</p>
          <ul className="space-y-2">
            {filas.map((item) => (
              <LineaBien key={`${resaltar ?? "item"}-${item.id}`} item={item} resaltar={resaltar} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function VisitaCampoReporteDialog({
  visita,
  onClose,
}: {
  visita: VisitaCampoHistorial | null;
  onClose: () => void;
}) {
  const [reporte, setReporte] = useState<VisitaCampoReporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visita) {
      setReporte(null);
      setError(null);
      return;
    }
    let activo = true;
    setLoading(true);
    setError(null);
    setReporte(null);
    void getVisitaCampoReporte(visita.id).then((result) => {
      if (!activo) return;
      setLoading(false);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo cargar el reporte.");
        return;
      }
      setReporte(result.data);
    });
    return () => {
      activo = false;
    };
  }, [visita]);

  const vacio =
    reporte != null &&
    reporte.hallados.length === 0 &&
    reporte.faltantes.length === 0 &&
    reporte.bajas.length === 0 &&
    reporte.cambios_estado.length === 0;

  const estado =
    visita?.estado === "CERRADO"
      ? visita.cerrado_at
        ? `Cerrada el ${formatFecha(visita.cerrado_at)}`
        : "Cerrada"
      : "Abierta. Muestra lo revisado hasta ahora.";

  return (
    <Dialog
      open={Boolean(visita)}
      onClose={onClose}
      title={visita ? `Reporte de la visita ${visita.numero}` : "Reporte de la visita"}
      description={visita ? estado : undefined}
      className="max-h-[85vh] max-w-3xl overflow-y-auto"
    >
      {loading ? <p className="text-sm text-muted-foreground">Cargando reporte…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {vacio ? (
        <p className="text-sm text-muted-foreground">Aún no hay bienes revisados en esta visita.</p>
      ) : null}
      {reporte ? (
        <div className="space-y-6">
          <Seccion titulo="Hallados" items={reporte.hallados} />
          <Seccion titulo="Faltantes" items={reporte.faltantes} resaltar="faltante" />
          <Seccion titulo="Bajas" items={reporte.bajas} resaltar="baja" />
          <Seccion titulo="Cambiaron de estado" items={reporte.cambios_estado} resaltar="estado" />
        </div>
      ) : null}
    </Dialog>
  );
}
