import { useEffect, useMemo, useState } from "react";
import { listAmbientesPorEntidad } from "../lib/ubicacion";
import type { Entidad } from "@inventario/types";
import { Button } from "@inventario/ui";
import type { ActivoConUbicacion } from "../lib/activos";
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
    () => activos.filter((a) => a.ambiente_id === ambienteId),
    [activos, ambienteId],
  );
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

  return (
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
  );
}
