"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { consultarDni } from "@/lib/actions/entidades";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL, opcionesCargo } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import type { Entidad } from "@inventario/types";

export function NuevoTrabajadorForm({
  entidades,
  defaultEntidadId,
}: {
  entidades: Entidad[];
  defaultEntidadId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  async function buscarPorDni() {
    setBuscando(true);
    setError(null);
    setLookupMsg(null);
    const result = await consultarDni(dni);
    setBuscando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.dni) setDni(result.dni);
    if (result.nombres) setNombres(result.nombres);
    setApellidoPaterno(result.apellido_paterno ?? "");
    setApellidoMaterno(result.apellido_materno ?? "");
    if (result.fecha_nacimiento) setFechaNacimiento(result.fecha_nacimiento);
    setLookupMsg("Datos traídos del padrón RENIEC. Puede editarlos si hace falta.");
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createTrabajador(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.relacionId) router.push(`/trabajadores/${result.relacionId}`);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection title="Empresa" hint="Si la persona ya existe por DNI, se reutiliza y se crea el puesto aquí.">
        <SelectField
          label="Empresa"
          name="entidad_id"
          defaultValue={defaultEntidadId}
          options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
          required
        />
      </FormSection>
      <FormSection title="Persona" hint="Con el DNI se puede traer el nombre. La dirección sí va en el contrato.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Field
              label="DNI"
              name="dni"
              required
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              title="8 dígitos"
              value={dni}
              onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <Button type="button" variant="outline" size="sm" disabled={buscando || pending} onClick={() => void buscarPorDni()}>
              {buscando ? "Consultando…" : "Buscar en RENIEC"}
            </Button>
          </div>
          <Field
            label="Nombres"
            name="nombres"
            required
            value={nombres}
            onChange={(event) => setNombres(event.target.value)}
          />
          <Field
            label="Apellido paterno"
            name="apellido_paterno"
            value={apellidoPaterno}
            onChange={(event) => setApellidoPaterno(event.target.value)}
          />
          <Field
            label="Apellido materno"
            name="apellido_materno"
            value={apellidoMaterno}
            onChange={(event) => setApellidoMaterno(event.target.value)}
          />
          <DateField
            label="Fecha de nacimiento"
            name="fecha_nacimiento"
            value={fechaNacimiento}
            onChange={setFechaNacimiento}
          />
          <Field label="Celular" name="celular" />
          <Field label="Correo" name="correo" type="email" />
          <Field label="Dirección" name="direccion" />
        </div>
        {lookupMsg ? <p className="text-sm text-muted-foreground">{lookupMsg}</p> : null}
      </FormSection>
      <FormSection title="Puesto en esta empresa">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Cargo" name="cargo" allowEmpty options={opcionesCargo()} />
          <SelectField
            label="Clasificación"
            name="clasificacion"
            allowEmpty
            options={Object.entries(CLASIFICACION_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="Jornada"
            name="jornada"
            allowEmpty
            options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Field label="Horario" name="horario" placeholder="Ej. Lunes a viernes 8:00 a 13:00" />
          <DateField label="Fecha de ingreso" name="fecha_ingreso" />
        </div>
      </FormSection>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || buscando}>
        {pending ? "Guardando…" : "Registrar trabajador"}
      </Button>
    </form>
  );
}
