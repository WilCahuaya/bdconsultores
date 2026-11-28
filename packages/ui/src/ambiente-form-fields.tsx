"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ambiente, Edificio, Responsable, SedeConConteo, TrabajadorPlanillaOpcion } from "@inventario/types";
import { normalizeResponsableDni, normalizeResponsableNombre } from "@inventario/types";
import { Button, Dialog, Input, Label, Select, Textarea } from "./components";

const TRABAJADOR_RESPONSABLE_PREFIX = "trabajador:";

function etiquetaResponsable(nombre: string, cargo?: string | null): string {
  const cargoLimpio = cargo?.trim();
  return cargoLimpio ? `${nombre} — ${cargoLimpio}` : nombre;
}

function clavesResponsable(responsable: Pick<Responsable, "nombre" | "dni">): string[] {
  const claves = [`nombre:${normalizeResponsableNombre(responsable.nombre).toLowerCase()}`];
  const dni = normalizeResponsableDni(responsable.dni ?? "");
  if (dni) claves.push(`dni:${dni}`);
  return claves;
}

function clavesTrabajador(trabajador: TrabajadorPlanillaOpcion): string[] {
  const claves = [`nombre:${normalizeResponsableNombre(trabajador.nombre).toLowerCase()}`];
  const dni = normalizeResponsableDni(trabajador.dni);
  if (dni) claves.unshift(`dni:${dni}`);
  return claves;
}

export type AmbienteFormAmbiente = Pick<
  Ambiente,
  "nombre" | "descripcion" | "responsable_id" | "responsable" | "espacio_id" | "sede_id"
