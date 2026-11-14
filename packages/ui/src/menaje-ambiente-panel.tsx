"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogoNacional, EstadoBien } from "@inventario/types";
import {
  claveVarianteMenaje,
  formatFechaISOToDDMMYYYY,
  parseCantidadMenaje,
  textoMenaje,
} from "@inventario/types";
import { CatalogoPicker } from "./catalogo-picker";
import { Button, Input, Label, Textarea } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import { EstadoBienBadge } from "./inventario-table-cells";
import { DeleteIcon, PanelIconAction } from "./panel-action-buttons";
import { EditIcon } from "./panel";
import { PanelViewToggle, useStoredViewMode } from "./panel-view-toggle";
import { Select } from "./select";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

const MENAJE_STICKY_CODIGO =
  "sticky left-0 z-20 w-[8.75rem] min-w-[8.75rem] max-w-[8.75rem] bg-card";
const MENAJE_STICKY_NOMBRE =
  "sticky left-[8.75rem] z-10 w-[14rem] min-w-[14rem] max-w-[14rem] bg-card shadow-[2px_0_0_0_hsl(var(--border)/0.55)]";

export interface MenajeLinea {
  id: string;
  codigo_catalogo: string;
  nombre: string;
  cantidad?: number | null;
  material?: string | null;
  color?: string | null;
  medidas?: string | null;
  caracteristicas?: string | null;
  estado_bien?: EstadoBien | null;
  observacion?: string | null;
}

export interface MenajeBaja extends MenajeLinea {
  motivo_baja?: string | null;
  updated_at?: string | null;
  /** Nombre del usuario que registró la baja. */
  actualizado_por_nombre?: string | null;
}

export interface MenajeGuardadoInput {
  codigo: string;
  nombre: string;
  cantidad: number;
  material: string;
  color: string;
  medidas: string;
  caracteristicas: string;
  estado_bien: EstadoBien | null;
  observacion: string;
}

interface MenajeAmbientePanelProps {
  lineas: MenajeLinea[];
  bajas?: MenajeBaja[];
  searchCatalogo: (query: string, limit?: number) => Promise<CatalogoNacional[]>;
  resolveCodigo?: (codigo: string) => Promise<CatalogoNacional | null>;
  onAgregar: (input: MenajeGuardadoInput) => Promise<{ error?: string; aviso?: string }>;
  onGuardar: (
    linea: MenajeLinea,
    input: MenajeGuardadoInput,
  ) => Promise<{ error?: string; aviso?: string }>;
  onQuitar?: (linea: MenajeLinea, motivo: string, cantidad: number) => Promise<{ error?: string; aviso?: string }>;
  onEliminar?: (linea: MenajeLinea) => Promise<{ error?: string }>;
}

interface MenajeFormValues {
  cantidad: string;
  material: string;
  medidas: string;
  color: string;
  caracteristicas: string;
  estadoBien: string;
  observacion: string;
}

const FORM_VACIO: MenajeFormValues = {
  cantidad: "1",
  material: "",
  medidas: "",
  color: "",
  caracteristicas: "",
  estadoBien: "",
  observacion: "",
};

const ESTADO_OPCIONES = [
  { value: "", label: "Sin especificar" },
  { value: "BUENO", label: "Bueno" },
  { value: "REGULAR", label: "Regular" },
  { value: "MALO", label: "Malo" },
];

function formDesdeLinea(linea: MenajeLinea): MenajeFormValues {
  return {
    cantidad: String(linea.cantidad ?? 1),
    material: linea.material ?? "",
    medidas: linea.medidas ?? "",
    color: linea.color ?? "",
    caracteristicas: linea.caracteristicas ?? "",
    estadoBien: linea.estado_bien ?? "",
    observacion: linea.observacion ?? "",
  };
}

function claveLinea(linea: MenajeLinea): string {
  return `${linea.codigo_catalogo}\u0000${claveVarianteMenaje(linea)}`;
}

function resumenLinea(linea: MenajeLinea): string {
  return [linea.material, linea.medidas, linea.color]
    .map((parte) => textoMenaje(parte))
    .filter((parte): parte is string => Boolean(parte))
    .join(" · ");
}

function IconoBaja({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 11.25L12 15.75m0 0l4.5-4.5M12 15.75V3"
      />
    </svg>
  );
}

