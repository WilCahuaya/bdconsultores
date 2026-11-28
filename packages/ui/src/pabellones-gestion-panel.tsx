"use client";

import { useEffect, useRef, useState } from "react";
import type { Edificio } from "@inventario/types";
import { Button, Input, Label, Textarea } from "./components";
import { Select } from "./select";

export type PabellonSedeOption = {
  id: string;
  nombre: string;
};

export function PabellonesGestionPanel({
  sedes,
  onList,
  onCreate,
  onUpdate,
}: {
  sedes: PabellonSedeOption[];
  onList: (sedeId: string) => Promise<Edificio[]>;
  onCreate: (sedeId: string, nombre: string, descripcion: string) => Promise<{ error?: string }>;
  onUpdate: (edificioId: string, nombre: string, descripcion: string) => Promise<{ error?: string }>;
}) {
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [pabellones, setPabellones] = useState<Edificio[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onListRef = useRef(onList);
  onListRef.current = onList;

  useEffect(() => {
    if (!sedes.some((sede) => sede.id === sedeId)) {
      setSedeId(sedes[0]?.id ?? "");
    }
  }, [sedes, sedeId]);

  useEffect(() => {
    if (!sedeId) {
      setPabellones([]);
      return;
    }
    let cancelled = false;
    void onListRef.current(sedeId).then((lista) => {
      if (!cancelled) setPabellones(lista);
    });
    return () => {
      cancelled = true;
    };
  }, [sedeId]);

  async function recargar() {
    if (!sedeId) return;
    setPabellones(await onListRef.current(sedeId));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!sedeId) return;
    setPending(true);
    setError(null);
    const result = await onCreate(sedeId, nombre, descripcion);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNombre("");
    setDescripcion("");
    await recargar();
  }

  function empezarEdicion(pabellon: Edificio) {
    setEditId(pabellon.id);
    setEditNombre(pabellon.nombre);
    setEditDescripcion(pabellon.descripcion ?? "");
    setError(null);
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editId) return;
    setPending(true);
    setError(null);
    const result = await onUpdate(editId, editNombre, editDescripcion);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditId(null);
    await recargar();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cada pabellón pertenece a una sucursal. El nombre se puede cambiar después. La descripción es opcional.
      </p>
      {sedes.length > 1 ? (
        <div className="max-w-xs space-y-2">
          <Label htmlFor="pabellon_sede">Sucursal</Label>
          <Select
            id="pabellon_sede"
            value={sedeId}
            onChange={setSedeId}
            options={sedes.map((sede) => ({ value: sede.id, label: sede.nombre }))}
          />
        </div>
      ) : null}

      <form onSubmit={(event) => void handleCreate(event)} className="space-y-3 rounded-md border border-border/60 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pabellon_nombre">Nuevo pabellón</Label>
            <Input
              id="pabellon_nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej. Pabellón A, Edificio 01"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pabellon_descripcion">Descripción</Label>
            <Textarea
              id="pabellon_descripcion"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>
        </div>
        <Button type="submit" disabled={pending || !sedeId}>
          Agregar pabellón
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {pabellones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta sucursal no tiene pabellones.</p>
      ) : (
        <ul className="space-y-2">
          {pabellones.map((pabellon) =>
            editId === pabellon.id ? (
              <li key={pabellon.id} className="rounded-md border border-border/60 p-3">
                <form onSubmit={(event) => void handleUpdate(event)} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`edit_pabellon_${pabellon.id}`}>Nombre</Label>
                      <Input
                        id={`edit_pabellon_${pabellon.id}`}
                        value={editNombre}
                        onChange={(event) => setEditNombre(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit_pabellon_desc_${pabellon.id}`}>Descripción</Label>
                      <Textarea
                        id={`edit_pabellon_desc_${pabellon.id}`}
                        value={editDescripcion}
                        onChange={(event) => setEditDescripcion(event.target.value)}
                        placeholder="Opcional"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending}>
                      Guardar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li
                key={pabellon.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{pabellon.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {pabellon.descripcion?.trim() || "Sin descripción"}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => empezarEdicion(pabellon)}>
                  Editar
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
