"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { nombreConsolidadoDesdeActivo, type Activo } from "@inventario/types";
import {
  TableActionsOverflow,
  type ActivoDetalle,
  type TableActionItem,
} from "@inventario/ui/panel";
import { FotoPreviewDialog } from "./ActivoMediaDialogs";
import { ActivoDetalleModal } from "./ActivoDetalleModal";
import { AgregarBienesSimilaresDialog } from "./AgregarBienesSimilaresDialog";
import { MoverFaltanteDialog } from "./MoverFaltanteDialog";
import { ValidarPreregistroDialog } from "./ValidarPreregistroDialog";
import {
  ActivoIconButton,
  IconAmbiente,
  IconEditar,
  IconFoto,
  IconMover,
  IconSimilares,
  IconValidar,
  IconVer,
} from "./activo-icons";

interface ActivoAccionesBarProps {
  activo: ActivoDetalle;
  onEdit?: (activo: Activo) => void;
  onIrAmbiente?: (activo: Activo) => void;
  className?: string;
  compact?: boolean;
  variant?: "auto" | "menu" | "icons-and-menu" | "icons";
  puedeDarDeBaja?: boolean;
  puedeValidarPreregistro?: boolean;
  puedeEliminarPreregistro?: boolean;
  puedeMoverDesdeFaltante?: boolean;
  editarLabel?: string;
  modoAdmin?: boolean;
  onActivoEliminado?: (activoId: string) => void;
}

export function ActivoAccionesBar({
  activo,
  onEdit,
  onIrAmbiente,
  className,
  compact = false,
  variant = "auto",
  puedeDarDeBaja = true,
  puedeValidarPreregistro = false,
  puedeEliminarPreregistro = false,
  puedeMoverDesdeFaltante = false,
  editarLabel = "Editar activo",
  modoAdmin = false,
  onActivoEliminado,
}: ActivoAccionesBarProps) {
  const router = useRouter();
  const [fotoOpen, setFotoOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [similaresOpen, setSimilaresOpen] = useState(false);
  const [validarOpen, setValidarOpen] = useState(false);
  const [moverOpen, setMoverOpen] = useState(false);
  const inactivo = activo.estado_registro === "DADO_DE_BAJA";
  const esPreregistrado = activo.estado_registro === "PREREGISTRADO";
  const mostrarValidar = puedeValidarPreregistro && esPreregistrado;
  const mostrarMover = puedeMoverDesdeFaltante && activo.estado_registro === "REGISTRADO";
  const iconSize = compact ? "h-7 w-7" : "h-9 w-9";
  const overflowVariant = compact ? (variant === "auto" ? "icons" : variant) : variant;

  const items = useMemo<TableActionItem[]>(() => {
    const list: TableActionItem[] = [];
    if (!inactivo && onEdit) {
      list.push({
        id: "editar",
        label: editarLabel,
        icon: <IconEditar />,
        onClick: () => onEdit(activo),
      });
    }
    if (mostrarValidar) {
      list.push({
        id: "validar",
        label: "Validar preregistro",
        icon: <IconValidar />,
        onClick: () => setValidarOpen(true),
      });
    }
    if (mostrarMover && activo.ambiente_id) {
      list.push({
        id: "mover",
        label: "Mover",
        icon: <IconMover />,
        onClick: () => setMoverOpen(true),
      });
    }
    if (!inactivo) {
      list.push({
        id: "similares",
        label: "Agregar similares",
        icon: <IconSimilares />,
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
    return list;
  }, [
    activo,
    activo.ambiente_id,
    activo.foto_path,
    editarLabel,
    inactivo,
    mostrarMover,
    mostrarValidar,
    onEdit,
    onIrAmbiente,
  ]);

  return (
    <>
      {compact ? (
        <TableActionsOverflow
          items={items}
          iconClassName={iconSize}
          variant={overflowVariant}
        />
      ) : (
        <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
          {!inactivo && onEdit && (
            <ActivoIconButton
              label={editarLabel}
              variant={esPreregistrado ? "default" : "primary"}
              onClick={() => onEdit(activo)}
              className={iconSize}
            >
              <IconEditar />
            </ActivoIconButton>
          )}
          {mostrarValidar && (
            <ActivoIconButton
              label="Validar preregistro"
              variant="primary"
              onClick={() => setValidarOpen(true)}
              className={iconSize}
            >
              <IconValidar />
            </ActivoIconButton>
          )}
          {mostrarMover && activo.ambiente_id && (
            <ActivoIconButton
              label="Mover"
              variant="primary"
              onClick={() => setMoverOpen(true)}
              className={iconSize}
            >
              <IconMover />
            </ActivoIconButton>
          )}
          {!inactivo && (
            <ActivoIconButton
              label="Agregar similares"
              onClick={() => setSimilaresOpen(true)}
              className={iconSize}
            >
              <IconSimilares />
            </ActivoIconButton>
          )}
          {activo.foto_path && (
            <ActivoIconButton
              label="Ver foto"
              onClick={() => setFotoOpen(true)}
              className={iconSize}
            >
              <IconFoto />
            </ActivoIconButton>
          )}
          <ActivoIconButton
            label="Ver activo"
            onClick={() => setDetalleOpen(true)}
            className={iconSize}
          >
            <IconVer />
          </ActivoIconButton>
        </div>
      )}

      <ActivoDetalleModal
        activo={activo}
        open={detalleOpen}
        onClose={() => setDetalleOpen(false)}
        onEdit={onEdit}
        onIrAmbiente={onIrAmbiente}
        puedeDarDeBaja={puedeDarDeBaja}
        puedeValidarPreregistro={puedeValidarPreregistro}
        puedeEliminarPreregistro={puedeEliminarPreregistro}
        editarLabel={editarLabel}
        soloUbicacion={modoAdmin && activo.estado_registro === "REGISTRADO"}
        asignaCodigoInmediato={activo.estado_registro === "REGISTRADO"}
        onActivoEliminado={onActivoEliminado}
      />

      {mostrarValidar && (
        <ValidarPreregistroDialog
          open={validarOpen}
          onClose={() => setValidarOpen(false)}
          entidadId={activo.entidad_id}
          activoId={activo.id}
          nombre={activo.nombre}
          codigoCatalogo={activo.codigo_catalogo}
          posibleAmbienteId={activo.posible_ambiente_id}
          posibleAmbienteNombre={activo.posible_ambiente_nombre}
          onSuccess={() => {
            setValidarOpen(false);
            router.refresh();
          }}
        />
      )}

      {activo.foto_path && (
        <FotoPreviewDialog
          open={fotoOpen}
          onClose={() => setFotoOpen(false)}
          path={activo.foto_path}
          titulo={nombreConsolidadoDesdeActivo(activo)}
        />
      )}

      {mostrarMover && activo.ambiente_id ? (
        <MoverFaltanteDialog
          open={moverOpen}
          onClose={() => setMoverOpen(false)}
          entidadId={activo.entidad_id}
          ambienteId={activo.ambiente_id}
          activoId={activo.id}
          nombre={activo.nombre}
        />
      ) : null}

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
          if (!info.ambienteDestinoId) router.refresh();
        }}
      />
    </>
  );
}
