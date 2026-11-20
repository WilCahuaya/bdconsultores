import { useMemo, useState } from "react";
import { nombreConsolidadoDesdeActivo } from "@inventario/types";
import type { ActivoConUbicacion } from "../lib/activos";
import {
  TableActionsOverflow,
  type TableActionItem,
} from "@inventario/ui/panel";
import { FotoPreviewDialog, PdfPreviewDialog } from "./ActivoMediaDialogs";
import { ActivoDetalleModal } from "./ActivoDetalleModal";
import { AgregarBienesSimilaresDialog, type AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import {
  ActivoIconButton,
  IconAmbiente,
  IconEditar,
  IconEtiqueta,
  IconFoto,
  IconSimilares,
  IconValidar,
  IconVer,
} from "./activo-icons";

interface ActivosCampoAccionesProps {
  entidadId: string;
  activo: ActivoConUbicacion;
  online: boolean;
  onEdit?: (activo: ActivoConUbicacion) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onValidated?: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onActivoEliminado?: (activoId: string) => void;
  puedeEliminarPreregistro?: boolean;
  compact?: boolean;
  variant?: "auto" | "menu" | "icons-and-menu" | "icons";
  /** El lápiz se pinta en la columna izquierda de la tabla. */
  ocultarEditar?: boolean;
}

export function ActivosCampoAcciones({
  entidadId,
  activo,
  online,
  onEdit,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onPrintLabel,
  onPrintBatch,
  onValidated,
  onActivoDeleted,
  onActivoEliminado,
  puedeEliminarPreregistro = false,
  compact,
  variant = "auto",
  ocultarEditar = false,
}: ActivosCampoAccionesProps) {
  const [fotoOpen, setFotoOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [similaresOpen, setSimilaresOpen] = useState(false);
  const esPreregistrado = activo.estado_registro === "PREREGISTRADO";
  const inactivo = activo.estado_registro === "DADO_DE_BAJA";
  const esPendiente = activo.id.startsWith("pending-");
  const iconSize = compact ? "h-7 w-7" : "h-8 w-8";
  const overflowVariant = compact ? (variant === "auto" ? "icons" : variant) : variant;

  const items = useMemo<TableActionItem[]>(() => {
    const list: TableActionItem[] = [];
    if (!ocultarEditar && !inactivo && onEdit) {
      list.push({
        id: "editar",
        label: esPreregistrado ? "Editar preregistro" : "Editar activo",
        icon: <IconEditar />,
        onClick: () => onEdit(activo),
      });
    }
    if (!inactivo) {
      list.push({
        id: "similares",
        label: "Agregar similares",
        icon: <IconSimilares />,
        disabled: esPendiente,
        onClick: () => setSimilaresOpen(true),
      });
    }
    if (activo.foto_path) {
      list.push({
        id: "foto",
        label: "Ver foto",
        icon: <IconFoto />,
        onClick: () => setFotoOpen(true),
      });
    }
    if (onIrAmbiente && activo.ambiente_id) {
      list.push({
        id: "ambiente",
        label: "Ir al ambiente",
        icon: <IconAmbiente />,
        onClick: () => onIrAmbiente(activo),
      });
    }
    list.push({
      id: "ver",
      label: "Ver activo",
      icon: <IconVer />,
      onClick: () => setDetalleOpen(true),
    });
    if (esPreregistrado) {
      list.push({
        id: "validar",
        label: "Validar preregistro",
        icon: <IconValidar />,
        onClick: () => setDetalleOpen(true),
      });
    }
    if (!inactivo && activo.codigo_barras) {
      list.push({
        id: "etiqueta",
        label: "Imprimir etiqueta",
        icon: <IconEtiqueta />,
        onClick: () => onPrintLabel(activo),
      });
    }
    return list;
  }, [activo, esPendiente, esPreregistrado, inactivo, ocultarEditar, online, onEdit, onIrAmbiente, onPrintLabel]);

  return (
    <>
      {compact ? (
        <TableActionsOverflow items={items} iconClassName={iconSize} variant={overflowVariant} />
      ) : (
        <div className="flex flex-row flex-wrap items-center justify-center gap-1">
          {!ocultarEditar && !inactivo && onEdit && (
            <ActivoIconButton
              label={esPreregistrado ? "Editar preregistro" : "Editar activo"}
              variant={esPreregistrado ? "default" : "primary"}
              className={iconSize}
              onClick={() => onEdit(activo)}
            >
              <IconEditar />
            </ActivoIconButton>
          )}
          {!inactivo && (
            <ActivoIconButton
              label="Agregar similares"
              className={iconSize}
              disabled={esPendiente}
              onClick={() => setSimilaresOpen(true)}
            >
              <IconSimilares />
            </ActivoIconButton>
          )}
          {activo.foto_path && (
            <ActivoIconButton
              label="Ver foto"
              className={iconSize}
              onClick={() => setFotoOpen(true)}
            >
              <IconFoto />
            </ActivoIconButton>
          )}
          <ActivoIconButton
            label="Ver activo"
            className={iconSize}
            onClick={() => setDetalleOpen(true)}
          >
            <IconVer />
          </ActivoIconButton>
          {esPreregistrado && (
            <ActivoIconButton
              label="Validar preregistro"
              variant="primary"
              className={iconSize}
              onClick={() => setDetalleOpen(true)}
            >
              <IconValidar />
            </ActivoIconButton>
          )}
          {!inactivo && activo.codigo_barras && (
            <ActivoIconButton
              label="Imprimir etiqueta"
              className={iconSize}
              onClick={() => onPrintLabel(activo)}
            >
              <IconEtiqueta />
            </ActivoIconButton>
          )}
        </div>
      )}

      <ActivoDetalleModal
        activo={activo}
        entidadId={entidadId}
        open={detalleOpen}
        onClose={() => setDetalleOpen(false)}
        online={online}
        onEdit={onEdit}
        onIrAmbiente={onIrAmbiente}
        onAbrirAmbienteDestino={onAbrirAmbienteDestino}
        onActivoUpdated={onValidated}
        onActivoDeleted={onActivoDeleted}
        onActivoEliminado={onActivoEliminado}
        puedeEliminarPreregistro={puedeEliminarPreregistro}
        onPrintLabel={onPrintLabel}
        onPrintBatch={onPrintBatch}
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

      <AgregarBienesSimilaresDialog
        open={similaresOpen}
        onClose={() => setSimilaresOpen(false)}
        activoId={activo.id}
        entidadId={entidadId}
        sedeId={activo.sede_id ?? ""}
        ambienteId={activo.ambiente_id ?? ""}
        sedeNombre={activo.sede_nombre}
        ambienteNombre={activo.ambiente_nombre}
        codigoCatalogo={activo.codigo_catalogo}
        nombre={activo.nombre}
        esRegistrado={!esPreregistrado}
        onAbrirAmbienteDestino={onAbrirAmbienteDestino}
          onSuccess={() => {
          onValidated?.(activo);
        }}
      />
    </>
  );
}