> & {
  es_preregistro?: boolean;
  edificio_id?: string | null;
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

function IconoVer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Nombre del espacio y un botón para ver piso, edificio y descripción. */
export function EspacioOcupaCelda({
  esPreregistro,
  esFaltante,
  espacioNombre,
  piso,
  edificioNombre,
  descripcion,
}: {
  esPreregistro?: boolean;
  esFaltante?: boolean;
  espacioNombre?: string | null;
  piso?: number | null;
  edificioNombre?: string | null;
  descripcion?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (esFaltante || esPreregistro) return <>No aplica</>;
  const etiqueta = etiquetaEspacioAmbiente({ esPreregistro, espacioNombre });
  const edificio = edificioNombre?.trim() || "";
  const desc = descripcion?.trim() || "";
  const pisoNum = piso && piso > 0 ? piso : null;
  const mostrarPiso = pisoNum != null;
  const puedeVer = !esPreregistro && Boolean(espacioNombre?.trim());

  return (
    <span className="inline-flex items-center gap-1">
      <span>{etiqueta}</span>
      {puedeVer ? (
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Ver ubicación de ${etiqueta}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <IconoVer className="h-4 w-4" />
        </button>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={etiqueta} className="max-w-md">
        <dl className="space-y-2 text-sm">
          {edificio ? (
            <div>
              <dt className="text-muted-foreground">Edificio</dt>
              <dd className="font-medium text-foreground">{edificio}</dd>
            </div>
          ) : null}
          {mostrarPiso && pisoNum ? (
            <div>
              <dt className="text-muted-foreground">Piso</dt>
              <dd className="font-medium text-foreground">Piso {pisoNum}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="font-medium text-foreground">{desc || "Sin descripción"}</dd>
          </div>
        </dl>
      </Dialog>
    </span>
  );
}

export function etiquetaPabellonAmbiente(opts: {
  esPreregistro?: boolean;
  esFaltante?: boolean;
  pabellonNombre?: string | null;
}): string {
  if (opts.esPreregistro || opts.esFaltante) return "No aplica";
  return opts.pabellonNombre?.trim() || "Sin pabellón";
}

export function ambienteFromForm(form: FormData) {
  const responsableId = String(form.get("responsable_id") || "").trim();
  const edificioId = String(form.get("edificio_id") || "").trim();
  return {
    sedeId: String(form.get("sede_id") || ""),
    nombre: String(form.get("nombre")),
    descripcion: String(form.get("descripcion") || ""),
    responsableId: responsableId || null,
    edificioId: edificioId || null,
  };
}

export function AmbienteFormFields({
  ambiente,
  sedes,
  responsables,
  pabellones = [],
  defaultSedeId,
  showSedeSelect,
  responsableId,
  onResponsableIdChange,
  trabajadores,
  onElegirTrabajador,
  onRequestCreateResponsable,
  pabellonId,
  onPabellonIdChange,
  esPreregistro = false,
}: {
  ambiente?: AmbienteFormAmbiente;
  sedes: Array<SedeConConteo | { id: string; nombre: string; es_principal?: boolean }>;
  responsables: Responsable[];
  /** Pabellones de la entidad (se filtran por sucursal seleccionada). */
  pabellones?: Edificio[];
  defaultSedeId?: string;
  showSedeSelect?: boolean;
  responsableId: string;
  onResponsableIdChange: (id: string) => void;
  /** Personas que aún no están en responsables y se pueden elegir en el mismo selector. */
  trabajadores?: TrabajadorPlanillaOpcion[] | null;
  onElegirTrabajador?: (relacionId: string) => Promise<{ id?: string; error?: string }>;
  onRequestCreateResponsable?: () => void;
  pabellonId: string;
  onPabellonIdChange: (id: string) => void;
  /** Ambiente buzón de preregistros: no es un local físico. */
  esPreregistro?: boolean;
}) {
  const [nombre, setNombre] = useState(ambiente?.nombre ?? "");
  const [sedeId, setSedeId] = useState(
    ambiente?.sede_id ?? defaultSedeId ?? sedes.find((s) => s.es_principal)?.id ?? "",
  );

  useEffect(() => {
    setNombre(ambiente?.nombre ?? "");
  }, [ambiente?.nombre, ambiente?.responsable_id, ambiente?.edificio_id]);

  useEffect(() => {
    if (ambiente?.sede_id) setSedeId(ambiente.sede_id);
    else if (defaultSedeId) setSedeId(defaultSedeId);
  }, [ambiente?.sede_id, defaultSedeId]);

  const activos = useMemo(
    () => responsables.filter((r) => r.activo),
    [responsables],
  );

  const pabellonesSede = useMemo(
    () => pabellones.filter((e) => e.sede_id === sedeId && e.activo),
    [pabellones, sedeId],
  );

  const puedeElegirResponsable = Boolean(ambiente) || nombre.trim().length > 0;
  const [asignandoResponsable, setAsignandoResponsable] = useState(false);
  const [errorResponsable, setErrorResponsable] = useState<string | null>(null);

  const opcionesResponsable = useMemo(() => {
    const personas = activos.map((responsable) => ({
      value: responsable.id,
      label: etiquetaResponsable(responsable.nombre, responsable.cargo),
    }));
    const yaRegistrados = new Set(activos.flatMap((responsable) => clavesResponsable(responsable)));
    for (const trabajador of trabajadores ?? []) {
      const claves = clavesTrabajador(trabajador);
      if (claves.some((clave) => yaRegistrados.has(clave))) continue;
      personas.push({
        value: `${TRABAJADOR_RESPONSABLE_PREFIX}${trabajador.relacionId}`,
        label: etiquetaResponsable(trabajador.nombre, trabajador.cargo),
      });
    }
    personas.sort((a, b) => a.label.localeCompare(b.label, "es"));
    return [{ value: "", label: "Sin responsable asignado" }, ...personas];
  }, [activos, trabajadores]);

  async function handleResponsableChange(value: string) {
    if (!value.startsWith(TRABAJADOR_RESPONSABLE_PREFIX)) {
      setErrorResponsable(null);
      onResponsableIdChange(value);
      return;
    }
    if (!onElegirTrabajador) return;
    const relacionId = value.slice(TRABAJADOR_RESPONSABLE_PREFIX.length);
    setAsignandoResponsable(true);
    setErrorResponsable(null);
    try {
      const result = await onElegirTrabajador(relacionId);
      if (result.error || !result.id) {
        setErrorResponsable(result.error ?? "No se pudo asignar el responsable.");
        return;
      }
      onResponsableIdChange(result.id);
    } finally {
      setAsignandoResponsable(false);
    }
  }

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
              onPabellonIdChange("");
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
          placeholder="Ej. Aula 01 - Nivel II"
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
        <Label htmlFor="amb_edificio_id">Pabellón</Label>
        {esPreregistro ? (
          <>
            <input type="hidden" name="edificio_id" value="" />
            <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              No aplica. Este ambiente es solo para preregistros: no es un local físico.
            </p>
          </>
        ) : (
          <>
            <Select
              id="amb_edificio_id"
              name="edificio_id"
              value={pabellonId}
              onChange={onPabellonIdChange}
              disabled={!sedeId}
              options={[
                { value: "", label: "Sin pabellón" },
                ...pabellonesSede.map((pabellon) => ({
                  value: pabellon.id,
                  label: pabellon.nombre,
                })),
              ]}
            />
            <p className="text-xs text-muted-foreground">
              El nombre del ambiente es libre. Varios ambientes pueden estar en el mismo pabellón.
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
          onChange={(value) => void handleResponsableChange(value)}
          disabled={!puedeElegirResponsable || asignandoResponsable}
          options={opcionesResponsable}
        />
        {errorResponsable && <p className="text-sm text-destructive">{errorResponsable}</p>}
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
        {puedeElegirResponsable &&
          activos.length === 0 &&
          (trabajadores?.length ?? 0) === 0 &&
          onRequestCreateResponsable && (
          <p className="text-xs text-muted-foreground">
            No hay responsables registrados. Use «+ Nuevo responsable» para crear uno.
          </p>
        )}
      </div>
    </>
  );
}
