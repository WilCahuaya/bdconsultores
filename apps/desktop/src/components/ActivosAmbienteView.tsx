import { useEffect, useMemo, useState } from "react";
import { listAmbientesPorEntidad } from "../lib/ubicacion";
import { parseCantidadMenaje, type Entidad } from "@inventario/types";
import { AmbienteApartadoNav, Button, MenajeAmbientePanel } from "@inventario/ui";
import { createActivo, darDeBajaMenaje, eliminarMenaje, updateActivo, type ActivoConUbicacion } from "../lib/activos";
import { aplicarComprobantesMenaje } from "../lib/menaje-comprobantes-client";
import { getSignedStorageUrl } from "../lib/storage-url";
import { createCatalogoMenaje, getCatalogoByCodigo, searchCatalogoMenaje } from "../lib/catalogo";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import {
  resolveFichaAsignacionExportMeta,
  type FichaAsignacionExportMeta,
} from "../lib/ficha-asignacion-meta";
import { ActivosCampoList } from "./ActivosCampoList";
import { AmbienteReportesExport } from "./AmbienteReportesExport";
import { listProcedenciaFaltante } from "../lib/visitas-campo";
import { FaltanteBienesPanel, useVisitaRevision } from "./VisitaRevisionPanel";

interface ActivosAmbienteViewProps {
  entidad: Entidad;
  ambienteId: string;
  ambienteNombre: string;
  ambienteResponsable?: string | null;
  ambienteResponsableId?: string | null;
  sedeId: string;
  sedeNombre?: string | null;
  esAmbientePreregistro?: boolean;
  esAmbienteFaltante?: boolean;
  activos: ActivoConUbicacion[];
  loading: boolean;
  online: boolean;
  usuarioNombre: string;
  usuarioEmail: string;
  onRegister: () => void;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onInventarioRefresh?: () => void;
}

