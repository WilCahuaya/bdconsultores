"use client";

import { useState, type FormEvent } from "react";
import type { CreateResponsableInput, TrabajadorPlanillaOpcion } from "@inventario/types";
import { RESPONSABLE_CARGO_DEFAULT } from "@inventario/types";
import { Button, Label } from "./components";
import { Select } from "./select";
import { ResponsableFormFields, responsableFromForm } from "./responsable-form-fields";

type ModoAlta = "planilla" | "nuevo";

function etiquetaTrabajador(trabajador: TrabajadorPlanillaOpcion): string {
  const partes = [trabajador.nombre];
  if (trabajador.dni) partes.push(trabajador.dni);
  if (trabajador.cargo?.trim()) partes.push(trabajador.cargo.trim());
  return partes.join(" · ");
}

export function ResponsableAltaForm({
  idPrefix,
  trabajadoresPlanilla,
  cargandoPlanilla = false,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  idPrefix: string;
  /** Lista de la planilla. Si es null o undefined, solo se ofrece el alta manual. */
  trabajadoresPlanilla?: TrabajadorPlanillaOpcion[] | null;
  cargandoPlanilla?: boolean;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: CreateResponsableInput) => void;
}) {
  const ofrecePlanilla = trabajadoresPlanilla != null;
  const [modo, setModo] = useState<ModoAlta>(ofrecePlanilla ? "planilla" : "nuevo");
  const [relacionId, setRelacionId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const seleccionado = trabajadoresPlanilla?.find((t) => t.relacionId === relacionId) ?? null;
  const mensaje = localError ?? error;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (modo === "planilla") {
      if (!seleccionado) {
        setLocalError("Seleccione un trabajador de la planilla.");
        return;
      }
      onSubmit({
        nombre: seleccionado.nombre,
        dni: seleccionado.dni,
        email: seleccionado.email ?? "",
        telefono: seleccionado.telefono ?? "",
        cargo: seleccionado.cargo ?? undefined,
        desdePlanilla: true,
      });
      return;
    }
    onSubmit(responsableFromForm(new FormData(e.currentTarget)));
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      {ofrecePlanilla && (
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            size="sm"
            variant={modo === "planilla" ? "default" : "outline"}
            onClick={() => {
              setModo("planilla");
              setLocalError(null);
            }}
          >
            De la planilla
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modo === "nuevo" ? "default" : "outline"}
            onClick={() => {
              setModo("nuevo");
              setLocalError(null);
            }}
          >
            Nuevo
          </Button>
        </div>
      )}

      {modo === "planilla" && trabajadoresPlanilla ? (
        <div className="space-y-3 sm:col-span-2">
          {cargandoPlanilla ? (
            <p className="text-sm text-muted-foreground">Cargando trabajadores de la planilla…</p>
          ) : trabajadoresPlanilla.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay trabajadores activos en la planilla. Puede registrar un responsable nuevo.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}_trabajador`}>Trabajador</Label>
                <Select
                  id={`${idPrefix}_trabajador`}
                  value={relacionId}
                  onChange={setRelacionId}
                  options={[
                    { value: "", label: "Seleccione un trabajador", kind: "placeholder" },
                    ...trabajadoresPlanilla.map((trabajador) => ({
                      value: trabajador.relacionId,
                      label: etiquetaTrabajador(trabajador),
                    })),
                  ]}
                />
              </div>
              {seleccionado && (
                <dl className="grid gap-2 rounded-md border border-border/70 bg-muted/30 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Nombre</dt>
                    <dd>{seleccionado.nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">DNI</dt>
                    <dd>{seleccionado.dni || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Cargo</dt>
                    <dd>{seleccionado.cargo?.trim() || RESPONSABLE_CARGO_DEFAULT}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Correo</dt>
                    <dd className="truncate">{seleccionado.email?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Teléfono</dt>
                    <dd>{seleccionado.telefono?.trim() || "—"}</dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="sm:col-span-2">
          <ResponsableFormFields idPrefix={idPrefix} />
        </div>
      )}

      {mensaje && <p className="text-sm text-destructive sm:col-span-2">{mensaje}</p>}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || (modo === "planilla" && !seleccionado)}>
          {pending ? "Guardando…" : "Guardar responsable"}
        </Button>
      </div>
    </form>
  );
}
