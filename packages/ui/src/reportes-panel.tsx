import type { ReactNode } from "react";
import { entidadMuestraSelectorSede } from "@inventario/types";
import { Button, Select } from "./components";
import { FechaDdMmYyyyInput } from "./fecha-dd-mm-yyyy-input";
import { PanelBanner, PanelCountLabel, StatusBadge, panelCardClass } from "./panel";
import { PanelTableTd, PanelTableTh } from "./panel-table-layout";
import { panelStickyToolbarClass, scrollbarThemedClass } from "./responsive-layout";

export interface ReporteDefinicionUI {
  id: string;
  label: string;
  descripcion: string;
  scope: "ambiente" | "entidad";
  formatos: ("pdf" | "excel")[];
  valorizado?: boolean;
  grupo?: "ambiente" | "entidad" | "situacion";
}

export interface ReporteResumenGrupoUI {
  label: string;
  count: number;
}

export interface ReporteResumenPreviewUI {
  total: number;
  porEstado: ReporteResumenGrupoUI[];
  porUbicacion: ReporteResumenGrupoUI[];
  valorizacion?: {
    valorAdquisicion: string;
    depreciacionAcumulada: string;
    valorNeto: string;
  };
}

export interface ReportesPanelContentProps {
  reportes: ReporteDefinicionUI[];
  reporteId: string;
  onReporteIdChange: (id: string) => void;
  entidades: { id: string; nombre: string }[];
  entidadId: string;
  onEntidadChange: (id: string) => void;
  hideEntidadSelector?: boolean;
  entidadNombreFija?: string;
  sedes: { id: string; nombre: string }[];
  sedeId: string;
  onSedeChange: (id: string) => void;
  ambientes: { id: string; nombre: string }[];
  ambienteId: string;
  onAmbienteChange: (id: string) => void;
  fechaCorte: string;
  onFechaCorteChange: (value: string) => void;
  ocultarFechaCorte?: boolean;
  previewFechaEmision?: string | null;
  previewFechaCorte?: string | null;
  loading: boolean;
  pending: "pdf" | "excel" | null;
  error: string | null;
  disabled?: boolean;
  offlineBanner?: ReactNode;
  onPreview: () => void;
  onExport: (formato: "pdf" | "excel") => void;
  previewHeaders: readonly string[];
  previewRows: string[][];
  previewTotal: number;
  resumen: ReporteResumenPreviewUI | null;
  esAdmin?: boolean;
}

