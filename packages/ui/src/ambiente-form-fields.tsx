"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ambiente, Espacio, Responsable, SedeConConteo } from "@inventario/types";
import { etiquetaNombreEspacio } from "@inventario/types";
import { Button, Input, Label, Select, Textarea } from "./components";

export type AmbienteFormAmbiente = Pick<
  Ambiente,
  "nombre" | "descripcion" | "responsable_id" | "responsable" | "espacio_id" | "sede_id"
> & {
  es_preregistro?: boolean;
};

/** Texto de espacio en listas: preregistro no es local físico. */
export function etiquetaEspacioAmbiente(opts: {
  esPreregistro?: boolean;
  espacioNombre?: string | null;
}): string {
  if (opts.esPreregistro) return "No aplica";
  const nombre = opts.espacioNombre?.trim();
  return nombre || "Sin asignar";
}

export function ambienteFromForm(form: FormData) {
  const responsableId = String(form.get("responsable_id") || "").trim();
  const espacioId = String(form.get("espacio_id") || "").trim();
  return {
    sedeId: String(form.get("sede_id") || ""),
    nombre: String(form.get("nombre")),
    descripcion: String(form.get("descripcion") || ""),
    responsableId: responsableId || null,
    espacioId: espacioId || null,
  };
}

export function AmbienteFormFields({
  ambiente,
  sedes,
  responsables,
  espacios = [],
  defaultSedeId,
  showSedeSelect,
  responsableId,
  onResponsableIdChange,
  onRequestCreateResponsable,
  espacioId,
  onEspacioIdChange,
  onRequestManageEspacios,
  esPreregistro = false,
}: {
  ambiente?: AmbienteFormAmbiente;
  sedes: Array<SedeConConteo | { id: string; nombre: string; es_principal?: boolean }>;
  responsables: Responsable[];
  /** Espacios de la entidad (se filtran por sucursal seleccionada). */
  espacios?: Espacio[];
  defaultSedeId?: string;
  showSedeSelect?: boolean;
  responsableId: string;
  onResponsableIdChange: (id: string) => void;
  onRequestCreateResponsable?: () => void;
  espacioId: string;
  onEspacioIdChange: (id: string) => void;
  onRequestManageEspacios?: (sedeId: string) => void;
  /** Ambiente buzón de preregistros: no ocupa espacio físico. */
  esPreregistro?: boolean;
}) {
  const [nombre, setNombre] = useState(ambiente?.nombre ?? "");
  const [sedeId, setSedeId] = useState(
    ambiente?.sede_id ?? defaultSedeId ?? sedes.find((s) => s.es_principal)?.id ?? "",
  );

  useEffect(() => {
    setNombre(ambiente?.nombre ?? "");
  }, [ambiente?.nombre, ambiente?.responsable_id, ambiente?.espacio_id]);

  useEffect(() => {
    if (ambiente?.sede_id) setSedeId(ambiente.sede_id);
    else if (defaultSedeId) setSedeId(defaultSedeId);
  }, [ambiente?.sede_id, defaultSedeId]);

  const activos = useMemo(
    () => responsables.filter((r) => r.activo),
    [responsables],
  );

  const espaciosSede = useMemo(
    () => espacios.filter((e) => e.sede_id === sedeId && e.activo),
    [espacios, sedeId],
  );

  const puedeElegirResponsable = Boolean(ambiente) || nombre.trim().length > 0;

  return (
    <>
      {showSedeSelect ? (
        <div className="space-y-2">
          <Label htmlFor="amb_sede">Sucursal</Label>
          <Select
            id="amb_sede"
            name="sede_id"
            required
            value={sedeId}
            onChange={(next) => {
              setSedeId(next);
              onEspacioIdChange("");
            }}
            options={sedes.map((sede) => ({ value: sede.id, label: sede.nombre }))}
          />
        </div>
      ) : sedeId ? (
        <input type="hidden" name="sede_id" value={sedeId} />
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="amb_nombre">Nombre del ambiente</Label>
        <Input
          id="amb_nombre"
          name="nombre"
          required
          placeholder="Ej. Secretaría, Nivel 3…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus={!ambiente}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amb_descripcion">Descripción</Label>
        <Textarea
          id="amb_descripcion"
          name="descripcion"
          placeholder="Opcional"
          defaultValue={ambiente?.descripcion ?? ""}
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="amb_espacio_id">Espacio que ocupa</Label>
          {!esPreregistro && onRequestManageEspacios && sedeId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onRequestManageEspacios(sedeId)}
            >
              Gestionar espacios
            </Button>
          )}
        </div>
        {esPreregistro ? (
          <>
            <input type="hidden" name="espacio_id" value="" />
            <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              No aplica. Este ambiente es solo para preregistros: no es un local físico. El espacio
              se asigna al validar y ubicar cada bien.
            </p>
          </>
        ) : (
          <>
            <Select
              id="amb_espacio_id"
              name="espacio_id"
              value={espacioId}
              onChange={onEspacioIdChange}
              disabled={!sedeId}
              options={[
                { value: "", label: "Sin espacio asignado (opcional)" },
                ...espaciosSede.map((e) => ({
                  value: e.id,
                  label: etiquetaNombreEspacio(e.nombre, e.descripcion),
                })),
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Varios ambientes pueden ocupar el mismo espacio. Puede cambiarlo si el área se muda.
            </p>
          </>
        )}
      </div>
      <div
        className={
          puedeElegirResponsable ? "space-y-2" : "space-y-2 opacity-60"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="amb_responsable_id">Responsable del ambiente</Label>
          {onRequestCreateResponsable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!puedeElegirResponsable}
              onClick={onRequestCreateResponsable}
            >
              + Nuevo responsable
            </Button>
          )}
        </div>
        <Select
          id="amb_responsable_id"
          name="responsable_id"
          value={responsableId}
          onChange={onResponsableIdChange}
          disabled={!puedeElegirResponsable}
          options={[
            { value: "", label: "Sin responsable asignado" },
            ...activos.map((r) => ({
              value: r.id,
              label: `${r.nombre}${r.cargo ? ` — ${r.cargo}` : ""}`,
            })),
          ]}
        />
        {!puedeElegirResponsable && (
          <p className="text-xs text-muted-foreground">
            Escriba primero el nombre del ambiente para asignar un responsable.
          </p>
        )}
        {puedeElegirResponsable && activos.length === 0 && !onRequestCreateResponsable && (
          <p className="text-xs text-muted-foreground">
            Registre responsables en la pestaña «Responsables» antes de asignarlos.
          </p>
        )}
        {puedeElegirResponsable && activos.length === 0 && onRequestCreateResponsable && (
          <p className="text-xs text-muted-foreground">
            No hay responsables registrados. Use «+ Nuevo responsable» para crear uno.
          </p>
        )}
      </div>
    </>
  );
}
