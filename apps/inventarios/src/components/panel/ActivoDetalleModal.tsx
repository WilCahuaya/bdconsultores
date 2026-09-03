"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activo } from "@inventario/types";
import { formatEjemplaresEnAmbienteTexto, nombreConsolidadoDesdeActivo } from "@inventario/types";
import { ActivoDetalleSheet, type ActivoDetalle } from "@inventario/ui/panel";
import { EliminarPreregistroDialog, useToast, mensajeEliminacionPreregistros, ActivoHistorialPanel } from "@inventario/ui";
import type { HistorialActivoItem, HistorialLookupMaps } from "@inventario/types";
import { listHistorialActivo } from "@/lib/actions/historial";
import { deleteActivoPreregistrado, getEjemplaresSimilaresResumen } from "@/lib/actions/activos";
import { FotoPreviewDialog, PdfPreviewDialog } from "./ActivoMediaDialogs";
import { CambiarAmbienteDialog } from "./CambiarAmbienteDialog";
import { DarDeBajaDialog } from "./DarDeBajaDialog";
import { RecuperarActivoDialog } from "./RecuperarActivoDialog";
import { ValidarPreregistroDialog } from "./ValidarPreregistroDialog";
import { AgregarBienesSimilaresDialog } from "./AgregarBienesSimilaresDialog";
import {
  ActivoIconButton,
  IconAmbiente,
  IconEditar,
  IconEliminar,
  IconInactivo,
  IconRecuperar,
  IconSimilares,
  IconValidar,
} from "./activo-icons";

interface ActivoDetalleModalProps {
  activo: ActivoDetalle;
  open: boolean;
  onClose: () => void;
  onEdit?: (activo: Activo) => void;
  onIrAmbiente?: (activo: Activo) => void;
  puedeDarDeBaja?: boolean;
  puedeValidarPreregistro?: boolean;
  puedeEliminarPreregistro?: boolean;
  editarLabel?: string;
  soloUbicacion?: boolean;
  asignaCodigoInmediato?: boolean;
  onActivoEliminado?: (activoId: string) => void;
}