function FechaCorteInput({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FechaDdMmYyyyInput
      id={id}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function opcionesTipoReporte(reportes: ReporteDefinicionUI[]) {
  const etiquetas = {
    ambiente: "Por ambiente",
    entidad: "De toda la entidad",
    situacion: "Situación",
  } as const;
  const orden = ["ambiente", "entidad", "situacion"] as const;
  if (!reportes.some((reporte) => reporte.grupo)) {
    return reportes.map((reporte) => ({ value: reporte.id, label: reporte.label }));
  }
  const options: {
    value: string;
    label: string;
    kind?: "section-header";
    disabled?: boolean;
  }[] = [];
  for (const grupo of orden) {
    const items = reportes.filter((reporte) => reporte.grupo === grupo);
    if (items.length === 0) continue;
    options.push({
      value: `__grupo_${grupo}`,
      label: etiquetas[grupo],
      kind: "section-header",
      disabled: true,
    });
    for (const reporte of items) {
      options.push({ value: reporte.id, label: reporte.label });
    }
  }
  for (const reporte of reportes.filter((item) => !item.grupo)) {
    options.push({ value: reporte.id, label: reporte.label });
  }
  return options;
}

function FormatoBadge({ formato }: { formato: "pdf" | "excel" }) {
  return (
    <StatusBadge variant={formato === "pdf" ? "default" : "pending"}>
      {formato === "pdf" ? "PDF" : "Excel"}
    </StatusBadge>
  );
}

export function ReportesPanelContent({
  reportes,
  reporteId,
  onReporteIdChange,
  entidades,
  entidadId,
  onEntidadChange,
  hideEntidadSelector,
  entidadNombreFija,
  sedes,
  sedeId,
  onSedeChange,
  ambientes,
  ambienteId,
  onAmbienteChange,
  fechaCorte,
  onFechaCorteChange,
  ocultarFechaCorte = false,
  previewFechaEmision,
  previewFechaCorte,
  loading,
  pending,
  error,
  disabled = false,
  offlineBanner,
  onPreview,
  onExport,
  previewHeaders,
  previewRows,
  previewTotal,
  resumen: _resumen,
  esAdmin = false,
}: ReportesPanelContentProps) {
  const definicion = reportes.find((r) => r.id === reporteId) ?? reportes[0]!;
  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);
  const ambienteSelectDisabled =
    !entidadId || disabled || (mostrarSelectorSede && !sedeId);
  const tieneVistaPrevia = previewTotal > 0 && previewRows.length > 0;
  const previewTruncado = previewTotal > previewRows.length;

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {offlineBanner}

      <section className={`${panelCardClass} space-y-3 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">1. Tipo de reporte</h2>
            <p className="text-xs text-muted-foreground">
              Elija el documento a generar con membrete institucional B&amp;D
            </p>
          </div>
          <PanelCountLabel
            count={reportes.length}
            singular="tipo disponible"
            plural="tipos disponibles"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="reporte_tipo" className="text-xs font-medium text-muted-foreground">
            Reporte
          </label>
          <Select
            id="reporte_tipo"
            value={reporteId}
            disabled={disabled}
            onChange={onReporteIdChange}
            options={opcionesTipoReporte(reportes)}
          />
          <p className="text-xs text-muted-foreground">{definicion.descripcion}</p>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge>{definicion.scope === "ambiente" ? "Por ambiente" : "Por entidad"}</StatusBadge>
            {definicion.valorizado && <StatusBadge variant="pending">Valorizado</StatusBadge>}
            {definicion.formatos.map((f) => (
              <FormatoBadge key={f} formato={f} />
            ))}
          </div>
        </div>
      </section>

      <section className={`${panelStickyToolbarClass} space-y-3 sm:space-y-4`}>
        <div>
          <h2 className="text-sm font-semibold text-foreground">2. Filtros y exportación</h2>
          <p className="text-xs text-muted-foreground">
            Configure alcance{ocultarFechaCorte ? "" : ", fecha de corte"} y descargue el archivo
          </p>
        </div>

        {hideEntidadSelector && entidadNombreFija ? (
          <PanelBanner label="Entidad" title={entidadNombreFija} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-4">
            <div className="space-y-1">
              <label htmlFor="reporte_entidad" className="text-xs font-medium text-muted-foreground">
                Entidad
              </label>
              <Select
                id="reporte_entidad"
                value={entidadId}
                disabled={disabled || hideEntidadSelector}
                onChange={onEntidadChange}
                options={[
                  { value: "", label: "Seleccione…" },
                  ...entidades.map((e) => ({ value: e.id, label: e.nombre })),
                ]}
              />
            </div>

            {definicion.scope === "ambiente" && (
              <>
                {mostrarSelectorSede && (
                <div className="space-y-1">
                  <label htmlFor="reporte_sede" className="text-xs font-medium text-muted-foreground">
                    Sede
                  </label>
                  <Select
                    id="reporte_sede"
                    value={sedeId}
                    disabled={!entidadId || disabled}
                    onChange={onSedeChange}
                    options={[
                      { value: "", label: "Seleccione…" },
                      ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                    ]}
                  />
                </div>
                )}
                <div className="space-y-1">
                  <label
                    htmlFor="reporte_ambiente"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Ambiente
                  </label>
                  <Select
                    id="reporte_ambiente"
                    value={ambienteId}
                    disabled={ambienteSelectDisabled}
                    onChange={onAmbienteChange}
                    options={[
                      { value: "", label: "Seleccione…" },
                      ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
                    ]}
                  />
                </div>
              </>
            )}

            {!ocultarFechaCorte && (
            <div className="space-y-1">
              <label htmlFor="reporte_corte" className="text-xs font-medium text-muted-foreground">
                Fecha de corte
              </label>
              <FechaCorteInput
                id="reporte_corte"
                value={fechaCorte}
                disabled={disabled}
                onChange={onFechaCorteChange}
              />
            </div>
            )}
          </div>
        )}

        {hideEntidadSelector && definicion.scope === "ambiente" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mostrarSelectorSede && (
            <div className="space-y-1">
              <label htmlFor="reporte_sede" className="text-xs font-medium text-muted-foreground">
                Sede
              </label>
              <Select
                id="reporte_sede"
                value={sedeId}
                disabled={!entidadId || disabled}
                onChange={onSedeChange}
                options={[
                  { value: "", label: "Seleccione…" },
                  ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                ]}
              />
            </div>
            )}
            <div className="space-y-1">
              <label htmlFor="reporte_ambiente" className="text-xs font-medium text-muted-foreground">
                Ambiente
              </label>
              <Select
                id="reporte_ambiente"
                value={ambienteId}
                disabled={ambienteSelectDisabled}
                onChange={onAmbienteChange}
                options={[
                  { value: "", label: "Seleccione…" },
                  ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
                ]}
              />
            </div>
            {!ocultarFechaCorte && (
            <div className="space-y-1">
              <label htmlFor="reporte_corte_admin" className="text-xs font-medium text-muted-foreground">
                Fecha de corte
              </label>
              <FechaCorteInput
                id="reporte_corte_admin"
                value={fechaCorte}
                disabled={disabled}
                onChange={onFechaCorteChange}
              />
            </div>
            )}
          </div>
        )}

        {hideEntidadSelector && definicion.scope === "entidad" && !ocultarFechaCorte && (
          <div className="max-w-xs space-y-1">
            <label htmlFor="reporte_corte_ent" className="text-xs font-medium text-muted-foreground">
              Fecha de corte
            </label>
            <FechaCorteInput
              id="reporte_corte_ent"
              value={fechaCorte}
              disabled={disabled}
              onChange={onFechaCorteChange}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="secondary" disabled={loading || disabled} onClick={onPreview}>
            {loading ? "Cargando…" : "Vista previa"}
          </Button>
          {definicion.formatos.includes("excel") && (
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null || !entidadId || disabled}
              onClick={() => onExport("excel")}
            >
              {pending === "excel" ? "Generando…" : "Descargar Excel"}
            </Button>
          )}
          {definicion.formatos.includes("pdf") && (
            <Button
              type="button"
              disabled={pending !== null || !entidadId || disabled}
              onClick={() => onExport("pdf")}
            >
              {pending === "pdf" ? "Generando…" : "Descargar PDF"}
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      {tieneVistaPrevia && (
        <section className={`${panelCardClass} space-y-3 p-4 sm:p-5`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">3. Vista previa</h2>
              <p className="text-xs text-muted-foreground">
                Primeras filas del reporte antes de exportar
              </p>
            </div>
            <PanelCountLabel count={previewTotal} singular="registro" plural="registros" />
          </div>

          {(previewFechaEmision || previewFechaCorte) && (
            <div className="space-y-0.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
              {previewFechaEmision && <p>{previewFechaEmision}</p>}
              {previewFechaCorte && <p>{previewFechaCorte}</p>}
            </div>
          )}

          <div className={`${scrollbarThemedClass} overflow-x-auto rounded-lg border border-border/60`}>
            <table className="w-full min-w-[48rem] border-collapse text-left">
              <thead className="border-b border-border/60 bg-muted/40">
                <tr>
                  {previewHeaders.map((header) => (
                    <PanelTableTh key={header} className="whitespace-nowrap">
                      {header}
                    </PanelTableTh>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-muted/25">
                    {row.map((cell, cellIndex) => (
                      <PanelTableTd key={cellIndex} title={cell}>
                        {cell}
                      </PanelTableTd>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewTruncado && (
            <p className="text-xs text-muted-foreground">
              Mostrando {previewRows.length} de {previewTotal} filas. El archivo exportado incluirá
              todos los registros.
            </p>
          )}
        </section>
      )}

      <div className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
        <p className="font-medium text-foreground">Formato institucional B&amp;D</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Membrete con razón social, RUC, fecha de emisión y fecha de corte (cuando aplica)</li>
          <li>Usuario generador y numeración de páginas en PDF</li>
          {esAdmin ? (
            <li>
              Fichas e inventarios sin valores monetarios, y reporte de bajas (acta y valorizados
              reservados al contador)
            </li>
          ) : (
            <>
              <li>Resumen por clasificación contable en reportes valorizados</li>
              <li>Acta con espacios para firmas (solo contador)</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
