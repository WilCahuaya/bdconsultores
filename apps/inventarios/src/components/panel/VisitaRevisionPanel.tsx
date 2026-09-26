"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activo, EstadoBien } from "@inventario/types";
import { estadoBienLabel } from "@inventario/types";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  getRevisionVisitaAmbiente,
  registrarRevisionVisita,
  resolverBienFaltante,
  type RevisionVisitaItem,
} from "@/lib/actions/visitas-campo";
import { listAmbientesPorEntidad } from "@/lib/actions/ubicacion";

const ESTADOS: EstadoBien[] = ["BUENO", "REGULAR", "MALO"];

function etiquetaBien(activo: Activo): string {
  const codigo = activo.codigo_barras?.trim();
  return codigo ? `${activo.nombre} · ${codigo}` : activo.nombre;
}

export function VisitaRevisionPanel({
  entidadId,
  ambienteId,
  activos,
}: {
  entidadId: string;
  ambienteId: string;
  activos: Activo[];
}) {
  const router = useRouter();
  const [visitaId, setVisitaId] = useState<string | null>(null);
  const [items, setItems] = useState<RevisionVisitaItem[]>([]);
  const [listo, setListo] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoBien>("BUENO");
  const [motivo, setMotivo] = useState("");

  const registrados = activos.filter((a) => a.estado_registro === "REGISTRADO");

  async function cargar() {
    const data = await getRevisionVisitaAmbiente(ambienteId);
    setVisitaId(data?.visitaId ?? null);
    setItems(data?.items ?? []);
    setListo(true);
  }

  useEffect(() => {
    void cargar();
  }, [ambienteId]);

  if (!listo || !visitaId) return null;

  const porActivo = new Map(items.map((item) => [item.activo_id, item]));
  const pendientes = registrados.filter((a) => !porActivo.has(a.id)).length;

  async function guardar(activo: Activo, hallado: boolean, accion?: "BAJA" | "FALTANTE") {
    setPendingId(activo.id);
    setError(null);
    const result = await registrarRevisionVisita({
      entidadId,
      ambienteId,
      activoId: activo.id,
      hallado,
      estadoBien: hallado ? estado : null,
      accion: hallado ? null : accion ?? null,
      motivo: hallado ? null : motivo,
    });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAbierto(null);
    setMotivo("");
    await cargar();
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-3 p-4`}>
      <div>
        <h2 className="text-sm font-medium text-foreground">Revisión de la visita</h2>
        <p className="text-xs text-muted-foreground">
          {pendientes === 0
            ? "Todos los bienes de este ambiente quedaron revisados."
            : `Faltan ${pendientes} de ${registrados.length} bienes. Marque Sí si está, o No si no se encuentra.`}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {registrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este ambiente no tiene bienes registrados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {registrados.map((activo) => {
            const revision = porActivo.get(activo.id);
            const ocupado = pendingId === activo.id;
            return (
              <li key={activo.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm">{etiquetaBien(activo)}</span>
                {revision?.hallado ? (
                  <span className="text-xs text-muted-foreground">Hallado · {estadoBienLabel(activo.estado_bien)}</span>
                ) : null}
                {revision && !revision.hallado ? (
                  <span className="text-xs text-muted-foreground">
                    {revision.accion === "BAJA" ? "No hallado · de baja" : "No hallado · Faltante"}
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={abierto === `${activo.id}-si` ? "default" : "outline"}
                  disabled={ocupado}
                  onClick={() => {
                    setEstado(activo.estado_bien ?? "BUENO");
                    setAbierto(abierto === `${activo.id}-si` ? null : `${activo.id}-si`);
                  }}
                >
                  Sí
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={abierto === `${activo.id}-no` ? "default" : "outline"}
                  disabled={ocupado}
                  onClick={() => setAbierto(abierto === `${activo.id}-no` ? null : `${activo.id}-no`)}
                >
                  No
                </Button>
                {abierto === `${activo.id}-si` ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                      Estado
                      <select
                        className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={estado}
                        onChange={(event) => setEstado(event.target.value as EstadoBien)}
                      >
                        {ESTADOS.map((value) => (
                          <option key={value} value={value}>
                            {estadoBienLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="button" size="sm" disabled={ocupado} onClick={() => void guardar(activo, true)}>
                      {ocupado ? "Guardando…" : "Guardar estado"}
                    </Button>
                  </div>
                ) : null}
                {abierto === `${activo.id}-no` ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <input
                      className="h-8 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      placeholder="Motivo de baja si está defectuoso"
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() => void guardar(activo, false, "BAJA")}
                    >
                      Dar de baja
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() => void guardar(activo, false, "FALTANTE")}
                    >
                      Mover a Faltante
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function FaltanteBienesPanel({
  entidadId,
  ambienteId,
  activos,
}: {
  entidadId: string;
  ambienteId: string;
  activos: Activo[];
}) {
  const router = useRouter();
  const [destinos, setDestinos] = useState<{ id: string; nombre: string }[]>([]);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registrados = activos.filter((a) => a.estado_registro === "REGISTRADO");

  useEffect(() => {
    void listAmbientesPorEntidad(entidadId).then((lista) => {
      setDestinos(
        lista
          .filter((ambiente) => !ambiente.es_preregistro && !ambiente.es_faltante)
          .map((ambiente) => ({ id: ambiente.id, nombre: ambiente.nombre })),
      );
    });
  }, [entidadId]);

  async function resolver(activo: Activo, accion: "MOVER" | "BAJA") {
    setPendingId(activo.id);
    setError(null);
    const result = await resolverBienFaltante({
      entidadId,
      ambienteId,
      activoId: activo.id,
      accion,
      destinoAmbienteId: accion === "MOVER" ? destino : null,
      motivo: accion === "BAJA" ? motivo : null,
    });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMotivo("");
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-3 p-4`}>
      <div>
        <h2 className="text-sm font-medium text-foreground">Bienes no hallados</h2>
        <p className="text-xs text-muted-foreground">
          Si aparece en otro ambiente, muévalo. Si está en estado Malo, puede darlo de baja.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {registrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay bienes en Faltante.</p>
      ) : (
        <ul className="divide-y divide-border">
          {registrados.map((activo) => {
            const ocupado = pendingId === activo.id;
            const defectuoso = activo.estado_bien === "MALO";
            return (
              <li key={activo.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  {etiquetaBien(activo)}
                  <span className="ml-2 text-xs text-muted-foreground">{estadoBienLabel(activo.estado_bien)}</span>
                </span>
                <select
                  className="h-8 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm"
                  value={destino}
                  onChange={(event) => setDestino(event.target.value)}
                >
                  <option value="">Ambiente destino</option>
                  {destinos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={ocupado || !destino}
                  onClick={() => void resolver(activo, "MOVER")}
                >
                  Mover
                </Button>
                <input
                  className="h-8 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
                  placeholder="Motivo de baja"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  disabled={!defectuoso}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={ocupado || !defectuoso || !motivo.trim()}
                  onClick={() => void resolver(activo, "BAJA")}
                >
                  Dar de baja
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
