"use client";

import { useEffect, useMemo, useState } from "react";
import type { EspacioConOcupacion } from "@inventario/types";
import { Button, Input, Label, Select, Textarea } from "./components";

function nombreDesdeNumero(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 1 || n > 9999) return null;
  return `Espacio ${String(n).padStart(2, "0")}`;
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
  onEnsureHasta,
  onUpdateDescripcion,
  onDelete,
}: {
  sedes: EspacioSedeOption[];
  onList: (sedeId: string) => Promise<EspacioConOcupacion[]>;
  onCreate: (sedeId: string, nombre: string, descripcion: string) => Promise<{ error?: string }>;
  onEnsureHasta: (
    sedeId: string,
    cantidad: number,
    descripcion: string,
  ) => Promise<{ error?: string; creados?: number }>;
  onUpdateDescripcion: (espacioId: string, descripcion: string) => Promise<{ error?: string }>;
  onDelete: (espacioId: string) => Promise<{ error?: string }>;
}) {
  const sedesActivas = useMemo(
    () => sedes.filter((s) => s.activo !== false),
    [sedes],
  );
  const sedeIds = sedesActivas.map((s) => s.id).join(",");
  const [sedeId, setSedeId] = useState("");
  const [espacios, setEspacios] = useState<EspacioConOcupacion[]>([]);
  const [numero, setNumero] = useState("");
  const [descripcionUno, setDescripcionUno] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [descripcionVarios, setDescripcionVarios] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    const nombrePorSede = new Map(sedesActivas.map((s) => [s.id, s.nombre]));
    const todos = chunks
      .flat()
      .sort((a, b) => {
        const sedeA = nombrePorSede.get(a.sede_id) ?? "";
        const sedeB = nombrePorSede.get(b.sede_id) ?? "";
        if (sedeA !== sedeB) return sedeA.localeCompare(sedeB, "es");
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
  const nombreSede = (id: string) => sedesActivas.find((s) => s.id === id)?.nombre ?? "Sucursal";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nombreDesdeNumero(numero);
    if (!sedeId) {
      setError("Seleccione una sucursal.");
      return;
    }
    if (!nombre) {
      setError("Indique el número del espacio (ej. 01, 10, 25).");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onCreate(sedeId, nombre, descripcionUno.trim());
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNumero("");
    setDescripcionUno("");
    setPending(true);
    await reload();
    setPending(false);
  }

  async function handleEnsure(e: React.FormEvent) {
    e.preventDefault();
    if (!sedeId) {
      setError("Seleccione una sucursal.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onEnsureHasta(sedeId, Number(cantidad), descripcionVarios.trim());
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCantidad("");
    setDescripcionVarios("");
    setPending(true);
    await reload();
    setPending(false);
  }

  async function handleSaveDescripcion(espacioId: string) {
    setPending(true);
    setError(null);
    const result = await onUpdateDescripcion(espacioId, editDesc.trim());
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
        Varios ambientes pueden ocupar el mismo espacio. La descripción es opcional.
      </p>

      {variasSedes && (
        <div className="max-w-sm space-y-1">
          <Label htmlFor="espacios_sede">Sucursal</Label>
          <Select
            id="espacios_sede"
            value={sedeId}
            onChange={setSedeId}
            options={sedesActivas.map((s) => ({ value: s.id, label: s.nombre }))}
          />
        </div>
      )}

      <form onSubmit={handleEnsure} className="space-y-2 rounded-md border border-border/60 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label htmlFor="espacios_cantidad_panel">Cantidad a agregar</Label>
            <Input
              id="espacios_cantidad_panel"
              type="number"
              min={1}
              max={500}
              placeholder="Ej. 5"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Agregar espacios
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="espacios_desc_varios_panel">Descripción (opcional)</Label>
          <Textarea
            id="espacios_desc_varios_panel"
            rows={2}
            placeholder="Opcional. Se aplica a cada espacio nuevo de esta sucursal."
            value={descripcionVarios}
            onChange={(e) => setDescripcionVarios(e.target.value)}
          />
        </div>
      </form>

      <form onSubmit={handleCreate} className="space-y-2 rounded-md border border-border/60 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 space-y-1">
            <Label htmlFor="espacio_numero_panel">Nuevo espacio</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm font-medium text-muted-foreground">Espacio</span>
              <Input
                id="espacio_numero_panel"
                inputMode="numeric"
                placeholder="01"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
                className="max-w-[6rem]"
                aria-label="Número del espacio"
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Agregar
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="espacio_desc_uno_panel">Descripción (opcional)</Label>
          <Textarea
            id="espacio_desc_uno_panel"
            rows={2}
            placeholder="Ej. Aula de música, primer piso"
            value={descripcionUno}
            onChange={(e) => setDescripcionUno(e.target.value)}
          />
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {espacios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {pending ? "Cargando espacios…" : "Aún no hay espacios. Indique cuántos crear (empezarán en Espacio 01)."}
        </p>
      ) : (
        <ul className="space-y-1 rounded-md border border-border/60 p-2 text-sm">
          {espacios.map((e) => {
            const desc = e.descripcion?.trim() ?? "";
            const editando = editId === e.id;
            return (
              <li key={e.id} className="rounded px-2 py-1.5 hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {e.nombre}
                      {variasSedes ? (
                        <span className="font-normal text-muted-foreground"> · {nombreSede(e.sede_id)}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{desc || "Sin descripción"}</p>
                    <p className="text-xs text-muted-foreground">
                      {textoOcupacion(e) === "Libre"
                        ? "Libre"
                        : `Ocupado por: ${textoOcupacion(e)}`}
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
                        setEditId(e.id);
                        setEditDesc(desc);
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
                      onClick={() => void handleDelete(e)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
                {editando && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      rows={2}
                      value={editDesc}
                      onChange={(ev) => setEditDesc(ev.target.value)}
                      aria-label={`Descripción de ${e.nombre}`}
                      placeholder="Descripción opcional"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void handleSaveDescripcion(e.id)}
                    >
                      Guardar descripción
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
