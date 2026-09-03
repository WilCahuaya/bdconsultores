"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ambiente, Entidad, Sede } from "@inventario/types";
import { sedeIdSinSelector, formatFechaISOToDDMMYYYY, labelFechaCorte, labelFechaEmision, parseFechaDDMMYYYY, validarFechaDDMMYYYY } from "@inventario/types";
import { ReportesPanelContent } from "@inventario/ui/panel";
import { cargarActivosReporte } from "@/lib/actions/reportes";
import { resolveFichaAsignacionExportMeta } from "@/lib/actions/ficha-asignacion-meta";
import { listAmbientes, listSedes } from "@/lib/actions/ubicacion";
import {
  REPORTE_PREVIEW_MAX_ROWS,
  buildReporteResumenPreview,
  buildReporteRows,
  esReporteAdquiridosEjercicio,
  exportReporte,
  reporteHeaders,
  reportesDisponiblesParaRol,
  type ActivoReporte,
  type ReporteFormato,
  type ReporteId,
} from "@/lib/reportes";

interface ReportesPanelProps {
  entidades: Entidad[];
  usuarioNombre: string;
  usuarioEmail: string;
  esAdmin?: boolean;
}

function hoyDDMMAAAA(): string {
  return formatFechaISOToDDMMYYYY(new Date().toISOString().slice(0, 10));
}

