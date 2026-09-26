import * as React from "react";
import type {
  EstadoVisitaAmbiente,
  VisitaCampoActiva,
  VisitaCampoAmbienteDetalle,
  VisitaCampoHistorial,
} from "@inventario/types";
import { Button, Dialog, Select } from "./components";
import {
  PanelDataTable,
  PanelEmptyState,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  StatusBadge,
  VISITAS_HISTORIAL_TABLE_WIDTHS_PCT,
  panelTableBodyRowClass,
  panelTableHeadRowClass,
  panelTableNowrapCellClass,
  panelTableStickyHeadClass,
} from "./panel";

export function VisitaCampoConteo({
  revisados,
  total,
}: {
  revisados: number | null;
  total: number | null;
}) {
  if (revisados == null || total == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const completo = total > 0 && revisados === total;
  const enCero = revisados === 0;
  const title = enCero
    ? total === 0
      ? "Sin bienes revisados"
      : `Ninguno revisado de ${total}`
    : completo
      ? `${revisados} de ${total} revisados`
      : `${revisados} revisados de ${total}`;
  const color = completo
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    : enCero
      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${color}`} title={title}>
      {revisados}/{total}
    </span>
  );
}

export function VisitaCampoEstadoBadge({
  estado,
}: {
  estado: EstadoVisitaAmbiente | null;
  esPreregistro?: boolean;
}) {
  if (!estado) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (estado === "CULMINADO") {
    return <StatusBadge variant="active">Culminado</StatusBadge>;
  }
  return <StatusBadge variant="pending">En proceso</StatusBadge>;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function visitaCampoSedeLabel(visita: {
  sede_id: string | null;
  sede_nombre: string | null;
}): string {
  return visita.sede_id ? (visita.sede_nombre ?? "Sucursal") : "Todas las sucursales";
}

export type IniciarVisitaSedeOption = {
  id: string;
  nombre: string;
  es_principal?: boolean;
};

export function puedeIniciarNuevaVisitaCampo(
  visitas: VisitaCampoActiva[],
  sedes: IniciarVisitaSedeOption[],
): boolean {
  const sedesEnVisita = visitas
    .map((v) => v.sede_id)
    .filter((id): id is string => Boolean(id));
  const todasEnVisita = visitas.some((v) => !v.sede_id);
  const sedesOcupadas = new Set(sedesEnVisita);
  return (
    !todasEnVisita &&
    (sedes.length <= 1
      ? visitas.length === 0
      : sedesOcupadas.size === 0 || sedes.some((s) => !sedesOcupadas.has(s.id)))
  );
}

export function IniciarVisitaCampoButton({
  visitas,
  sedes,
  pending,
  onClick,
}: {
  visitas: VisitaCampoActiva[];
  sedes: IniciarVisitaSedeOption[];
  pending?: boolean;
  onClick: () => void;
}) {
  const puedeIniciar = puedeIniciarNuevaVisitaCampo(visitas, sedes);

  return (
    <Button type="button" size="sm" disabled={pending || !puedeIniciar} onClick={onClick}>
      {pending ? "Iniciando…" : "Iniciar visita de campo"}
    </Button>
  );
}

export function IniciarVisitaCampoDialog({
  open,
  onClose,
  sedes,
  sedesEnVisita = [],
  todasEnVisita = false,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  sedes: IniciarVisitaSedeOption[];
  /** IDs de sucursales que ya tienen visita abierta */
  sedesEnVisita?: string[];
  /** Hay visita abierta en todas las sucursales */
  todasEnVisita?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (sedeId: string | null) => void;
}) {
  const multipleSedes = sedes.length > 1;
  const sedesDisponibles = sedes.filter((s) => !sedesEnVisita.includes(s.id));
  const puedeTodas = !todasEnVisita && sedesEnVisita.length === 0;
  const puedeAlguna = sedesDisponibles.length > 0;

  const [alcance, setAlcance] = React.useState<"todas" | "una">("todas");
  const [sedeId, setSedeId] = React.useState(sedesDisponibles[0]?.id ?? "");

  React.useEffect(() => {
    if (!open) return;
    const disponibles = sedes.filter((s) => !sedesEnVisita.includes(s.id));
    const puedeTodasLocal = !todasEnVisita && sedesEnVisita.length === 0;
    if (puedeTodasLocal && sedes.length > 1) {
      setAlcance("todas");
      setSedeId(disponibles[0]?.id ?? "");
    } else if (disponibles.length > 0) {
      setAlcance("una");
      setSedeId(disponibles[0].id);
    }
  }, [open, sedes, sedesEnVisita, todasEnVisita]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (alcance === "todas") {
      if (!puedeTodas) return;
      onConfirm(null);
      return;
    }
    if (!sedeId || sedesEnVisita.includes(sedeId)) return;
    onConfirm(sedeId);
  }

  const sedeUnica = sedes.length === 1 ? sedes[0] : null;
  const sedeUnicaOcupada = sedeUnica ? sedesEnVisita.includes(sedeUnica.id) : false;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Iniciar visita de campo"
      description={
        sedeUnica
          ? sedeUnicaOcupada
            ? `${sedeUnica.nombre} ya tiene una visita abierta.`
            : `Se visitarán los ambientes de ${sedeUnica.nombre}.`
          : "Indique el alcance de la visita en esta entidad."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {multipleSedes ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Alcance</legend>
            <label
              className={`flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5 ${
                puedeTodas ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name="alcance-visita"
                className="mt-1"
                checked={alcance === "todas"}
                disabled={!puedeTodas}
                onChange={() => setAlcance("todas")}
              />
              <span>
                <span className="block text-sm font-medium">Todas las sucursales</span>
                <span className="block text-xs text-muted-foreground">
                  {puedeTodas
                    ? `Incluye ambientes de las ${sedes.length} sucursales activas.`
                    : "Disponible solo si no hay otras visitas abiertas."}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5">
              <input
                type="radio"
                name="alcance-visita"
                className="mt-1"
                checked={alcance === "una"}
                disabled={!puedeAlguna}
                onChange={() => setAlcance("una")}
              />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="block text-sm font-medium">Una sucursal</span>
                <Select
                  value={sedeId}
                  onChange={setSedeId}
                  disabled={alcance !== "una" || !puedeAlguna}
                  options={sedes.map((s) => ({
                    value: s.id,
                    label: sedesEnVisita.includes(s.id)
                      ? `${s.es_principal ? `${s.nombre} (Principal)` : s.nombre} — en visita`
                      : s.es_principal
                        ? `${s.nombre} (Principal)`
                        : s.nombre,
                    disabled: sedesEnVisita.includes(s.id),
                  }))}
                />
              </span>
            </label>
          </fieldset>
        ) : sedeUnicaOcupada ? (
          <p className="text-sm text-muted-foreground">
            Esta sucursal ya tiene una visita de campo en curso.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta entidad tiene una sola sucursal. La visita cubrirá todos sus ambientes.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              (multipleSedes
                ? (alcance === "todas" && !puedeTodas) ||
                  (alcance === "una" && (!sedeId || sedesEnVisita.includes(sedeId)))
                : sedeUnicaOcupada)
            }
          >
            {pending ? "Iniciando…" : "Iniciar visita"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function VisitasCampoBanner({
  visitas,
  puedeGestionar,
  cerrarPendingId,
  onCerrar,
  error,
}: {
  visitas: VisitaCampoActiva[];
  sedes?: IniciarVisitaSedeOption[];
  puedeGestionar: boolean;
  cerrarPendingId?: string | null;
  onCerrar?: (visitaId: string) => void;
  error?: string | null;
}) {
  if (visitas.length === 0 && !puedeGestionar) return null;

  return (
    <div className="space-y-3">
      {visitas.length > 0 ? (
        <ul className="space-y-2">
          {visitas.map((visita) => (
            <li
              key={visita.id}
              className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Visita #{visita.numero} · {visitaCampoSedeLabel(visita)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {visita.ambientes_culminados}/{visita.ambientes_total} ambientes culminados
                    {visita.abierto_por_nombre ? ` · ${visita.abierto_por_nombre}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatFecha(visita.abierto_at)}. Entre a cada ambiente y marque cada bien
                    como hallado o no. El ambiente se culmina al terminar esa revisión.
                  </p>
                </div>
                {puedeGestionar && onCerrar ? (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="disabled:cursor-not-allowed"
                      disabled={!visita.revision_completa || cerrarPendingId === visita.id}
                      title={
                        visita.revision_completa
                          ? "Cerrar la visita de campo"
                          : "Revise todos los bienes antes de terminar la visita"
                      }
                      onClick={() => {
                        if (!visita.revision_completa) return;
                        onCerrar(visita.id);
                      }}
                    >
                      {cerrarPendingId === visita.id ? "Terminando…" : "Terminar visita"}
                    </Button>
                    {!visita.revision_completa ? (
                      <p className="text-[11px] text-muted-foreground">Faltan bienes por revisar</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
          <p className="text-sm text-muted-foreground">
            No hay visitas de campo en curso. Inicie una al comenzar el recorrido en sitio.
          </p>
        </div>
      )}

      {puedeGestionar && visitas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Puede abrir visitas en otras sucursales de forma independiente.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** @deprecated Usar VisitasCampoBanner */
export function VisitaCampoBanner({
  visita,
  ...props
}: {
  visita: VisitaCampoActiva | null;
  puedeGestionar: boolean;
  pending?: boolean;
  onAbrir?: () => void;
  onCerrar?: () => void;
  error?: string | null;
}) {
  return (
    <VisitasCampoBanner
      visitas={visita ? [visita] : []}
      cerrarPendingId={props.pending ? visita?.id : null}
      onCerrar={props.onCerrar && visita ? () => props.onCerrar!() : undefined}
      puedeGestionar={props.puedeGestionar}
      error={props.error}
    />
  );
}

function VisitaFechaCelda({
  fecha,
  responsable,
}: {
  fecha: string;
  responsable?: string | null;
}) {
  return (
    <div className="min-w-[10.5rem] space-y-0.5">
      <div className="whitespace-nowrap text-sm">{formatFecha(fecha)}</div>
      {responsable ? (
        <div className="truncate text-xs text-muted-foreground" title={responsable}>
          {responsable}
        </div>
      ) : null}
    </div>
  );
}

export function VisitasCampoHistorialPanel({
  historial,
  loadingDetalle,
  detalle,
  detalleVisita,
  onVerDetalle,
  onCerrarDetalle,
}: {
  historial: VisitaCampoHistorial[];
  loadingDetalle?: boolean;
  detalle: VisitaCampoAmbienteDetalle[] | null;
  detalleVisita: VisitaCampoHistorial | null;
  onVerDetalle: (visita: VisitaCampoHistorial) => void;
  onCerrarDetalle: () => void;
}) {
  if (historial.length === 0) {
    return (
      <PanelEmptyState message="Aún no hay visitas de campo registradas para esta entidad." />
    );
  }

  return (
    <>
      <PanelDataTable layout="fixed">
        <PanelTableColgroup widths={VISITAS_HISTORIAL_TABLE_WIDTHS_PCT} />
        <thead className={panelTableStickyHeadClass}>
          <tr className={panelTableHeadRowClass}>
            <PanelTableTh className={panelTableNowrapCellClass}>#</PanelTableTh>
            <PanelTableTh>Sucursal</PanelTableTh>
            <PanelTableTh className={panelTableNowrapCellClass}>Apertura</PanelTableTh>
            <PanelTableTh className={panelTableNowrapCellClass}>Cierre</PanelTableTh>
            <PanelTableTh align="center" className={panelTableNowrapCellClass}>
              Ambientes
            </PanelTableTh>
            <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
            <PanelTableTh align="right" className={panelTableNowrapCellClass}>
              Detalle
            </PanelTableTh>
          </tr>
        </thead>
        <tbody>
          {historial.map((visita) => (
            <tr key={visita.id} className={panelTableBodyRowClass}>
              <PanelTableTd className={`font-medium ${panelTableNowrapCellClass}`}>
                {visita.numero}
              </PanelTableTd>
              <PanelTableTd className="text-sm" title={visitaCampoSedeLabel(visita)}>
                <span className="block truncate">{visitaCampoSedeLabel(visita)}</span>
              </PanelTableTd>
              <PanelTableTd className={panelTableNowrapCellClass}>
                <VisitaFechaCelda
                  fecha={visita.abierto_at}
                  responsable={visita.abierto_por_nombre}
                />
              </PanelTableTd>
              <PanelTableTd className={panelTableNowrapCellClass}>
                {visita.cerrado_at ? (
                  <VisitaFechaCelda
                    fecha={visita.cerrado_at}
                    responsable={visita.cerrado_por_nombre}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PanelTableTd>
              <PanelTableTd align="center" className={panelTableNowrapCellClass}>
                {visita.ambientes_culminados}/{visita.ambientes_total}
              </PanelTableTd>
              <PanelTableTd className={panelTableNowrapCellClass}>
                {visita.estado === "ABIERTO" ? (
                  <StatusBadge variant="pending">Abierta</StatusBadge>
                ) : (
                  <StatusBadge variant="active">Cerrada</StatusBadge>
                )}
              </PanelTableTd>
              <PanelTableTd align="right" className={panelTableNowrapCellClass}>
                <Button type="button" size="sm" variant="outline" onClick={() => onVerDetalle(visita)}>
                  Ver
                </Button>
              </PanelTableTd>
            </tr>
          ))}
        </tbody>
      </PanelDataTable>

      <Dialog
        open={!!detalleVisita}
        onClose={onCerrarDetalle}
        title={
          detalleVisita
            ? `Visita de campo #${detalleVisita.numero}`
            : "Detalle de visita"
        }
        description={
          detalleVisita
            ? `${visitaCampoSedeLabel(detalleVisita)} · ${
                detalleVisita.cerrado_at
                  ? `Cerrada el ${formatFecha(detalleVisita.cerrado_at)}`
                  : `Abierta el ${formatFecha(detalleVisita.abierto_at)}`
              }`
            : undefined
        }
      >
        {loadingDetalle ? (
          <p className="text-sm text-muted-foreground">Cargando detalle…</p>
        ) : detalle && detalle.length > 0 ? (
          <ul className="max-h-[min(24rem,60vh)] space-y-2 overflow-y-auto text-sm">
            {detalle.map((fila) => (
              <li
                key={fila.ambiente_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{fila.ambiente_nombre}</p>
                  <p className="text-xs text-muted-foreground">{fila.sede_nombre}</p>
                </div>
                <div className="text-right">
                  <VisitaCampoEstadoBadge estado={fila.estado} />
                  {fila.culminado_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFecha(fila.culminado_at)}
                      {fila.culminado_por_nombre ? ` · ${fila.culminado_por_nombre}` : ""}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin ambientes en esta visita.</p>
        )}
      </Dialog>
    </>
  );
}