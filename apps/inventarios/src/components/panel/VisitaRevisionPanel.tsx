"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

function botonVisitaClass(activo: boolean, tono: "si" | "no"): string {
  const marcado =
    tono === "si"
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-rose-600 bg-rose-600 text-white";
  const libre = "border-input bg-background text-foreground hover:bg-accent";
  return `inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded border px-1 text-[10px] font-semibold leading-none disabled:opacity-50 ${activo ? marcado : libre}`;
}

type AnclaMenu = { top: number; left: number; arriba: boolean };

export function useVisitaRevision({
  entidadId,
  ambienteId,
  activos,
  enabled,
}: {
  entidadId: string;
  ambienteId: string;
  activos: Activo[];
  enabled: boolean;
}): {
  activa: boolean;
  leyenda: ReactNode;
  renderCelda: (activo: Activo) => ReactNode;
} {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const abiertoEn = useRef(0);
  const [visitaId, setVisitaId] = useState<string | null>(null);
  const [items, setItems] = useState<RevisionVisitaItem[]>([]);
  const [listo, setListo] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ancla, setAncla] = useState<AnclaMenu | null>(null);
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
    let cancel = false;
    setListo(false);
    setAbierto(null);
    setAncla(null);
    if (!enabled) {
      setVisitaId(null);
      setItems([]);
      setListo(true);
      return;
    }
    void getRevisionVisitaAmbiente(ambienteId).then((data) => {
      if (cancel) return;
      setVisitaId(data?.visitaId ?? null);
      setItems(data?.items ?? []);
      setListo(true);
    });
    return () => {
      cancel = true;
    };
  }, [ambienteId, enabled]);

  useEffect(() => {
    if (!abierto) return;
    function cerrar(event: Event) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-visita-toggle]")) return;
      setAbierto(null);
      setAncla(null);
    }
    function cerrarPorScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      if (Date.now() - abiertoEn.current < 250) return;
      setAbierto(null);
      setAncla(null);
    }
    document.addEventListener("mousedown", cerrar);
    window.addEventListener("resize", cerrarPorScroll);
    window.addEventListener("scroll", cerrarPorScroll, true);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      window.removeEventListener("resize", cerrarPorScroll);
      window.removeEventListener("scroll", cerrarPorScroll, true);
    };
  }, [abierto]);

  const activa = enabled && listo && Boolean(visitaId);
  const porActivo = new Map(items.map((item) => [item.activo_id, item]));
  const pendientes = registrados.filter((a) => !porActivo.has(a.id)).length;
  const abiertoId = abierto?.replace(/-(si|no)$/, "") ?? null;
  const abiertoTipo = abierto?.endsWith("-no") ? "no" : abierto?.endsWith("-si") ? "si" : null;
  const abiertoActivo = registrados.find((activo) => activo.id === abiertoId) ?? null;

  function cerrarMenu() {
    setAbierto(null);
    setAncla(null);
  }

  function abrirMenu(activo: Activo, tipo: "si" | "no", button: HTMLButtonElement) {
    const key = `${activo.id}-${tipo}`;
    if (abierto === key) {
      cerrarMenu();
      return;
    }
    if (tipo === "si") setEstado(activo.estado_bien ?? "BUENO");
    const rect = button.getBoundingClientRect();
    const arriba = window.innerHeight - rect.bottom < 210;
    setAncla({
      top: arriba ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
      arriba,
    });
    abiertoEn.current = Date.now();
    setAbierto(key);
  }

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
    cerrarMenu();
    setMotivo("");
    await cargar();
    router.refresh();
  }

  function renderCelda(activo: Activo): ReactNode {
    if (activo.estado_registro !== "REGISTRADO") {
      return <span className="text-muted-foreground">—</span>;
    }
    const revision = porActivo.get(activo.id);
    const ocupado = pendingId === activo.id;
    const siMarcado = revision?.hallado === true || abierto === `${activo.id}-si`;
    const noMarcado = Boolean(revision && !revision.hallado) || abierto === `${activo.id}-no`;
    const titulo = revision?.hallado
      ? `Hallado · ${estadoBienLabel(activo.estado_bien)}`
      : revision
        ? revision.accion === "BAJA"
          ? "No hallado · de baja"
          : "No hallado · Faltante"
        : "Marque Sí si está, o No si no se encuentra";
    return (
      <div className="inline-flex items-center justify-center gap-0.5" data-visita-toggle title={titulo}>
        <button
          type="button"
          className={botonVisitaClass(siMarcado, "si")}
          disabled={ocupado}
          aria-pressed={siMarcado}
          aria-label={`Sí, ${activo.nombre} está`}
          onClick={(event) => abrirMenu(activo, "si", event.currentTarget)}
        >
          Sí
        </button>
        <button
          type="button"
          className={botonVisitaClass(noMarcado, "no")}
          disabled={ocupado}
          aria-pressed={noMarcado}
          aria-label={`No, ${activo.nombre} no se encuentra`}
          onClick={(event) => abrirMenu(activo, "no", event.currentTarget)}
        >
          No
        </button>
      </div>
    );
  }

  const menu =
    activa && abiertoActivo && ancla && abiertoTipo && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] w-[18rem] rounded-md border border-border bg-card p-2 text-left shadow-md"
            style={{
              top: ancla.top,
              left: ancla.left,
              transform: ancla.arriba ? "translateY(-100%)" : undefined,
            }}
          >
            <p className="mb-2 truncate text-xs font-medium text-foreground">{etiquetaBien(abiertoActivo)}</p>
            {abiertoTipo === "si" ? (
              <div className="flex flex-wrap items-center gap-2">
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
                <Button
                  type="button"
                  size="sm"
                  disabled={pendingId === abiertoActivo.id}
                  onClick={() => void guardar(abiertoActivo, true)}
                >
                  {pendingId === abiertoActivo.id ? "Guardando…" : "Guardar estado"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  placeholder="Motivo de baja si está defectuoso"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === abiertoActivo.id}
                    onClick={() => void guardar(abiertoActivo, false, "BAJA")}
                  >
                    Dar de baja
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === abiertoActivo.id}
                    onClick={() => void guardar(abiertoActivo, false, "FALTANTE")}
                  >
                    Mover a Faltante
                  </Button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  const leyenda = activa ? (
    <>
      <div className="panel-inventario-visita-leyenda border-b border-border/50 bg-muted/30 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {registrados.length === 0
              ? "Este ambiente no tiene bienes registrados."
              : pendientes === 0
                ? "Todos los bienes quedaron revisados."
                : `Faltan ${pendientes} de ${registrados.length}.`}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-4 items-center rounded border border-emerald-600 bg-emerald-600 px-1 text-[10px] font-semibold leading-none text-white">
              Sí
            </span>
            está en el ambiente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-4 items-center rounded border border-rose-600 bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
              No
            </span>
            no se encuentra
          </span>
        </div>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      {menu}
    </>
  ) : null;

  return { activa, leyenda, renderCelda };
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
