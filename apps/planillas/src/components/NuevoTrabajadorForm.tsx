"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { consultarDni } from "@/lib/actions/entidades";
import { setDocumentoArchivo } from "@/lib/actions/ficha";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL, opcionesCargo } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { leerTextoEscaneo } from "@/lib/ocr-documento";
import { extraerDniDeTexto } from "@/lib/parse-ocr-alta";
import { uploadDocumentoFile } from "@/lib/upload-documento";
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
  const [leyendo, setLeyendo] = useState(false);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [jornada, setJornada] = useState("");
  const [entidadId, setEntidadId] = useState(defaultEntidadId);

  useEffect(() => {
    if (!dniFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(dniFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [dniFile]);

  async function aplicarEscaneo(file: File | null) {
    setDniFile(file);
    if (!file) return;
    setLeyendo(true);
    try {
      const texto = await leerTextoEscaneo(file);
      const leido = extraerDniDeTexto(texto);
      if (!leido) {
        pushToast("No se pudo leer el DNI. Complete los campos a mano.", "error");
        return;
      }
      setDni(leido);
      const reniec = await consultarDni(leido);
      if (reniec.error) {
        pushToast("Se leyó el número. Complete el resto a mano o busque en RENIEC.", "error");
        return;
      }
      if (reniec.dni) setDni(reniec.dni);
      if (reniec.nombres) setNombres(reniec.nombres);
      setApellidoPaterno(reniec.apellido_paterno ?? "");
      setApellidoMaterno(reniec.apellido_materno ?? "");
      if (reniec.fecha_nacimiento) setFechaNacimiento(reniec.fecha_nacimiento);
      setLookupMsg("Datos leídos del escaneo y RENIEC. Puede corregirlos si hace falta.");
    } catch {
      pushToast("No se pudo leer el escaneo. Complete los campos a mano.", "error");
    } finally {
      setLeyendo(false);
    }
  }

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
    if (result.error) {
      setPending(false);
      pushToast(result.error, "error");
      return;
    }
    if (result.relacionId && result.dniDocumentoId && dniFile) {
      const upload = await uploadDocumentoFile(
        lockEntidad ? defaultEntidadId : entidadId,
        result.relacionId,
        result.dniDocumentoId,
        dniFile,
        null,
      );
      if (upload.path) {
        await setDocumentoArchivo(result.relacionId, result.dniDocumentoId, upload.path);
      }
    }
    setPending(false);
    pushToast("Trabajador registrado. Siga con ficha y pensiones.");
    if (result.relacionId) router.push(`/trabajadores/${result.relacionId}?tab=documentos`);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection title="Empresa" hint="Si la persona ya existe por DNI, se reutiliza y se crea el puesto aquí.">
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
        title="DNI escaneado"
        hint="Suba el escaneo. Se intenta leer el número y completar con RENIEC. Si está borroso, escriba los datos."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {previewUrl ? (
              dniFile?.type === "application/pdf" || dniFile?.name.toLowerCase().endsWith(".pdf") ? (
                <iframe title="Vista previa del DNI" src={previewUrl} className="h-64 w-full rounded-md border" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Vista previa del DNI" className="max-h-72 w-full rounded-md border bg-muted object-contain" />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay escaneo.</p>
            )}
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending || leyendo}
              file={dniFile}
              buttonLabel={dniFile ? "Cambiar escaneo" : "Subir DNI escaneado"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={(file) => void aplicarEscaneo(file)}
            />
            {leyendo ? <p className="text-sm text-muted-foreground">Leyendo el escaneo…</p> : null}
          </div>
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
        </div>
        {lookupMsg ? <p className="text-sm text-muted-foreground">{lookupMsg}</p> : null}
      </FormSection>
      <FormSection title="Puesto en esta empresa" hint="Puede completarlo ahora o en el paso Puesto, después de los documentos.">
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
            value={jornada}
            allowEmpty
            options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(event) => setJornada(event.target.value)}
          />
          <HorarioLaboralField jornada={jornada} />
          <DateField label="Fecha de ingreso a la empresa" name="fecha_ingreso" />
        </div>
      </FormSection>
      <Button type="submit" disabled={pending || buscando || leyendo}>
        {pending ? "Guardando…" : "Registrar y continuar a documentos"}
      </Button>
    </form>
  );
}