export function ReportesPanel({
  entidades,
  usuarioNombre,
  usuarioEmail,
  esAdmin = false,
}: ReportesPanelProps) {
  const reportesDisponibles = useMemo(
    () => reportesDisponiblesParaRol(esAdmin ? "ADMIN_ENTIDAD" : "CONTADOR"),
    [esAdmin],
  );

  const [reporteId, setReporteId] = useState<ReporteId>(reportesDisponibles[0]!.id);
  const [entidadId, setEntidadId] = useState(entidades[0]?.id ?? "");
  const [sedeId, setSedeId] = useState("");
  const [ambienteId, setAmbienteId] = useState("");
  const [fechaCorte, setFechaCorte] = useState(hoyDDMMAAAA);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [activos, setActivos] = useState<ActivoReporte[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<ReporteFormato | null>(null);

  useEffect(() => {
    if (!reportesDisponibles.some((r) => r.id === reporteId) && reportesDisponibles[0]) {
      setReporteId(reportesDisponibles[0].id);
    }
  }, [reportesDisponibles, reporteId]);

  const definicion = reportesDisponibles.find((r) => r.id === reporteId) ?? reportesDisponibles[0]!;
  const esEjercicio = esReporteAdquiridosEjercicio(reporteId);
  const entidad = entidades.find((e) => e.id === entidadId);
  const ambiente = ambientes.find((a) => a.id === ambienteId);
  const sede = sedes.find((s) => s.id === sedeId);
  const hideEntidadSelector = esAdmin && entidades.length <= 1;

  useEffect(() => {
    if (!entidadId) {
      setSedes([]);
      setSedeId("");
      setAmbienteId("");
      setAmbientes([]);
      return;
    }
    void listSedes(entidadId).then((data) => {
      setSedes(data);
      if (definicion.scope === "entidad") {
        setSedeId("");
        setAmbienteId("");
        setAmbientes([]);
        return;
      }
      const implicitId = sedeIdSinSelector(data);
      setSedeId(implicitId ?? "");
      setAmbienteId("");
      if (implicitId) {
        void listAmbientes(implicitId).then(setAmbientes);
      } else {
        setAmbientes([]);
      }
    });
  }, [entidadId, definicion.scope]);

  useEffect(() => {
    if (!sedeId) {
      setAmbientes([]);
      return;
    }
    void listAmbientes(sedeId).then(setAmbientes);
  }, [sedeId]);

  useEffect(() => {
    if (definicion.scope === "entidad") {
      setSedeId("");
      setAmbienteId("");
      setAmbientes([]);
    } else {
      const implicitId = sedeIdSinSelector(sedes);
      if (implicitId && !sedeId) {
        setSedeId(implicitId);
      }
    }
  }, [definicion.scope, reporteId, sedes, sedeId]);

  useEffect(() => {
    setActivos([]);
    setError(null);
  }, [reporteId, entidadId, sedeId, ambienteId, fechaCorte]);

  const fechaCorteISO = useMemo(
    () => parseFechaDDMMYYYY(fechaCorte.trim()),
    [fechaCorte],
  );

  const preview = useMemo(() => {
    if (activos.length === 0) return null;
    if (!esEjercicio && !fechaCorteISO) return null;
    const fecha = fechaCorteISO
      ? new Date(`${fechaCorteISO}T12:00:00`)
      : new Date();
    const headers = reporteHeaders(reporteId, definicion.valorizado);
    const rows = buildReporteRows(activos, reporteId, definicion.valorizado, fecha);
    return {
      headers,
      rows: rows.slice(0, REPORTE_PREVIEW_MAX_ROWS),
      total: activos.length,
      resumen: buildReporteResumenPreview(activos, reporteId, fechaCorteISO ?? undefined),
      fechaEmision: labelFechaEmision(new Date()),
      fechaCorte: fechaCorteISO && !esEjercicio ? labelFechaCorte(fechaCorteISO) : null,
    };
  }, [activos, reporteId, definicion.valorizado, fechaCorteISO, esEjercicio]);

  async function cargarActivos(): Promise<ActivoReporte[] | null> {
    if (!entidadId) {
      setError("Seleccione una entidad.");
      return null;
    }
    if (definicion.scope === "ambiente" && !ambienteId) {
      setError("Seleccione un ambiente para este reporte.");
      return null;
    }

    setLoading(true);
    setError(null);
    const result = await cargarActivosReporte({
      reporteId,
      entidadId,
      ...(esEjercicio ? {} : { fechaCorte: fechaCorteISO ?? fechaCorte }),
      ...(definicion.scope === "ambiente" && {
        sedeId: sedeId || undefined,
        ambienteId: ambienteId || undefined,
      }),
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setActivos([]);
      return null;
    }

    const data = result.data ?? [];
    setActivos(data);
    if (data.length === 0) {
      setError("No hay registros para los filtros seleccionados.");
      return null;
    }
    return data;
  }

  async function handlePreview() {
    if (!esEjercicio) {
      if (!fechaCorte.trim()) {
        setError("Indique la fecha de corte (DD/MM/AAAA).");
        return;
      }
      const fechaError = validarFechaDDMMYYYY(fechaCorte);
      if (fechaError) {
        setError(fechaError);
        return;
      }
    }
    await cargarActivos();
  }

  async function handleExport(formato: ReporteFormato) {
    if (!entidad) return;
    if (!esEjercicio) {
      if (!fechaCorte.trim()) {
        setError("Indique la fecha de corte (DD/MM/AAAA).");
        return;
      }
      const fechaError = validarFechaDDMMYYYY(fechaCorte);
      if (fechaError) {
        setError(fechaError);
        return;
      }
      if (!fechaCorteISO) {
        setError("Fecha de corte inválida (use DD/MM/AAAA).");
        return;
      }
    }
    const data = await cargarActivos();
    if (!data) return;

    setPending(formato);
    setError(null);
    try {
      const fichaMeta =
        definicion.scope === "ambiente" && ambiente
          ? await resolveFichaAsignacionExportMeta(entidad, ambiente, sede?.nombre ?? null)
          : null;

      await exportReporte(formato, data, {
        reporteId,
        entidadNombre: entidad.nombre,
        ambienteNombre: ambiente?.nombre ?? null,
        sedeNombre: sede?.nombre ?? fichaMeta?.sedeNombre ?? null,
        responsable: fichaMeta?.responsable ?? ambiente?.responsable ?? null,
        responsableDni: fichaMeta?.responsableDni ?? null,
        adminNombre: fichaMeta?.adminNombre ?? entidad.admin_nombre ?? null,
        adminDni: fichaMeta?.adminDni ?? null,
        usuarioNombre,
        usuarioEmail,
        fechaGeneracion: new Date(),
        ...(esEjercicio || !fechaCorteISO ? {} : { fechaCorte: fechaCorteISO }),
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setPending(null);
    }
  }

  return (
    <ReportesPanelContent
      reportes={reportesDisponibles}
      reporteId={reporteId}
      onReporteIdChange={(id) => setReporteId(id as ReporteId)}
      entidades={entidades}
      entidadId={entidadId}
      onEntidadChange={(value) => {
        setEntidadId(value);
      }}
      hideEntidadSelector={hideEntidadSelector}
      entidadNombreFija={entidad?.nombre}
      sedes={sedes}
      sedeId={sedeId}
      onSedeChange={(value) => {
        setSedeId(value);
        setAmbienteId("");
      }}
      ambientes={ambientes}
      ambienteId={ambienteId}
      onAmbienteChange={setAmbienteId}
      fechaCorte={fechaCorte}
      onFechaCorteChange={setFechaCorte}
      ocultarFechaCorte={esEjercicio}
      previewFechaEmision={preview?.fechaEmision ?? null}
      previewFechaCorte={preview?.fechaCorte ?? null}
      loading={loading}
      pending={pending}
      error={error}
      onPreview={() => void handlePreview()}
      onExport={(formato) => void handleExport(formato)}
      previewHeaders={preview?.headers ?? []}
      previewRows={preview?.rows ?? []}
      previewTotal={preview?.total ?? 0}
      resumen={preview?.resumen ?? null}
      esAdmin={esAdmin}
    />
  );
}
