"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { consultarDni } from "@/lib/actions/entidades";
import { setDocumentoArchivo } from "@/lib/actions/ficha";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { Field, DateField, SelectField } from "@/components/fields";
import { AltaPasosNav } from "@/components/ficha/FichaTabs";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
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
  const [pending, setPending] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
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

  async function buscarPorDni() {
    setBuscando(true);
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
    pushToast("Datos traídos de RENIEC.");
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await createTrabajador(formData);
    if (result.error && !result.relacionId) {
      setPending(false);
      pushToast(result.error, "error");
      return;
    }
    if (result.error && result.relacionId) {
      pushToast(result.error, "error");
      router.push(`/trabajadores/${result.relacionId}?tab=documentos`);
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
    pushToast("Ficha abierta. Siga con ficha y pensiones.");
    if (result.relacionId) router.push(`/trabajadores/${result.relacionId}?tab=documentos`);
  }

  const esPdf = Boolean(
    dniFile && (dniFile.type === "application/pdf" || dniFile.name.toLowerCase().endsWith(".pdf")),
  );

  return (
    <form action={onSubmit} className="space-y-4">
      {lockEntidad ? <input type="hidden" name="entidad_id" value={defaultEntidadId} /> : null}
      <input type="hidden" name="dni" value={dni} />
      <input type="hidden" name="nombres" value={nombres} />
      <input type="hidden" name="apellido_paterno" value={apellidoPaterno} />
      <input type="hidden" name="apellido_materno" value={apellidoMaterno} />
      <input type="hidden" name="fecha_nacimiento" value={fechaNacimiento} />

      <AltaPasosNav tab="documentos" />

      <p className="text-sm text-muted-foreground">
        Primero los escaneos. Al lado de cada uno, complete a mano los datos que más adelante usa Persona y el contrato.
        En pensiones, en este paso solo se marca AFP u ONP.
      </p>

      {!lockEntidad ? (
        <div className={`${panelCardClass} p-5`}>
          <SelectField
            label="Empresa"
            name="entidad_id"
            value={entidadId}
            options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
            required
            onChange={(event) => setEntidadId(event.target.value)}
          />
        </div>
      ) : null}

      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.DNI}</p>
          <p className="text-sm text-muted-foreground">
            Suba el escaneo y complete nombres y fecha. Sirven para Persona y para el contrato.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {previewUrl ? (
              esPdf ? (
                <iframe title="Vista previa del DNI" src={previewUrl} className="h-72 w-full rounded-md border bg-background" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Vista previa del DNI" className="max-h-80 w-full rounded-md border bg-muted object-contain" />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Suba el escaneo para verlo aquí y complete los campos a mano.</p>
            )}
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={dniFile}
              buttonLabel={dniFile ? "Cambiar escaneo" : "Subir DNI escaneado"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setDniFile}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="DNI"
              name="dni_vista"
              required
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              title="8 dígitos"
              value={dni}
              onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <Field label="Nombres" name="nombres_vista" required value={nombres} onChange={(event) => setNombres(event.target.value)} />
            <Field
              label="Apellido paterno"
              name="apellido_paterno_vista"
              value={apellidoPaterno}
              onChange={(event) => setApellidoPaterno(event.target.value)}
            />
            <Field
              label="Apellido materno"
              name="apellido_materno_vista"
              value={apellidoMaterno}
              onChange={(event) => setApellidoMaterno(event.target.value)}
            />
            <DateField label="Fecha de nacimiento" name="fecha_nacimiento_vista" value={fechaNacimiento} onChange={setFechaNacimiento} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={buscando || pending || dni.length < 8} onClick={() => void buscarPorDni()}>
            {buscando ? "Consultando…" : "Buscar en RENIEC"}
          </Button>
          <Button type="submit" disabled={pending || buscando}>
            {pending ? "Guardando…" : "Guardar datos del DNI"}
          </Button>
        </div>
      </section>

      <section className={`${panelCardClass} space-y-2 p-5 opacity-60`}>
        <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.FICHA_DATOS}</p>
        <p className="text-sm text-muted-foreground">
          Se habilita al guardar el DNI. Ahí se captura dirección, celular, correo y si recibe asignación familiar.
        </p>
      </section>
      <section className={`${panelCardClass} space-y-2 p-5 opacity-60`}>
        <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}</p>
        <p className="text-sm text-muted-foreground">Se habilita al guardar el DNI. En el alta solo se marca AFP u ONP.</p>
      </section>
    </form>
  );
}