function MenajeAcciones({
  nombre,
  disabled,
  onEditar,
  onBaja,
  onEliminar,
}: {
  nombre: string;
  disabled: boolean;
  onEditar: () => void;
  onBaja?: () => void;
  onEliminar?: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <PanelIconAction label={`Editar ${nombre}`} disabled={disabled} onClick={onEditar}>
        <EditIcon />
      </PanelIconAction>
      {onBaja ? (
        <PanelIconAction label={`Dar de baja ${nombre}`} disabled={disabled} onClick={onBaja}>
          <IconoBaja />
        </PanelIconAction>
      ) : null}
      {onEliminar ? (
        <PanelIconAction label={`Eliminar ${nombre}`} variant="danger" disabled={disabled} onClick={onEliminar}>
          <DeleteIcon />
        </PanelIconAction>
      ) : null}
    </div>
  );
}

function IconoVista({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MenajeCampos({
  values,
  onChange,
  disabled,
  idPrefix,
}: {
  values: MenajeFormValues;
  onChange: (values: MenajeFormValues) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  function patch(partial: Partial<MenajeFormValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cantidad`}>Cantidad</Label>
        <Input
          id={`${idPrefix}-cantidad`}
          inputMode="numeric"
          value={values.cantidad}
          disabled={disabled}
          onChange={(event) => patch({ cantidad: event.target.value.replace(/\D/g, "") })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-material`}>Material</Label>
        <Input
          id={`${idPrefix}-material`}
          value={values.material}
          disabled={disabled}
          placeholder="Acero, loza, melamina…"
          onChange={(event) => patch({ material: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-medidas`}>Medida o capacidad</Label>
        <Input
          id={`${idPrefix}-medidas`}
          value={values.medidas}
          disabled={disabled}
          placeholder="20 L, 28 cm, 250 ml"
          onChange={(event) => patch({ medidas: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-color`}>Color</Label>
        <Input
          id={`${idPrefix}-color`}
          value={values.color}
          disabled={disabled}
          placeholder="Blanco, azul…"
          onChange={(event) => patch({ color: event.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-caracteristicas`}>Características</Label>
        <Input
          id={`${idPrefix}-caracteristicas`}
          value={values.caracteristicas}
          disabled={disabled}
          placeholder="Con tapa, antiadherente, juego de 6…"
          onChange={(event) => patch({ caracteristicas: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-estado`}>Estado</Label>
        <Select
          id={`${idPrefix}-estado`}
          value={values.estadoBien}
          disabled={disabled}
          options={ESTADO_OPCIONES}
          onChange={(value) => patch({ estadoBien: value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <Label htmlFor={`${idPrefix}-observacion`}>Observación</Label>
        <Textarea
          id={`${idPrefix}-observacion`}
          className="min-h-[68px]"
          value={values.observacion}
          disabled={disabled}
          placeholder="Nota del conteo: faltantes, rotos, incidencias…"
          onChange={(event) => patch({ observacion: event.target.value })}
        />
      </div>
    </div>
  );
}

export function AmbienteApartadoNav({
  value,
  onChange,
  menajeCount,
  className = "flex gap-5 border-b border-border/70",
}: {
  value: "bienes" | "menaje";
  onChange: (value: "bienes" | "menaje") => void;
  menajeCount: number;
  className?: string;
}) {
  const tabs = [
    { id: "bienes" as const, label: "Bienes" },
    {
      id: "menaje" as const,
      label: menajeCount > 0 ? `Menaje (${menajeCount})` : "Menaje",
    },
  ];
  return (
    <div className={className} role="tablist" aria-label="Apartados del ambiente">
      {tabs.map((tab) => {
        const activo = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activo}
            className={`-mb-px border-b-2 pb-1.5 text-sm font-medium transition-colors ${
              activo
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function valoresAGuardado(
  codigo: string,
  nombre: string,
  values: MenajeFormValues,
): { error?: string; input?: MenajeGuardadoInput } {
  const parsed = parseCantidadMenaje(values.cantidad);
  if (!parsed.cantidad) {
    return { error: parsed.error ?? "Cantidad no válida." };
  }
  const estado = values.estadoBien;
  return {
    input: {
      codigo,
      nombre,
      cantidad: parsed.cantidad,
      material: values.material.trim(),
      color: values.color.trim(),
      medidas: values.medidas.trim(),
      caracteristicas: values.caracteristicas.trim(),
      estado_bien:
        estado === "BUENO" || estado === "REGULAR" || estado === "MALO" ? estado : null,
      observacion: values.observacion.trim(),
    },
  };
}

export function MenajeAmbientePanel({
  lineas,
  bajas = [],
  searchCatalogo,
  resolveCodigo,
  onAgregar,
  onGuardar,
  onQuitar,
  onEliminar,
}: MenajeAmbientePanelProps) {
  const { pushToast } = useToast();
  const [viewMode, setViewMode] = useStoredViewMode("inventario-view-menaje", "list");
  const [catalogo, setCatalogo] = useState<CatalogoNacional | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [alta, setAlta] = useState<MenajeFormValues>(FORM_VACIO);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<MenajeFormValues>(FORM_VACIO);
  const [bajaLinea, setBajaLinea] = useState<MenajeLinea | null>(null);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [cantidadBaja, setCantidadBaja] = useState("");
  const [errorBaja, setErrorBaja] = useState<string | null>(null);
  const [eliminarLinea, setEliminarLinea] = useState<MenajeLinea | null>(null);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [hojaBajas, setHojaBajas] = useState<{ clave: string | null } | null>(null);

  const ordenadas = useMemo(
    () =>
      [...lineas].sort((a, b) => {
        const porNombre = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
        if (porNombre !== 0) return porNombre;
        return resumenLinea(a).localeCompare(resumenLinea(b), "es", { sensitivity: "base" });
      }),
    [lineas],
  );

  const totalUnidades = ordenadas.reduce((sum, linea) => sum + (linea.cantidad ?? 0), 0);

  const bajasOrdenadas = useMemo(
    () =>
      [...bajas].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    [bajas],
  );

  const bajaPorClave = useMemo(() => {
    const map = new Map<string, { total: number; items: MenajeBaja[] }>();
    for (const baja of bajasOrdenadas) {
      const clave = claveLinea(baja);
      const actual = map.get(clave) ?? { total: 0, items: [] };
      actual.total += baja.cantidad ?? 1;
      actual.items.push(baja);
      map.set(clave, actual);
    }
    return map;
  }, [bajasOrdenadas]);

  const claveHoja = hojaBajas?.clave ?? null;
  const bajasVisibles = claveHoja
    ? (bajaPorClave.get(claveHoja)?.items ?? [])
    : bajasOrdenadas;
  const tituloHoja = claveHoja && bajasVisibles[0] ? bajasVisibles[0].nombre : "Bajas";
  const unidadesHoja = bajasVisibles.reduce((sum, baja) => sum + (baja.cantidad ?? 1), 0);
  const existenciaHoja = claveHoja
    ? (ordenadas.find((linea) => claveLinea(linea) === claveHoja)?.cantidad ?? 0)
    : 0;
  const subtituloHoja = claveHoja
    ? unidadesHoja > 0
      ? `${unidadesHoja} de ${unidadesHoja + existenciaHoja}`
      : undefined
    : unidadesHoja > 0
      ? `${unidadesHoja} unidades`
      : undefined;

  async function handleAgregar() {
    setMensaje(null);
    setError(null);
    if (!catalogo?.codigo || !catalogo.denominacion?.trim()) {
      setError("Elija un código del catálogo.");
      return;
    }
    const parsed = valoresAGuardado(catalogo.codigo, catalogo.denominacion.trim(), alta);
    if (!parsed.input) {
      setError(parsed.error ?? "Cantidad no válida.");
      return;
    }
    setGuardando(true);
    const result = await onAgregar(parsed.input);
    setGuardando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCatalogo(null);
    setAlta(FORM_VACIO);
    setAltaAbierta(false);
    setMensaje(null);
    pushToast(
      result.aviso ??
        `Menaje registrado: ${parsed.input.nombre} · ${parsed.input.codigo} · cantidad ${parsed.input.cantidad}.`,
    );
  }

  async function handleGuardar(linea: MenajeLinea) {
    setMensaje(null);
    setError(null);
    const parsed = valoresAGuardado(linea.codigo_catalogo, linea.nombre, edicion);
    if (!parsed.input) {
      setError(parsed.error ?? "Cantidad no válida.");
      return;
    }
    setGuardando(true);
    const result = await onGuardar(linea, parsed.input);
    setGuardando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditandoId(null);
    setMensaje(result.aviso ?? `${linea.nombre}: cantidad ${parsed.input.cantidad}.`);
  }

  useEffect(() => {
    if (!bajaLinea) return;
    setMotivoBaja("");
    setCantidadBaja(String(bajaLinea.cantidad ?? 1));
    setErrorBaja(null);
  }, [bajaLinea]);

  useEffect(() => {
    if (!eliminarLinea) return;
    setConfirmacionEliminar("");
    setErrorEliminar(null);
  }, [eliminarLinea]);

  async function confirmarBaja() {
    if (!onQuitar || !bajaLinea) return;
    const motivo = motivoBaja.trim();
    if (!motivo) {
      setErrorBaja("Indique el motivo de baja.");
      return;
    }
    const pedida = parseCantidadMenaje(cantidadBaja);
    if (!pedida.cantidad) {
      setErrorBaja(pedida.error ?? "La cantidad no es válida.");
      return;
    }
    const disponible = bajaLinea.cantidad ?? 1;
    if (pedida.cantidad > disponible) {
      setErrorBaja(`Solo hay ${disponible} en este ambiente.`);
      return;
    }
    setGuardando(true);
    setErrorBaja(null);
    const result = await onQuitar(bajaLinea, motivo, pedida.cantidad);
    setGuardando(false);
    if (result.error) {
      setErrorBaja(result.error);
      return;
    }
    setMensaje(result.aviso ?? `${bajaLinea.nombre} quedó dado de baja.`);
    setBajaLinea(null);
  }

  async function confirmarEliminar() {
    if (!onEliminar || !eliminarLinea) return;
    setGuardando(true);
    setErrorEliminar(null);
    const result = await onEliminar(eliminarLinea);
    setGuardando(false);
    if (result.error) {
      setErrorEliminar(result.error);
      return;
    }
    setMensaje(`${eliminarLinea.nombre} se eliminó.`);
    setConfirmacionEliminar("");
    setEliminarLinea(null);
  }

  function cerrarAlta() {
    setAltaAbierta(false);
    setCatalogo(null);
    setAlta(FORM_VACIO);
    setError(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-1">
      {altaAbierta ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Agregar menaje</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Una fila por código, material, medida, color y características. Si esa misma variante ya
            está en el ambiente, la cantidad se suma. El estado y la observación no crean otra fila.
          </p>
          <div className="mt-3 space-y-3">
            <CatalogoPicker
              variant="ambos"
              searchCatalogo={searchCatalogo}
              resolveCodigo={resolveCodigo}
              selectedCodigo={catalogo?.codigo}
              selectedDenominacion={catalogo?.denominacion}
              onSelect={setCatalogo}
              onClear={() => setCatalogo(null)}
              disabled={guardando}
            />
            <MenajeCampos
              idPrefix="menaje-alta"
              values={alta}
              disabled={guardando}
              onChange={setAlta}
            />
            <div className="flex gap-2">
              <Button type="button" disabled={guardando} onClick={() => void handleAgregar()}>
                Guardar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={cerrarAlta}
              >
                Cancelar
              </Button>
            </div>
          </div>
          {error && !editandoId ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold">Existencias</h2>
            <p className="text-xs text-muted-foreground">
              {ordenadas.length} {ordenadas.length === 1 ? "línea" : "líneas"} · {totalUnidades}{" "}
              unidades
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PanelViewToggle value={viewMode} onChange={setViewMode} listLabel="Tabla" />
            {altaAbierta ? null : (
              <Button
                type="button"
                size="sm"
                disabled={guardando}
                onClick={() => {
                  setEditandoId(null);
                  setError(null);
                  setMensaje(null);
                  setAltaAbierta(true);
                }}
              >
                Agregar menaje
              </Button>
            )}
          </div>
        </div>
        {mensaje ? <p className="px-4 pt-3 text-sm text-muted-foreground">{mensaje}</p> : null}
        {ordenadas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {bajasOrdenadas.length > 0
              ? "No quedan existencias."
              : "Este ambiente no tiene menaje."}
          </p>
        ) : (
          viewMode === "cards" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {ordenadas.map((linea) => {
              const editando = editandoId === linea.id;
              const deBaja = bajaPorClave.get(claveLinea(linea))?.total ?? 0;
              const totalLinea = (linea.cantidad ?? 0) + deBaja;
              if (editando) {
                return (
                  <article key={linea.id} className="rounded-lg border border-border bg-muted/15 p-3 sm:col-span-2 xl:col-span-3">
                    <p className="mb-2 text-sm font-medium">
                      {linea.nombre}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {linea.codigo_catalogo}
                      </span>
                    </p>
                    <MenajeCampos
                      idPrefix={`menaje-card-${linea.id}`}
                      values={edicion}
                      disabled={guardando}
                      onChange={setEdicion}
                    />
                    {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
                    <div className="mt-3 flex justify-end gap-1">
                      <Button type="button" size="sm" disabled={guardando} onClick={() => void handleGuardar(linea)}>
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={guardando} onClick={() => setEditandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </article>
                );
              }
              return (
                <article key={linea.id} className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/15 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{linea.nombre}</p>
                      <p className="font-mono text-xs text-muted-foreground">{linea.codigo_catalogo}</p>
                    </div>
                    <EstadoBienBadge estado={linea.estado_bien} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Cantidad</dt>
                      <dd className="tabular-nums">{linea.cantidad ?? 1}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Bajas</dt>
                      <dd>
                        {deBaja > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md tabular-nums text-foreground hover:bg-muted"
                            aria-label={`Ver bajas de ${linea.nombre}: ${deBaja} de ${totalLinea}`}
                            onClick={() => setHojaBajas({ clave: claveLinea(linea) })}
                          >
                            {deBaja} de {totalLinea}
                            <IconoVista className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Material</dt>
                      <dd>{linea.material?.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Medida</dt>
                      <dd>{linea.medidas?.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Color</dt>
                      <dd>{linea.color?.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Características</dt>
                      <dd>{linea.caracteristicas?.trim() || "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Observación</dt>
                      <dd>{linea.observacion?.trim() || "—"}</dd>
                    </div>
                  </dl>
                  <MenajeAcciones
                    nombre={linea.nombre}
                    disabled={guardando}
                    onEditar={() => {
                      setEditandoId(linea.id);
                      setEdicion(formDesdeLinea(linea));
                      setError(null);
                      setMensaje(null);
                    }}
                    onBaja={onQuitar ? () => setBajaLinea(linea) : undefined}
                    onEliminar={
                      onEliminar
                        ? () => {
                            setErrorEliminar(null);
                            setEliminarLinea(linea);
                          }
                        : undefined
                    }
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] border-separate border-spacing-0 text-sm [&_td]:border-b [&_td]:border-border/70 [&_th]:border-b [&_th]:border-border">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className={`whitespace-nowrap px-3 py-2 font-medium ${MENAJE_STICKY_CODIGO}`}>Código</th>
                  <th className={`px-3 py-2 font-medium ${MENAJE_STICKY_NOMBRE}`}>Nombre</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Cantidad</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Bajas</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Material</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Medida</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Color</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Características</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Estado</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Observación</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((linea) => {
                  const editando = editandoId === linea.id;
                  if (editando) {
                    return (
                      <tr key={linea.id} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-3" colSpan={11}>
                          <p className="mb-2 text-sm font-medium">
                            {linea.nombre}{" "}
                            <span className="font-mono text-xs text-muted-foreground">
                              {linea.codigo_catalogo}
                            </span>
                          </p>
                          <MenajeCampos
                            idPrefix={`menaje-${linea.id}`}
                            values={edicion}
                            disabled={guardando}
                            onChange={setEdicion}
                          />
                          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
                          <div className="mt-3 flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              disabled={guardando}
                              onClick={() => void handleGuardar(linea)}
                            >
                              Guardar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={guardando}
                              onClick={() => setEditandoId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const deBaja = bajaPorClave.get(claveLinea(linea))?.total ?? 0;
                  const totalLinea = (linea.cantidad ?? 0) + deBaja;
                  return (
                    <tr key={linea.id} className="border-b border-border/70 align-top last:border-0">
                      <td className={`whitespace-nowrap px-3 py-2 font-mono text-xs ${MENAJE_STICKY_CODIGO}`}>
                        {linea.codigo_catalogo}
                      </td>
                      <td className={`px-3 py-2 ${MENAJE_STICKY_NOMBRE}`}>{linea.nombre}</td>
                      <td className="px-3 py-2">{linea.cantidad ?? 1}</td>
                      <td className="px-3 py-2">
                        {deBaja > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 tabular-nums text-foreground hover:bg-muted"
                            aria-label={`Ver bajas de ${linea.nombre}: ${deBaja} de ${totalLinea}`}
                            onClick={() => setHojaBajas({ clave: claveLinea(linea) })}
                          >
                            {deBaja} de {totalLinea}
                            <IconoVista className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">{linea.material?.trim() || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{linea.medidas?.trim() || "—"}</td>
                      <td className="px-3 py-2">{linea.color?.trim() || "—"}</td>
                      <td className="px-3 py-2">{linea.caracteristicas?.trim() || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <EstadoBienBadge estado={linea.estado_bien} />
                      </td>
                      <td className="px-3 py-2">{linea.observacion?.trim() || "—"}</td>
                      <td className="px-3 py-2">
                        <MenajeAcciones
                          nombre={linea.nombre}
                          disabled={guardando}
                          onEditar={() => {
                            setEditandoId(linea.id);
                            setEdicion(formDesdeLinea(linea));
                            setError(null);
                            setMensaje(null);
                          }}
                          onBaja={onQuitar ? () => setBajaLinea(linea) : undefined}
                          onEliminar={
                            onEliminar
                              ? () => {
                                  setErrorEliminar(null);
                                  setEliminarLinea(linea);
                                }
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={bajaLinea != null}
        onClose={() => {
          if (guardando) return;
          setBajaLinea(null);
        }}
        title="Dar de baja"
        description={
          bajaLinea
            ? `Indique cuántas unidades de «${bajaLinea.nombre}» salen. El resto sigue en el ambiente.`
            : undefined
        }
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={guardando}
        error={errorBaja}
        confirmDisabled={!motivoBaja.trim() || !cantidadBaja}
        onConfirm={() => void confirmarBaja()}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cantidad_baja_menaje">Cantidad a dar de baja</Label>
            <Input
              id="cantidad_baja_menaje"
              inputMode="numeric"
              value={cantidadBaja}
              onChange={(event) => {
                setCantidadBaja(event.target.value.replace(/\D/g, ""));
                if (errorBaja) setErrorBaja(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Hay {bajaLinea?.cantidad ?? 1} en este ambiente. Puede dar de baja solo una parte.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo_baja_menaje">Motivo de baja</Label>
            <Textarea
              id="motivo_baja_menaje"
              className="min-h-[88px]"
              value={motivoBaja}
              onChange={(event) => {
                setMotivoBaja(event.target.value);
                if (errorBaja) setErrorBaja(null);
              }}
              placeholder="Ej. Obsoleto, deterioro irreparable, venta…"
            />
            <p className="text-xs text-muted-foreground">
              Campo obligatorio. Quedará registrado en el historial.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={eliminarLinea != null}
        onClose={() => {
          if (guardando) return;
          setConfirmacionEliminar("");
          setEliminarLinea(null);
        }}
        title="Eliminar menaje"
        description={
          eliminarLinea
            ? `¿Está seguro de eliminar «${eliminarLinea.nombre}» (${eliminarLinea.cantidad ?? 1}) de este ambiente? No queda como baja y no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={guardando}
        error={errorEliminar}
        confirmDisabled={confirmacionEliminar.trim().toLowerCase() !== "eliminar"}
        onConfirm={() => void confirmarEliminar()}
      >
        <div className="space-y-2">
          <Label htmlFor="confirmar_eliminar_menaje">
            Escriba <strong>eliminar</strong> para confirmar
          </Label>
          <Input
            id="confirmar_eliminar_menaje"
            value={confirmacionEliminar}
            onChange={(event) => setConfirmacionEliminar(event.target.value)}
            placeholder="eliminar"
            autoComplete="off"
            spellCheck={false}
            disabled={guardando}
          />
        </div>
      </ConfirmDialog>

      <Sheet
        open={hojaBajas != null}
        onClose={() => setHojaBajas(null)}
        title={tituloHoja}
        subtitle={subtituloHoja}
        wide
      >
        {bajasVisibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este ambiente no tiene menajes dados de baja.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  {claveHoja ? null : (
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Menaje</th>
                  )}
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Cantidad</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Fecha de baja</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Motivo</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {bajasVisibles.map((baja) => {
                  const fecha = formatFechaISOToDDMMYYYY(baja.updated_at?.slice(0, 10));
                  const detalle = resumenLinea(baja);
                  return (
                    <tr key={baja.id} className="border-b border-border/70 align-top last:border-0">
                      {claveHoja ? null : (
                        <td className="px-2 py-2">
                          <p>{baja.nombre}</p>
                          {detalle ? (
                            <p className="text-xs text-muted-foreground">{detalle}</p>
                          ) : null}
                        </td>
                      )}
                      <td className="px-2 py-2 tabular-nums">{baja.cantidad ?? 1}</td>
                      <td className="whitespace-nowrap px-2 py-2">{fecha || "—"}</td>
                      <td className="px-2 py-2">{baja.motivo_baja?.trim() || "—"}</td>
                      <td className="px-2 py-2">{baja.actualizado_por_nombre?.trim() || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </div>
  );
}