export function ActivoDetalleModal({
  activo,
  open,
  onClose,
  onEdit,
  onIrAmbiente,
  puedeDarDeBaja = true,
  puedeValidarPreregistro = false,
  puedeEliminarPreregistro = false,
  editarLabel = "Editar activo",
  soloUbicacion = false,
  asignaCodigoInmediato = true,
  onActivoEliminado,
}: ActivoDetalleModalProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [fotoOpen, setFotoOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [recuperarOpen, setRecuperarOpen] = useState(false);
  const [validarOpen, setValidarOpen] = useState(false);
  const [cambiarAmbienteOpen, setCambiarAmbienteOpen] = useState(false);
  const [similaresOpen, setSimilaresOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [ejemplaresLoading, setEjemplaresLoading] = useState(false);
  const [ejemplares, setEjemplares] = useState<{
    total: number;
    registrados: number;
    preregistrados: number;
  } | null>(null);
  const [historial, setHistorial] = useState<HistorialActivoItem[]>([]);
  const [historialLookups, setHistorialLookups] = useState<HistorialLookupMaps>({
    sedes: {},
    ambientes: {},
  });
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);

  const esPreregistrado = activo.estado_registro === "PREREGISTRADO";
  const inactivo = activo.estado_registro === "DADO_DE_BAJA";

  const reloadEjemplares = useCallback(() => {
    setEjemplaresLoading(true);
    void getEjemplaresSimilaresResumen(activo.id)
      .then(setEjemplares)
      .finally(() => setEjemplaresLoading(false));
  }, [activo.id]);

  function loadHistorial() {
    setHistorialLoading(true);
    setHistorialError(null);
    void listHistorialActivo(activo.id)
      .then(({ items, lookups }) => {
        setHistorial(items);
        setHistorialLookups(lookups);
      })
      .catch(() => setHistorialError("No se pudo cargar el historial."))
      .finally(() => setHistorialLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    reloadEjemplares();
    loadHistorial();
  }, [open, activo.id, reloadEjemplares]);

  function handleRefresh() {
    router.refresh();
    reloadEjemplares();
    loadHistorial();
  }

  const banner = (
    <>
      {esPreregistrado && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Este bien está <strong>preregistrado</strong>. Complételo y valídelo para asignar código de
          barras.
        </p>
      )}
      {inactivo && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-foreground">
          Este bien está <strong>dado de baja</strong>
          {activo.motivo_baja?.trim() ? (
            <>
              : <span className="text-muted-foreground">{activo.motivo_baja}</span>
            </>
          ) : (
            "."
          )}
        </p>
      )}
    </>
  );

  const ejemplaresHint =
    !ejemplaresLoading && ejemplares && ejemplares.total > 0 ? (
      <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-300">
        {formatEjemplaresEnAmbienteTexto(ejemplares)}
      </span>
    ) : null;

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {onIrAmbiente && activo.ambiente_id && (
        <ActivoIconButton
          label="Ir al ambiente"
          variant="primary"
          onClick={() => {
            onClose();
            onIrAmbiente(activo);
          }}
        >
          <IconAmbiente />
        </ActivoIconButton>
      )}
      {puedeValidarPreregistro && esPreregistrado && (
        <ActivoIconButton
          label="Validar preregistro"
          variant="primary"
          onClick={() => setValidarOpen(true)}
        >
          <IconValidar />
        </ActivoIconButton>
      )}
      {!inactivo && onEdit && (
        <ActivoIconButton
          label={editarLabel}
          variant={esPreregistrado ? "default" : "primary"}
          onClick={() => {
            onClose();
            onEdit(activo);
          }}
        >
          <IconEditar />
        </ActivoIconButton>
      )}
      {!inactivo && (
        <ActivoIconButton label="Agregar similares" onClick={() => setSimilaresOpen(true)}>
          <IconSimilares />
        </ActivoIconButton>
      )}
      {!inactivo && (
        <ActivoIconButton label="Cambiar ambiente" onClick={() => setCambiarAmbienteOpen(true)}>
          <IconAmbiente />
        </ActivoIconButton>
      )}
      {esPreregistrado && puedeEliminarPreregistro && (
        <ActivoIconButton
          label="Eliminar preregistro"
          variant="danger"
          onClick={() => setEliminarOpen(true)}
        >
          <IconEliminar />
        </ActivoIconButton>
      )}
      {!inactivo && !esPreregistrado && puedeDarDeBaja && (
        <ActivoIconButton label="Dar de baja" variant="danger" onClick={() => setBajaOpen(true)}>
          <IconInactivo />
        </ActivoIconButton>
      )}
      {inactivo && puedeDarDeBaja && (
        <ActivoIconButton
          label="Recuperar activo"
          variant="primary"
          onClick={() => setRecuperarOpen(true)}
        >
          <IconRecuperar />
        </ActivoIconButton>
      )}
    </div>
  );

  return (
    <>
      <ActivoDetalleSheet
        activo={activo}
        open={open}
        onClose={onClose}
        footer={footer}
        banner={banner}
        ejemplaresHint={ejemplaresHint}
        extraSections={
          <ActivoHistorialPanel
            loading={historialLoading}
            error={historialError}
            items={historial}
            lookups={historialLookups}
          />
        }
        onVerFoto={activo.foto_path ? () => setFotoOpen(true) : undefined}
        onVerComprobante={activo.comprobante_path ? () => setPdfOpen(true) : undefined}
      />

      {activo.foto_path && (
        <FotoPreviewDialog
          open={fotoOpen}
          onClose={() => setFotoOpen(false)}
          path={activo.foto_path}
          titulo={nombreConsolidadoDesdeActivo(activo)}
        />
      )}

      {activo.comprobante_path && (
        <PdfPreviewDialog
          open={pdfOpen}
          onClose={() => setPdfOpen(false)}
          path={activo.comprobante_path}
          titulo={activo.comprobante_serie ? `Comprobante ${activo.comprobante_serie}` : undefined}
        />
      )}

      <DarDeBajaDialog
        open={bajaOpen}
        onClose={() => setBajaOpen(false)}
        activoId={activo.id}
        nombre={activo.nombre}
        onSuccess={handleRefresh}
      />

      <EliminarPreregistroDialog
        open={eliminarOpen}
        onClose={() => setEliminarOpen(false)}
        activoId={activo.id}
        nombre={activo.nombre}
        onDelete={async (activoId) => {
          const result = await deleteActivoPreregistrado(activoId);
          if (result.error) {
            pushToast(result.error, "error");
          }
          return result;
        }}
        onSuccess={() => {
          pushToast(mensajeEliminacionPreregistros(1), "success");
          onActivoEliminado?.(activo.id);
          onClose();
          void router.refresh();
        }}
      />

      <RecuperarActivoDialog
        open={recuperarOpen}
        onClose={() => setRecuperarOpen(false)}
        activoId={activo.id}
        nombre={activo.nombre}
        tieneCodigoBarras={Boolean(activo.codigo_barras?.trim())}
        onSuccess={handleRefresh}
      />

      <CambiarAmbienteDialog
        open={cambiarAmbienteOpen}
        onClose={() => setCambiarAmbienteOpen(false)}
        activo={activo}
        onSuccess={handleRefresh}
      />

      <AgregarBienesSimilaresDialog
        open={similaresOpen}
        onClose={() => setSimilaresOpen(false)}
        activoId={activo.id}
        entidadId={activo.entidad_id}
        sedeId={activo.sede_id ?? ""}
        ambienteId={activo.ambiente_id ?? ""}
        sedeNombre={activo.sede_nombre}
        ambienteNombre={activo.ambiente_nombre}
        codigoCatalogo={activo.codigo_catalogo}
        nombre={activo.nombre}
        esRegistrado={!esPreregistrado}
        onSuccess={(info) => {
          if (info.ambienteDestinoId) {
            onClose();
          } else {
            handleRefresh();
          }
        }}
      />

      {puedeValidarPreregistro && esPreregistrado && (
        <ValidarPreregistroDialog
          open={validarOpen}
          onClose={() => setValidarOpen(false)}
          entidadId={activo.entidad_id}
          activoId={activo.id}
          nombre={activo.nombre}
          codigoCatalogo={activo.codigo_catalogo}
          posibleAmbienteId={activo.posible_ambiente_id}
          posibleAmbienteNombre={activo.posible_ambiente_nombre}
          onSuccess={handleRefresh}
        />
      )}
    </>
  );
}
