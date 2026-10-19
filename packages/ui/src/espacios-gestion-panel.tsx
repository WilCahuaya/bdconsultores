"use client";

import { useEffect, useMemo, useState } from "react";
import type { Edificio, EspacioConOcupacion, Piso, UbicacionEspacioInput } from "@inventario/types";
import {
  espacioRepetidoEnSucursal,
  mensajeEspacioRepetido,
  nombreEspacioDesdeNumero,
  numeroEspacioDesdeEtiqueta,
  pisoEspacio,
} from "@inventario/types";
import { Button, Input, Label, Select, Textarea } from "./components";

function rellenarNumeroEspacio(raw: string): string {
  const n = numeroEspacioDesdeEtiqueta(nombreEspacioDesdeNumero(raw));
  return n == null ? raw : String(n).padStart(2, "0");
}

function clavePiso(edificioId: string | null, piso: number): string {
  return `${edificioId ?? "sede"}-${piso}`;
}

function resumenPiso(lista: EspacioConOcupacion[]): string {
  const espacios = lista.length;
  const ambientes = lista.reduce((total, espacio) => {
    const ocupantes = espacio.ocupantes?.length ?? 0;
    if (ocupantes > 0) return total + ocupantes;
    return total + (espacio.ambiente_nombre?.trim() ? 1 : 0);
  }, 0);
  if (espacios === 0) return "Sin espacios";
  const textoEspacios = espacios === 1 ? "1 espacio" : `${espacios} espacios`;
  if (ambientes === 0) return textoEspacios;
  const textoAmbientes = ambientes === 1 ? "1 ambiente" : `${ambientes} ambientes`;
  return `${textoEspacios} · ${textoAmbientes}`;
}

function textoOcupacion(espacio: EspacioConOcupacion): string {
  const nombres = (espacio.ocupantes ?? [])
    .map((o) => o.nombre.trim())
    .filter(Boolean);
  if (nombres.length === 0) {
    const legacy = espacio.ambiente_nombre?.trim();
    return legacy || "Libre";
  }
  return nombres.join(", ");
}

