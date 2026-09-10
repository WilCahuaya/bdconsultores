"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { consultarDni } from "@/lib/actions/entidades";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import type { Entidad } from "@inventario/types";

export function NuevoTrabajadorForm({
  entidades,
  defaultEntidadId,
  lockEntidad = false,
}: {
  entidades: Entidad[];
  defaultEntidadId: string;
  lockEntidad?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [entidadId, setEntidadId] = useState(defaultEntidadId);

  async function buscarPorDni() {
    setBuscando(true);
    setLookupMsg(null);
    const result = await consultarDni(dni);
    setBuscando(false);
    if (result.error) {
      pushToast(result.error, "error");
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
    const result = await createTrabajador(formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Ficha abierta. Siga con los documentos.");
    if (result.relacionId) router.push(`/trabajadores/${result.relacionId}?tab=documentos`);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection title="Empresa" hint="Si la persona ya existe por DNI, se reutiliza y se abre la ficha en esta empresa.">
        {lockEntidad ? <input type="hidden" name="entidad_id" value={defaultEntidadId} /> : null}
        <SelectField
          label="Empresa"
          name={lockEntidad ? "entidad_id_vista" : "entidad_id"}
          value={entidadId}
          options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
          required={!lockEntidad}
          disabled={lockEntidad}
          onChange={(event) => setEntidadId(event.target.value)}
        />
      </FormSection>
      <FormSection
        title="Identificar a la persona"
        hint="Con el DNI basta para abrir la ficha. El escaneo y el resto de datos se capturan en Documentos."
      >
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
        </div>
        {lookupMsg ? <p className="text-sm text-muted-foreground">{lookupMsg}</p> : null}
      </FormSection>
      <Button type="submit" disabled={pending || buscando}>
        {pending ? "Guardando…" : "Abrir ficha y continuar a documentos"}
      </Button>
    </form>
  );
}