export function ActivosAmbienteView({
  entidad,
  ambienteId,
  ambienteNombre,
  ambienteResponsable,
  ambienteResponsableId,
  sedeId,
  sedeNombre,
  esAmbientePreregistro = false,
  esAmbienteFaltante = false,
  activos,
  loading,
  online,
  usuarioNombre,
  usuarioEmail,
  onRegister,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onActivoUpdated,
  onActivoDeleted,
  onAbrirAmbienteDestino,
  onInventarioRefresh,
}: ActivosAmbienteViewProps) {
  const activosAmbiente = useMemo(
    () => activos.filter((a) => a.ambiente_id === ambienteId && a.categoria !== "MENAJE"),
    [activos, ambienteId],
  );
  const menajeLineas = useMemo(
    () =>
      activos.filter(
        (a) =>
          a.ambiente_id === ambienteId &&
          a.categoria === "MENAJE" &&
          a.estado_registro !== "DADO_DE_BAJA",
      ),
    [activos, ambienteId],
  );
  const menajeBajas = useMemo(
    () =>
      activos.filter(
        (a) =>
          a.ambiente_id === ambienteId &&
          a.categoria === "MENAJE" &&
          a.estado_registro === "DADO_DE_BAJA",
      ),
    [activos, ambienteId],
  );
  const [apartado, setApartado] = useState<"bienes" | "menaje">("bienes");
  const [esFaltanteRemoto, setEsFaltanteRemoto] = useState<boolean | null>(null);
  useEffect(() => {
    setEsFaltanteRemoto(null);
    let cancel = false;
    void listAmbientesPorEntidad(entidad.id, sedeId).then((lista) => {
      if (cancel) return;
      const actual = lista.find((item) => item.id === ambienteId);
      if (actual) setEsFaltanteRemoto(actual.es_faltante === true);
    });
    return () => {
      cancel = true;
    };
  }, [ambienteId, entidad.id, sedeId]);
  const esFaltante = esFaltanteRemoto ?? esAmbienteFaltante === true;
  const [procedenciaPorActivo, setProcedenciaPorActivo] = useState<Record<string, string>>({});
  const procedenciaIds = useMemo(
    () => (esFaltante ? activosAmbiente.map((activo) => activo.id).join(",") : ""),
    [activosAmbiente, esFaltante],
  );
  useEffect(() => {
    if (!esFaltante) {
      setProcedenciaPorActivo({});
      return;
    }
    const ids = procedenciaIds ? procedenciaIds.split(",") : [];
    let cancel = false;
    void listProcedenciaFaltante(ids).then((mapa) => {
      if (!cancel) setProcedenciaPorActivo(mapa);
    });
    return () => {
      cancel = true;
    };
  }, [esFaltante, procedenciaIds]);
  const visita = useVisitaRevision({
    ambienteId,
    activos: activosAmbiente,
    enabled: !esAmbientePreregistro && !esFaltante,
    onChanged: onInventarioRefresh,
  });

  const [fichaMeta, setFichaMeta] = useState<FichaAsignacionExportMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveFichaAsignacionExportMeta(
      entidad,
      {
        responsable_id: ambienteResponsableId ?? null,
        responsable: ambienteResponsable ?? null,
      },
      sedeNombre,
    )
      .then((meta) => {
        if (!cancelled) setFichaMeta(meta);
      })
      .catch(() => {
        if (!cancelled) setFichaMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entidad, ambienteResponsableId, ambienteResponsable, sedeNombre]);

  const exportMeta = useMemo(
    () => ({
      ambienteNombre,
      entidadNombre: entidad.nombre,
      sedeNombre: fichaMeta?.sedeNombre ?? sedeNombre,
      responsable: fichaMeta?.responsable ?? ambienteResponsable,
      responsableDni: fichaMeta?.responsableDni,
      adminNombre: fichaMeta?.adminNombre ?? entidad.admin_nombre,
      adminDni: fichaMeta?.adminDni,
      usuarioNombre,
      usuarioEmail,
    }),
    [
      ambienteNombre,
      ambienteResponsable,
      entidad,
      fichaMeta,
      sedeNombre,
      usuarioNombre,
      usuarioEmail,
    ],
  );

  const mostrarMenaje = !esAmbientePreregistro && !esFaltante;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {mostrarMenaje ? (
        <AmbienteApartadoNav
          value={apartado}
          onChange={setApartado}
          menajeCount={menajeLineas.length}
        />
      ) : null}
      {mostrarMenaje && apartado === "menaje" ? (
        <MenajeAmbientePanel
          lineas={menajeLineas}
          bajas={menajeBajas}
          searchCatalogo={searchCatalogoMenaje}
          resolveCodigo={getCatalogoByCodigo}
          onCrearCatalogo={createCatalogoMenaje}
          onVerComprobante={(path) => {
            void getSignedStorageUrl("comprobantes-activos", path).then((result) => {
              if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
            });
          }}
          onAgregar={async (input) => {
            const result = await createActivo({
              entidad_id: entidad.id,
              codigo_catalogo: input.codigo,
              nombre: input.nombre,
              categoria: "MENAJE",
              cantidad: input.cantidad,
              material: input.material,
              color: input.color,
              medidas: input.medidas,
              caracteristicas: input.caracteristicas,
              estado_bien: input.estado_bien,
              observacion: input.observacion,
              sede_id: sedeId,
              ambiente_id: ambienteId,
              estado_registro: "REGISTRADO",
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            const comp = await aplicarComprobantesMenaje({
              entidadId: entidad.id,
              activoId: result.data.id,
              nuevo: input.comprobanteNuevo,
              cambios: input.comprobantesCambio,
            });
            onInventarioRefresh?.();
            if (comp.error) {
              return {
                aviso: `Menaje registrado. El comprobante no se guardó: ${comp.error}. Edite la fila para cargarlo de nuevo.`,
              };
            }
            return { aviso: result.aviso };
          }}
          onGuardar={async (linea, input) => {
            const comp = await aplicarComprobantesMenaje({
              entidadId: entidad.id,
              activoId: linea.id,
              nuevo: input.comprobanteNuevo,
              cambios: input.comprobantesCambio,
            });
            if (comp.error) return { error: comp.error };
            const result = await updateActivo(linea.id, {
              codigo_catalogo: linea.codigo_catalogo,
              nombre: linea.nombre,
              categoria: "MENAJE",
              cantidad: input.cantidad,
              material: input.material,
              color: input.color,
              medidas: input.medidas,
              caracteristicas: input.caracteristicas,
              estado_bien: input.estado_bien,
              observacion: input.observacion,
              sede_id: sedeId,
              ambiente_id: ambienteId,
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            onInventarioRefresh?.();
            return { aviso: result.aviso };
          }}
          onAgregarAdquisicion={async (linea, input) => {
            const total = (linea.cantidad ?? 0) + input.cantidad;
            const tope = parseCantidadMenaje(total);
            if (!tope.cantidad) return { error: tope.error ?? "Cantidad no válida." };
            const comp = await aplicarComprobantesMenaje({
              entidadId: entidad.id,
              activoId: linea.id,
              nuevo: input,
              cambios: [],
            });
            if (comp.error) return { error: comp.error };
            const result = await updateActivo(linea.id, {
              codigo_catalogo: linea.codigo_catalogo,
              nombre: linea.nombre,
              categoria: "MENAJE",
              cantidad: tope.cantidad,
              material: linea.material ?? "",
              color: linea.color ?? "",
              medidas: linea.medidas ?? "",
              caracteristicas: linea.caracteristicas ?? "",
              estado_bien: linea.estado_bien ?? null,
              observacion: linea.observacion ?? "",
              sede_id: sedeId,
              ambiente_id: ambienteId,
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            onInventarioRefresh?.();
            return { aviso: `Se sumaron ${input.cantidad}. Total en el ambiente: ${tope.cantidad}.` };
          }}
          onQuitar={async (linea, motivo, cantidad) => {
            const result = await darDeBajaMenaje(linea.id, motivo, cantidad);
            if (!result.error) onInventarioRefresh?.();
            return { error: result.error, aviso: result.aviso };
          }}
          onEliminar={async (linea) => {
            const result = await eliminarMenaje(linea.id);
            if (!result.error) onInventarioRefresh?.();
            return { error: result.error };
          }}
        />
      ) : (
    <ActivosCampoList
      variant="ambiente"
      entidades={[entidad]}
      entidadId={entidad.id}
      activos={activosAmbiente}
      loading={loading}
      online={online}
      fixedSedeId={sedeId}
      fixedAmbienteId={ambienteId}
      esAmbientePreregistro={esAmbientePreregistro}
      headerExtra={
        esFaltante ? (
          <FaltanteBienesPanel
            entidadId={entidad.id}
            activos={activosAmbiente}
            procedenciaPorActivo={procedenciaPorActivo}
            onAbrirDestino={onAbrirAmbienteDestino}
            onChanged={onInventarioRefresh}
          />
        ) : null
      }
      leyendaVisita={visita.activa ? visita.leyenda : null}
      renderVisita={visita.activa ? visita.renderCelda : undefined}
      procedenciaPorActivo={esFaltante ? procedenciaPorActivo : undefined}
      exportMeta={exportMeta}
      reportesExport={
        !esAmbientePreregistro ? (
          <AmbienteReportesExport
            entidadId={entidad.id}
            entidadNombre={entidad.nombre}
            sedeId={sedeId}
            ambienteId={ambienteId}
            ambienteNombre={ambienteNombre}
            ambienteResponsable={ambienteResponsable}
            fichaExportMeta={fichaMeta}
            usuarioNombre={usuarioNombre}
            usuarioEmail={usuarioEmail}
            online={online}
          />
        ) : undefined
      }
      toolbarExtra={
        <Button type="button" size="sm" onClick={onRegister}>
          {esAmbientePreregistro ? "+ Preregistrar activo" : "+ Nuevo activo"}
        </Button>
      }
      onPrintLabel={onPrintLabel}
      onPrintBatch={onPrintBatch}
      onEditActivo={onEditActivo}
      onActivoUpdated={onActivoUpdated}
      onActivoDeleted={onActivoDeleted}
      onAbrirAmbienteDestino={onAbrirAmbienteDestino}
    />
      )}
    </div>
  );
}
