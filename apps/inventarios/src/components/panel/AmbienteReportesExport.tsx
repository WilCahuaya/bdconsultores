"use client";

import { useMemo, useState } from "react";
import type { RolUsuario } from "@inventario/types";
import { AmbienteReportesExportMenu } from "@inventario/ui/panel";
import { cargarActivosReporte } from "@/lib/actions/reportes";
import type { FichaAsignacionExportMeta } from "@/lib/actions/ficha-asignacion-meta";
import {
  exportReporte,
  reportesAmbienteParaRol,
  type ReporteFormato,
  type ReporteId,
} from "@/lib/reportes";

interface AmbienteReportesExportProps {
  entidadId: string;
  entidadNombre: string;
  sedeId: string;
  ambienteId: string;
  ambienteNombre: string;
  ambienteResponsable?: string | null;
  fichaExportMeta?: FichaAsignacionExportMeta;
  usuarioNombre: string;
  usuarioEmail: string;
  esAdmin?: boolean;
  size?: "sm" | "default";
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AmbienteReportesExport({
  entidadId,
  entidadNombre,
  sedeId,
  ambienteId,
  ambienteNombre,
  ambienteResponsable,
  fichaExportMeta,
  usuarioNombre,
  usuarioEmail,
  esAdmin = false,
  size = "sm",
}: AmbienteReportesExportProps) {
  const rol: RolUsuario = esAdmin ? "ADMIN_ENTIDAD" : "CONTADOR";
  const reportes = useMemo(() => reportesAmbienteParaRol(rol), [rol]);
  const [pending, setPending] = useState<string | null>(null);

  async function handleExport(reporteId: ReporteId, formato: ReporteFormato) {
    const key = `${reporteId}:${formato}`;
    setPending(key);
    try {
      const result = await cargarActivosReporte({
        reporteId,
        entidadId,
        sedeId,
        ambienteId,
      });
      if (result.error) {
        window.alert(result.error);
        return;
      }
      const data = result.data ?? [];
      if (data.length === 0) {
        window.alert("No hay activos registrados en este ambiente para el reporte seleccionado.");
        return;
      }

      await exportReporte(formato, data, {
        reporteId,
        entidadNombre,
        ambienteNombre,
        sedeNombre: fichaExportMeta?.sedeNombre ?? null,
        responsable: fichaExportMeta?.responsable ?? ambienteResponsable ?? null,
        responsableDni: fichaExportMeta?.responsableDni ?? null,
        adminNombre: fichaExportMeta?.adminNombre ?? null,
        adminDni: fichaExportMeta?.adminDni ?? null,
        usuarioNombre,
        usuarioEmail,
        fechaGeneracion: new Date(),
        fechaCorte: hoyISO(),
      });
    } catch (err) {
      console.error(err);
      window.alert("No se pudo generar el reporte. Intente de nuevo.");
    } finally {
      setPending(null);
    }
  }

  return (
    <AmbienteReportesExportMenu
      reportes={reportes.map((r) => ({ id: r.id, label: r.label }))}
      pending={pending}
      size={size}
      onExport={(id, formato) => void handleExport(id as ReporteId, formato)}
    />
  );
}