function FormularioEspacio({
  pending,
  pisos,
  elegirPiso,
  onSubmit,
}: {
  pending: boolean;
  pisos: number[];
  elegirPiso: boolean;
  onSubmit: (piso: number, numero: string, descripcion: string) => Promise<string | null>;
}) {
  const opciones = pisos.length > 0 ? pisos : [1];
  const pisosKey = opciones.join(",");
  const [piso, setPiso] = useState(String(opciones[0]));
  const [numero, setNumero] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const lista = pisosKey.split(",").filter(Boolean);
    if (!lista.includes(piso)) setPiso(lista[0] ?? "1");
  }, [pisosKey, piso]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mensaje = await onSubmit(pisoEspacio(Number(piso)), numero, descripcion);
    if (mensaje) {
      setLocalError(mensaje);
      return;
    }
    setNumero("");
    setDescripcion("");
    setLocalError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {elegirPiso ? (
          <div className="space-y-1">
            <Label>Piso</Label>
            <Select
              aria-label="Piso del nuevo espacio"
              value={piso}
              onChange={setPiso}
              options={opciones.map((n) => ({ value: String(n), label: `Piso ${n}` }))}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label>Nuevo espacio</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-medium text-muted-foreground">Espacio</span>
            <Input
              inputMode="numeric"
              placeholder="01"
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onBlur={() => setNumero((actual) => rellenarNumeroEspacio(actual))}
              required
              className="max-w-[6rem]"
              aria-label="Número del espacio"
            />
          </div>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Agregar espacio
        </Button>
      </div>
      <Textarea
        rows={2}
        placeholder="Descripción opcional"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        aria-label="Descripción del espacio"
      />
      {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
    </form>
  );
}

export type EspacioSedeOption = {
  id: string;
  nombre: string;
  activo?: boolean;
  es_principal?: boolean;
};

export function EspaciosGestionPanel({
  sedes,
  onList,
  onCreate,
  onUpdateDescripcion,
  onDelete,
  onListEdificios,
  onCreateEdificio,
  onListPisos,
  onCreatePiso,
}: {
  sedes: EspacioSedeOption[];
  onList: (sedeId: string) => Promise<EspacioConOcupacion[]>;
  onCreate: (
    sedeId: string,
    nombre: string,
    descripcion: string,
    ubicacion?: UbicacionEspacioInput,
  ) => Promise<{ error?: string }>;
  onUpdateDescripcion: (
    espacioId: string,
    descripcion: string,
    ubicacion?: UbicacionEspacioInput,
  ) => Promise<{ error?: string }>;
  onDelete: (espacioId: string) => Promise<{ error?: string }>;
  onListEdificios?: (sedeId: string) => Promise<Edificio[]>;
  onCreateEdificio?: (sedeId: string, nombre: string) => Promise<{ error?: string }>;
  onListPisos?: (sedeId: string) => Promise<Piso[]>;
  onCreatePiso?: (edificioId: string) => Promise<{ error?: string }>;
}) {
  const sedesActivas = useMemo(
    () => sedes.filter((s) => s.activo !== false),
    [sedes],
  );
  const sedeIds = sedesActivas.map((s) => s.id).join(",");
  const [sedeId, setSedeId] = useState("");
  const [espacios, setEspacios] = useState<EspacioConOcupacion[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editEdificioId, setEditEdificioId] = useState("");
  const [editPiso, setEditPiso] = useState("1");
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [nuevoEdificio, setNuevoEdificio] = useState("");
  const [pedirEdificio, setPedirEdificio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pisosAbiertos, setPisosAbiertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const principal = sedesActivas.find((s) => s.es_principal) ?? sedesActivas[0];
    setSedeId((current) =>
      current && sedesActivas.some((s) => s.id === current) ? current : (principal?.id ?? ""),
    );
  }, [sedeIds, sedesActivas]);

  async function reload() {
    if (sedesActivas.length === 0) {
      setEspacios([]);
      return;
    }
    const chunks = await Promise.all(sedesActivas.map((s) => onList(s.id)));
    const edificiosChunks = onListEdificios
      ? await Promise.all(sedesActivas.map((s) => onListEdificios(s.id)))
      : [];
    const pisosChunks = onListPisos
      ? await Promise.all(sedesActivas.map((s) => onListPisos(s.id)))
      : [];
    const edificiosCargados = edificiosChunks.flat();
    setEdificios(edificiosCargados);
    setPisos(pisosChunks.flat());
    const nombreEdificio = new Map(edificiosCargados.map((e) => [e.id, e.nombre]));
    const nombrePorSede = new Map(sedesActivas.map((s) => [s.id, s.nombre]));
    const todos = chunks
      .flat()
      .sort((a, b) => {
        const sedeA = nombrePorSede.get(a.sede_id) ?? "";
        const sedeB = nombrePorSede.get(b.sede_id) ?? "";
        if (sedeA !== sedeB) return sedeA.localeCompare(sedeB, "es");
        const edificioA = a.edificio_id ? (nombreEdificio.get(a.edificio_id) ?? "") : "";
        const edificioB = b.edificio_id ? (nombreEdificio.get(b.edificio_id) ?? "") : "";
        if (edificioA !== edificioB) return edificioA.localeCompare(edificioB, "es");
        if ((a.piso ?? 1) !== (b.piso ?? 1)) return (a.piso ?? 1) - (b.piso ?? 1);
        return a.nombre.localeCompare(b.nombre, "es");
      });
    setEspacios(todos);
  }

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    setError(null);
    void reload()
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los espacios.");
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga al cambiar sucursales
  }, [sedeIds]);

  const variasSedes = sedesActivas.length > 1;
  const sedeActual = sedesActivas.find((s) => s.id === sedeId);
  const nombreSedeActual = sedeActual?.nombre ?? "Sucursal";
  const edificiosSede = edificios
    .filter((e) => e.sede_id === sedeId && e.activo !== false)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  const espaciosSede = espacios.filter((e) => e.sede_id === sedeId);
  const usaEdificios = pedirEdificio || edificiosSede.length > 0;
  const espaciosSinEdificio = espaciosSede.filter((e) => !e.edificio_id);

  function pisosDe(edificioId: string | null): number[] {
    if (!edificioId) {
      const deEspacios = espaciosSede
        .filter((e) => !e.edificio_id)
        .map((e) => pisoEspacio(e.piso));
      return Array.from(new Set([1, ...deEspacios])).sort((a, b) => a - b);
    }
    const guardados = pisos.filter((p) => p.edificio_id === edificioId).map((p) => p.numero);
    return Array.from(new Set(guardados.length > 0 ? guardados : [1])).sort((a, b) => a - b);
  }

  function espaciosDe(edificioId: string | null, piso: number): EspacioConOcupacion[] {
    return espaciosSede
      .filter((e) => (e.edificio_id ?? null) === edificioId && pisoEspacio(e.piso) === piso)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  async function crearEn(
    edificioId: string | null,
    piso: number,
    numeroRaw: string,
    descripcion: string,
  ): Promise<string | null> {
    const nombre = nombreEspacioDesdeNumero(numeroRaw);
    if (!sedeId) return "Seleccione una sucursal.";
    if (usaEdificios && !edificioId) return "Cree el espacio dentro de un piso del edificio.";
    if (!nombre) return "Indique el número del espacio (ej. 01, 10, 25).";
    if (espacioRepetidoEnSucursal(nombre, espaciosSede)) return mensajeEspacioRepetido(nombre);
    setPending(true);
    setError(null);
    const ubicacion: UbicacionEspacioInput | undefined =
      !edificioId && piso === 1 ? undefined : { edificioId, piso: pisoEspacio(piso) };
    const result = await onCreate(sedeId, nombre, descripcion.trim(), ubicacion);
    setPending(false);
    if (result.error) return result.error;
    setPisosAbiertos((actual) => ({ ...actual, [clavePiso(edificioId, piso)]: true }));
    setPending(true);
    await reload();
    setPending(false);
    return null;
  }

  async function agregarPiso(edificioId: string) {
    if (!onCreatePiso) return;
    setPending(true);
    setError(null);
    const result = await onCreatePiso(edificioId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending(true);
    await reload();
    setPending(false);
  }

  async function handleSaveDescripcion(espacioId: string) {
    setPending(true);
    setError(null);
    const espacio = espacios.find((e) => e.id === espacioId);
    const detallada =
      pedirEdificio ||
      edificios.some((e) => e.sede_id === espacio?.sede_id) ||
      (espacio?.piso ?? 1) > 1;
    const result = await onUpdateDescripcion(
      espacioId,
      editDesc.trim(),
      detallada
        ? { edificioId: editEdificioId || null, piso: pisoEspacio(Number(editPiso)) }
        : undefined,
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditId(null);
    setEditDesc("");
    setPending(true);
    await reload();
    setPending(false);
  }

  async function handleDelete(espacio: EspacioConOcupacion) {
    const ocupacion = textoOcupacion(espacio);
    const aviso =
      ocupacion === "Libre"
        ? `¿Eliminar "${espacio.nombre}"?`
        : `¿Eliminar "${espacio.nombre}"? Lo ocupan: ${ocupacion}. Esos ambientes quedarán sin espacio.`;
    if (!confirm(aviso)) return;
    setPending(true);
    setError(null);
    const result = await onDelete(espacio.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending(true);
    await reload();
    setPending(false);
  }

  function renderEspacio(espacio: EspacioConOcupacion) {
    const desc = espacio.descripcion?.trim() ?? "";
    const editando = editId === espacio.id;
    const edificiosDelEspacio = edificios.filter(
      (ed) => ed.sede_id === espacio.sede_id && ed.activo !== false,
    );
    const puedeMover = edificiosDelEspacio.length > 0 || (espacio.piso ?? 1) > 1;
    return (
      <li key={espacio.id} className="rounded px-2 py-1.5 hover:bg-muted/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{espacio.nombre}</p>
            <p className="text-xs text-muted-foreground">{desc || "Sin descripción"}</p>
            <p className="text-xs text-muted-foreground">
              {textoOcupacion(espacio) === "Libre" ? "Libre" : `Ocupado por: ${textoOcupacion(espacio)}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError(null);
                if (editando) {
                  setEditId(null);
                  setEditDesc("");
                  return;
                }
                setEditId(espacio.id);
                setEditDesc(desc);
                setEditEdificioId(espacio.edificio_id ?? "");
                setEditPiso(String(espacio.piso ?? 1));
              }}
            >
              {editando ? "Cancelar" : "Editar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={pending}
              onClick={() => void handleDelete(espacio)}
            >
              Eliminar
            </Button>
          </div>
        </div>
        {editando && (
          <div className="mt-2 space-y-2">
            {puedeMover && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Edificio</Label>
                  <Select
                    aria-label={`Edificio de ${espacio.nombre}`}
                    value={editEdificioId}
                    onChange={(id) => {
                      setEditEdificioId(id);
                      const nums = pisos
                        .filter((p) => p.edificio_id === id)
                        .map((p) => p.numero)
                        .sort((a, b) => a - b);
                      const lista = nums.length > 0 ? nums : [1];
                      if (!lista.includes(pisoEspacio(Number(editPiso)))) setEditPiso(String(lista[0]));
                    }}
                    options={[
                      { value: "", label: "Sin edificio" },
                      ...edificiosDelEspacio.map((ed) => ({ value: ed.id, label: ed.nombre })),
                    ]}
                  />
                </div>
                {editEdificioId ? (
                  <div className="space-y-1">
                    <Label>Piso</Label>
                    <Select
                      aria-label={`Piso de ${espacio.nombre}`}
                      value={editPiso}
                      onChange={setEditPiso}
                      options={(pisos.some((p) => p.edificio_id === editEdificioId)
                        ? pisos
                            .filter((p) => p.edificio_id === editEdificioId)
                            .map((p) => p.numero)
                            .sort((a, b) => a - b)
                        : [pisoEspacio(Number(editPiso) || 1)]
                      ).map((n) => ({ value: String(n), label: `Piso ${n}` }))}
                    />
                  </div>
                ) : null}
              </div>
            )}
            <Textarea
              rows={2}
              value={editDesc}
              onChange={(ev) => setEditDesc(ev.target.value)}
              aria-label={`Descripción de ${espacio.nombre}`}
              placeholder="Descripción opcional"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => void handleSaveDescripcion(espacio.id)}
            >
              Guardar
            </Button>
          </div>
        )}
      </li>
    );
  }

  function renderPiso(edificioId: string | null, piso: number) {
    const lista = espaciosDe(edificioId, piso);
    const clave = clavePiso(edificioId, piso);
    const abierto = pisosAbiertos[clave] === true;
    const panelId = `piso-panel-${clave}`;
    return (
      <div key={clave} className="space-y-2 border-l border-border pl-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/40"
          aria-expanded={abierto}
          aria-controls={panelId}
          onClick={() => setPisosAbiertos((actual) => ({ ...actual, [clave]: !actual[clave] }))}
        >
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M7.21 4.23a.75.75 0 011.06.02l4.25 4.5a.75.75 0 010 1.04l-4.25 4.5a.75.75 0 11-1.08-1.04L10.94 10 7.23 5.27a.75.75 0 01-.02-1.04z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-semibold text-foreground">Piso {piso}</span>
          <span className="text-xs text-muted-foreground">{resumenPiso(lista)}</span>
        </button>
        {abierto ? (
          <div id={panelId} className="space-y-2 pl-5">
            {lista.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este piso todavía no tiene espacios.</p>
            ) : (
              <ul className="space-y-1 text-sm">{lista.map((espacio) => renderEspacio(espacio))}</ul>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function formularioEdificio() {
    if (!onCreateEdificio) return null;
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="nuevo_edificio">Nuevo edificio en {nombreSedeActual}</Label>
          <Input
            id="nuevo_edificio"
            value={nuevoEdificio}
            placeholder="Ej. Edificio principal"
            onChange={(e) => setNuevoEdificio(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !sedeId || !nuevoEdificio.trim()}
          onClick={() => {
            const nombre = nuevoEdificio.trim();
            if (!nombre || !onCreateEdificio) return;
            setPending(true);
            setError(null);
            void onCreateEdificio(sedeId, nombre).then(async (result) => {
              setPending(false);
              if (result.error) {
                setError(result.error);
                return;
              }
              setNuevoEdificio("");
              setPedirEdificio(true);
              setPending(true);
              await reload();
              setPending(false);
            });
          }}
        >
          Agregar edificio
        </Button>
      </div>
    );
  }

  if (sedesActivas.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
        No hay sucursales. Cree una sucursal antes de agregar espacios.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los edificios se crean dentro de la sucursal. Cada edificio tiene sus pisos y cada piso tiene sus espacios.
      </p>

      <section className="space-y-4 rounded-md border border-border/60 p-3">
        <div className="space-y-1">
          {variasSedes ? (
            <div className="max-w-sm space-y-1">
              <Label htmlFor="espacios_sede">Sucursal</Label>
              <Select
                id="espacios_sede"
                value={sedeId}
                onChange={setSedeId}
                options={sedesActivas.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-foreground">{nombreSedeActual}</h3>
          )}
          <p className="text-sm text-muted-foreground">Los edificios se crean dentro de {nombreSedeActual}.</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

      {usaEdificios ? (
        <div className="space-y-3">
          {edificiosSede.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cree el edificio. Dentro quedarán sus pisos y, en cada piso, sus espacios.
            </p>
          ) : (
            edificiosSede.map((edificio) => (
              <section key={edificio.id} className="space-y-3 rounded-md border border-border/60 p-3">
                <h3 className="text-sm font-semibold text-foreground">{edificio.nombre}</h3>
                <div className="space-y-4">
                  {pisosDe(edificio.id).map((piso) => renderPiso(edificio.id, piso))}
                </div>
                <FormularioEspacio
                  pending={pending}
                  pisos={pisosDe(edificio.id)}
                  elegirPiso
                  onSubmit={(piso, numero, descripcion) =>
                    crearEn(edificio.id, piso, numero, descripcion)
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !onCreatePiso}
                  onClick={() => void agregarPiso(edificio.id)}
                >
                  Agregar piso
                </Button>
              </section>
            ))
          )}
          {formularioEdificio()}
        </div>
      ) : (
        <section className="space-y-3 rounded-md border border-border/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {nombreSedeActual} no tiene edificios. Los espacios están en el primer piso.
            </p>
            {onCreateEdificio ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setPedirEdificio(true)}>
                Agregar edificio
              </Button>
            ) : null}
          </div>
          <div className="space-y-4">
            {pisosDe(null).map((piso) => renderPiso(null, piso))}
          </div>
          <FormularioEspacio
            pending={pending}
            pisos={[1]}
            elegirPiso={false}
            onSubmit={(piso, numero, descripcion) => crearEn(null, piso, numero, descripcion)}
          />
        </section>
      )}

      {usaEdificios && espaciosSinEdificio.length > 0 ? (
        <section className="space-y-3 rounded-md border border-border/60 p-3">
          <h3 className="text-sm font-semibold text-foreground">Sin edificio</h3>
          <p className="text-sm text-muted-foreground">
            Estos espacios todavía no están dentro de un edificio. Edítelos para asignarlos a un piso.
          </p>
          <div className="space-y-4">
            {Array.from(new Set(espaciosSinEdificio.map((espacio) => pisoEspacio(espacio.piso))))
              .sort((a, b) => a - b)
              .map((piso) => renderPiso(null, piso))}
          </div>
        </section>
      ) : null}
      </section>
    </div>
  );
}
