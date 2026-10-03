"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { consultarDni } from "@/lib/actions/entidades";
import { setDocumentoArchivo } from "@/lib/actions/ficha";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { Field, DateField, SelectField } from "@/components/fields";
import { CapturaDesplegable, PreviewEscaneo } from "@/components/ficha/FichaAltaDocumentos";
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
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [entidadId, setEntidadId] = useState(defaultEntidadId);
  const [yaBaja, setYaBaja] = useState(false);
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [fechaCese, setFechaCese] = useState("");
  const [motivoBaja, setMotivoBaja] = useState<"CARTA_RENUNCIA" | "TERMINO_CONTRATO">("CARTA_RENUNCIA");
  const [bajaFile, setBajaFile] = useState<File | null>(null);

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
    if (yaBaja && !bajaFile) {
      pushToast(
        motivoBaja === "CARTA_RENUNCIA" ? "Suba la carta de renuncia." : "Suba el documento de T-Registro baja.",
        "error",
      );
      return;
    }
    setPending(true);
    const result = await createTrabajador(formData);
    const empresaId = lockEntidad ? defaultEntidadId : entidadId;
    if (result.error && !result.relacionId) {
      setPending(false);
      pushToast(result.error, "error");
      return;
    }
    if (result.relacionId && result.dniDocumentoId && dniFile) {
      const upload = await uploadDocumentoFile(empresaId, result.relacionId, result.dniDocumentoId, dniFile, null);
      if (upload.path) await setDocumentoArchivo(result.relacionId, result.dniDocumentoId, upload.path);
    }
    if (result.relacionId && result.bajaDocumentoId && bajaFile) {
      const upload = await uploadDocumentoFile(empresaId, result.relacionId, result.bajaDocumentoId, bajaFile, null);
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir el documento de baja.", "error");
        router.push(`/?entidadId=${empresaId}&bajas=1`);
        return;
      }
      const saved = await setDocumentoArchivo(result.relacionId, result.bajaDocumentoId, upload.path);
      if (saved.error) {
        setPending(false);
        pushToast(saved.error, "error");
        router.push(`/?entidadId=${empresaId}&bajas=1`);
        return;
      }
    }
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      if (result.relacionId) {
        router.push(yaBaja ? `/?entidadId=${empresaId}&bajas=1` : `/contratos/${result.relacionId}?paso=documentos`);
      }
      return;
    }
    if (yaBaja) {
      pushToast("Trabajador de baja guardado. Aparece al marcar Mostrar bajas.");
      router.push(`/?entidadId=${empresaId}&bajas=1`);
      return;
    }
    pushToast("Siga con documentos, persona y puesto en Contratos.");
    if (result.relacionId) router.push(`/contratos/${result.relacionId}?paso=documentos`);
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
      {yaBaja ? <input type="hidden" name="ya_baja" value="1" /> : null}

      <AltaPasosNav tab="documentos" />

      <p className="text-sm text-muted-foreground">
        Primero los escaneos. Al lado de cada uno, complete a mano los datos que más adelante usa Persona y el contrato.
        En Sistema de pensión, en este paso solo se marca AFP u ONP.
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

      <CapturaDesplegable
        titulo={TIPO_DOCUMENTO_LABEL.DNI}
        alerta={!dniFile}
        alertaNombre="DNI"
        hint="Suba el escaneo y complete el DNI (8 dígitos) o el carné de extranjería (9 dígitos). Buscar en RENIEC trae nombres y fecha."
        preview={<PreviewEscaneo file={dniFile} esPdf={esPdf} />}
        datos={
          <>
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={dniFile}
              buttonLabel={dniFile ? "Cambiar escaneo" : "Subir DNI escaneado"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setDniFile}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="DNI o carné"
                name="dni_vista"
                required
                inputMode="numeric"
                maxLength={9}
                pattern="[0-9]{8,9}"
                title="8 dígitos del DNI o 9 del carné de extranjería"
                value={dni}
                onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 9))}
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
              <Field
                label="Nº"
                name="numero"
                required
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{1,4}"
                placeholder="01"
                title="Número del trabajador, por ejemplo 01"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={yaBaja}
                onChange={(event) => setYaBaja(event.target.checked)}
              />
              Ya está de baja
            </label>
            {yaBaja ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  El número puede coincidir con el de un trabajador activo. Esta ficha no entra en la lista de actuales.
                </p>
                <DateField
                  label="Fecha de ingreso a la empresa"
                  name="fecha_ingreso"
                  required
                  value={fechaIngreso}
                  onChange={setFechaIngreso}
                />
                <DateField
                  label="Fecha de cese en la empresa"
                  name="fecha_cese"
                  required
                  value={fechaCese}
                  onChange={setFechaCese}
                />
                <SelectField
                  label="Motivo de baja"
                  name="tipo_baja"
                  value={motivoBaja}
                  options={[
                    { value: "CARTA_RENUNCIA", label: TIPO_DOCUMENTO_LABEL.CARTA_RENUNCIA },
                    { value: "TERMINO_CONTRATO", label: TIPO_DOCUMENTO_LABEL.TERMINO_CONTRATO },
                  ]}
                  onChange={(event) => {
                    setMotivoBaja(event.target.value as "CARTA_RENUNCIA" | "TERMINO_CONTRATO");
                    setBajaFile(null);
                  }}
                />
                <FileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={pending}
                  file={bajaFile}
                  buttonLabel={
                    bajaFile
                      ? "Cambiar archivo"
                      : motivoBaja === "CARTA_RENUNCIA"
                        ? "Subir carta de renuncia"
                        : "Subir T-Registro baja"
                  }
                  emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                  onFileChange={setBajaFile}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={buscando || pending || (dni.length !== 8 && dni.length !== 9)} onClick={() => void buscarPorDni()}>
                {buscando ? "Consultando…" : "Buscar en RENIEC"}
              </Button>
              <Button type="submit" disabled={pending || buscando}>
                {pending ? "Guardando…" : yaBaja ? "Guardar baja" : "Guardar datos del DNI"}
              </Button>
            </div>
          </>
        }
      />

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
