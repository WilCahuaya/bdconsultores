"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogoNacional, EstadoBien } from "@inventario/types";
import {
  claveVarianteMenaje,
  estadoBienLabel,
  formatFechaISOToDDMMYYYY,
  parseCantidadMenaje,
  textoMenaje,
} from "@inventario/types";
import { CatalogoPicker } from "./catalogo-picker";
import { Button, Input, Label, Textarea } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import { Select } from "./select";
import { Sheet } from "./sheet";

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

  const totalBajas = bajasOrdenadas.reduce((sum, baja) => sum + (baja.cantidad ?? 1), 0);
  const bajasVisibles = hojaBajas?.clave
    ? (bajaPorClave.get(hojaBajas.clave)?.items ?? [])
    : bajasOrdenadas;
  const tituloHoja =
    hojaBajas?.clave && bajasVisibles[0] ? bajasVisibles[0].nombre : "Dados de baja";

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
    setMensaje(
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={guardando}
              onClick={() => setHojaBajas({ clave: null })}
            >
              Bajas{totalBajas > 0 ? ` (${totalBajas})` : ""}
            </Button>
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
              ? "No quedan existencias. Las unidades dadas de baja están en Bajas."
              : "Este ambiente no tiene menaje."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Código</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Nombre</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Cantidad</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">De baja</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Material</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Medida</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Color</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Características</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Estado</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">Observación</th>
                  <th className="px-3 py-2 font-medium" />
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
                  return (
                    <tr key={linea.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        {linea.codigo_catalogo}
                      </td>
                      <td className="px-3 py-2">{linea.nombre}</td>
                      <td className="px-3 py-2">{linea.cantidad ?? 1}</td>
                      <td className="px-3 py-2">
                        {deBaja > 0 ? (
                          <button
                            type="button"
                            className="font-medium underline-offset-2 hover:underline"
                            aria-label={`Ver ${deBaja} dados de baja de ${linea.nombre}`}
                            onClick={() => setHojaBajas({ clave: claveLinea(linea) })}
                          >
                            {deBaja}
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
                        {linea.estado_bien ? estadoBienLabel(linea.estado_bien) : "—"}
                      </td>
                      <td className="px-3 py-2">{linea.observacion?.trim() || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={guardando}
                            onClick={() => {
                              setEditandoId(linea.id);
                              setEdicion(formDesdeLinea(linea));
                              setError(null);
                              setMensaje(null);
                            }}
                          >
                            Editar
                          </Button>
                          {onQuitar ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={guardando}
                              onClick={() => setBajaLinea(linea)}
                            >
                              Dar de baja
                            </Button>
                          ) : null}
                          {onEliminar ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={guardando}
                              onClick={() => {
                                setErrorEliminar(null);
                                setEliminarLinea(linea);
                              }}
                            >
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          setEliminarLinea(null);
        }}
        title="Eliminar menaje"
        description={
          eliminarLinea
            ? `Se borrará «${eliminarLinea.nombre}» (${eliminarLinea.cantidad ?? 1}) de este ambiente. No queda como baja y no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={guardando}
        error={errorEliminar}
        onConfirm={() => void confirmarEliminar()}
      />

      <Sheet
        open={hojaBajas != null}
        onClose={() => setHojaBajas(null)}
        title={tituloHoja}
        subtitle={
          bajasVisibles.length > 0
            ? `${bajasVisibles.reduce((sum, baja) => sum + (baja.cantidad ?? 1), 0)} unidades`
            : undefined
        }
      >
        {bajasVisibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este ambiente no tiene menajes dados de baja.</p>
        ) : (
          <ul className="divide-y divide-border">
            {bajasVisibles.map((baja) => {
              const detalle = resumenLinea(baja);
              const fecha = formatFechaISOToDDMMYYYY(baja.updated_at?.slice(0, 10));
              return (
                <li key={baja.id} className="space-y-1 py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{baja.nombre}</p>
                    <p className="shrink-0 tabular-nums">{baja.cantidad ?? 1}</p>
                  </div>
                  {detalle ? <p className="text-xs text-muted-foreground">{detalle}</p> : null}
                  <p className="text-sm">{baja.motivo_baja?.trim() || "Sin motivo"}</p>
                  {fecha ? <p className="text-xs text-muted-foreground">{fecha}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
