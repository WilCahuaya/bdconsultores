"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import type { TipoPension } from "@inventario/types";
import { consultarDni } from "@/lib/actions/entidades";
import {
  guardarDatosDniEscaneo,
  guardarDatosFichaEscaneo,
  guardarTipoPensionAlta,
  setDocumentoArchivo,
  type DocumentoRow,
  type PensionRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { leerTextoEscaneo } from "@/lib/ocr-documento";
import {
  extraerAsignacionFamiliarDeTexto,
  extraerCelularDeTexto,
  extraerCorreoDeTexto,
  extraerDireccionDeTexto,
  extraerDniDeTexto,
  extraerTipoPensionDeTexto,
} from "@/lib/parse-ocr-alta";
import { Field, DateField, SelectField } from "@/components/fields";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { getSignedDocumentoUrl } from "@/lib/storage-url";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { FichaDocumentos } from "@/components/ficha/FichaDocumentos";

function PreviewEscaneo({
  file,
  remoteUrl,
  esPdf,
}: {
  file: File | null;
  remoteUrl?: string | null;
  esPdf: boolean;
}) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = localUrl ?? remoteUrl ?? null;
  if (!src) {
    return <p className="text-sm text-muted-foreground">Suba el escaneo para verlo aquí. Si está borroso, complete los campos a mano.</p>;
  }
  if (esPdf) {
    return <iframe title="Vista previa" src={src} className="h-72 w-full rounded-md border bg-background" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Vista previa del escaneo" className="max-h-80 w-full rounded-md border bg-muted object-contain" />
  );
}

function archivoEsPdf(file: File | null, path: string | null): boolean {
  if (file) return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

export function FichaAltaDocumentos({
  relacionId,
  entidadId,
  trabajador,
  documentos,
  pension,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  documentos: DocumentoRow[];
  pension: PensionRow | null;
  canWrite: boolean;
}) {
  const dniDoc = documentos.find((d) => d.tipo === "DNI") ?? null;
  const fichaDoc = documentos.find((d) => d.tipo === "FICHA_DATOS") ?? null;
  const pensionDoc = documentos.find((d) => d.tipo === "PENSIONES_FIRMADO") ?? null;
  const asignacionDoc = documentos.find((d) => d.tipo === "ASIGNACION_FAMILIAR") ?? null;
  const recibe = trabajador.recibe_asignacion_familiar;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Empiece por los escaneos. La aplicación intenta leerlos y rellenar los campos; si sale borroso, complete a mano.
        En pensiones, en este paso solo se marca AFP u ONP.
      </p>
      <CapturaDni relacionId={relacionId} entidadId={entidadId} trabajador={trabajador} documento={dniDoc} canWrite={canWrite} />
      <CapturaFicha relacionId={relacionId} entidadId={entidadId} trabajador={trabajador} documento={fichaDoc} canWrite={canWrite} />
      <CapturaPension relacionId={relacionId} entidadId={entidadId} documento={pensionDoc} pension={pension} canWrite={canWrite} />
      {recibe ? (
        <div className={`${panelCardClass} space-y-3 p-5`}>
          <p className="text-sm font-medium">Asignación familiar</p>
          <p className="text-sm text-muted-foreground">La ficha indica que sí recibe. Suba el sustento.</p>
          <FichaDocumentos
            relacionId={relacionId}
            entidadId={entidadId}
            documentos={asignacionDoc ? [asignacionDoc] : []}
            canWrite={canWrite}
            tiposFiltro={["ASIGNACION_FAMILIAR"]}
            permitirAgregar={!asignacionDoc}
            hint="Partida o documento de asignación familiar. PDF o imagen. Máximo 10 MB."
          />
        </div>
      ) : null}
    </div>
  );
}

function CapturaDni({
  relacionId,
  entidadId,
  trabajador,
  documento,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  documento: DocumentoRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const p = trabajador.persona;
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [pending, setPending] = useState(false);
  const [dni, setDni] = useState(p.dni);
  const [nombres, setNombres] = useState(p.nombres);
  const [apellidoPaterno, setApellidoPaterno] = useState(p.apellido_paterno ?? "");
  const [apellidoMaterno, setApellidoMaterno] = useState(p.apellido_materno ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(p.fecha_nacimiento ?? "");

  useEffect(() => {
    if (!documento?.storage_path) {
      setRemoteUrl(null);
      return;
    }
    void getSignedDocumentoUrl(documento.storage_path).then((result) => {
      if (result.url) setRemoteUrl(result.url);
    });
  }, [documento?.storage_path]);

  async function onFile(next: File | null) {
    setFile(next);
    if (!next || !canWrite) return;
    setLeyendo(true);
    try {
      const texto = await leerTextoEscaneo(next);
      const leido = extraerDniDeTexto(texto);
      if (leido) {
        setDni(leido);
        const reniec = await consultarDni(leido);
        if (!reniec.error) {
          if (reniec.nombres) setNombres(reniec.nombres);
          setApellidoPaterno(reniec.apellido_paterno ?? "");
          setApellidoMaterno(reniec.apellido_materno ?? "");
          if (reniec.fecha_nacimiento) setFechaNacimiento(reniec.fecha_nacimiento);
          pushToast("Se leyeron datos del DNI. Revíselos antes de guardar.");
        } else {
          pushToast("Se leyó el número. Complete el resto a mano o busque en RENIEC.", "error");
        }
      } else {
        pushToast("No se pudo leer el DNI. Está borroso o de costado: complete los campos a mano.", "error");
      }
    } catch {
      pushToast("No se pudo leer el escaneo. Complete los campos a mano.", "error");
    } finally {
      setLeyendo(false);
    }
  }

  async function buscarReniec() {
    setPending(true);
    const result = await consultarDni(dni);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    if (result.nombres) setNombres(result.nombres);
    setApellidoPaterno(result.apellido_paterno ?? "");
    setApellidoMaterno(result.apellido_materno ?? "");
    if (result.fecha_nacimiento) setFechaNacimiento(result.fecha_nacimiento);
    pushToast("Datos traídos de RENIEC.");
  }

  async function guardar() {
    if (!documento) return;
    setPending(true);
    if (file) {
      const upload = await uploadDocumentoFile(entidadId, relacionId, documento.id, file, documento.storage_path);
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir el DNI.", "error");
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documento.id, upload.path);
      if (savedFile.error) {
        setPending(false);
        pushToast(savedFile.error, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("nombres", nombres);
    form.set("apellido_paterno", apellidoPaterno);
    form.set("apellido_materno", apellidoMaterno);
    form.set("fecha_nacimiento", fechaNacimiento);
    const saved = await guardarDatosDniEscaneo(relacionId, form);
    setPending(false);
    if (saved.error) {
      pushToast(saved.error, "error");
      return;
    }
    setFile(null);
    pushToast("Datos del DNI guardados.");
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-4 p-5`}>
      <div>
        <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.DNI}</p>
        <p className="text-sm text-muted-foreground">Escaneo. Se intenta el número y luego RENIEC. El DNI de la ficha no se cambia aquí.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending || leyendo}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir DNI escaneado"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={(next) => void onFile(next)}
            />
          ) : null}
          {leyendo ? <p className="text-sm text-muted-foreground">Leyendo el escaneo…</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI leído" name="dni_leido" value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))} readOnly={!canWrite} />
          <Field label="Nombres" name="nombres" value={nombres} onChange={(event) => setNombres(event.target.value)} readOnly={!canWrite} />
          <Field label="Apellido paterno" name="apellido_paterno" value={apellidoPaterno} onChange={(event) => setApellidoPaterno(event.target.value)} readOnly={!canWrite} />
          <Field label="Apellido materno" name="apellido_materno" value={apellidoMaterno} onChange={(event) => setApellidoMaterno(event.target.value)} readOnly={!canWrite} />
          <DateField label="Fecha de nacimiento" name="fecha_nacimiento" value={fechaNacimiento} onChange={setFechaNacimiento} readOnly={!canWrite} />
        </div>
      </div>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending || leyendo || dni.length < 8} onClick={() => void buscarReniec()}>
            Buscar en RENIEC
          </Button>
          <Button type="button" disabled={pending || leyendo} onClick={() => void guardar()}>
            {pending ? "Guardando…" : "Guardar datos del DNI"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CapturaFicha({
  relacionId,
  entidadId,
  trabajador,
  documento,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  documento: DocumentoRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const p = trabajador.persona;
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [pending, setPending] = useState(false);
  const [celular, setCelular] = useState(p.celular ?? "");
  const [correo, setCorreo] = useState(p.correo ?? "");
  const [direccion, setDireccion] = useState(p.direccion ?? "");
  const [recibe, setRecibe] = useState(
    trabajador.recibe_asignacion_familiar === true ? "si" : trabajador.recibe_asignacion_familiar === false ? "no" : "",
  );

  useEffect(() => {
    if (!documento?.storage_path) {
      setRemoteUrl(null);
      return;
    }
    void getSignedDocumentoUrl(documento.storage_path).then((result) => {
      if (result.url) setRemoteUrl(result.url);
    });
  }, [documento?.storage_path]);

  async function onFile(next: File | null) {
    setFile(next);
    if (!next || !canWrite) return;
    setLeyendo(true);
    try {
      const texto = await leerTextoEscaneo(next);
      const cel = extraerCelularDeTexto(texto);
      const mail = extraerCorreoDeTexto(texto);
      const dir = extraerDireccionDeTexto(texto);
      const asig = extraerAsignacionFamiliarDeTexto(texto);
      if (cel) setCelular(cel);
      if (mail) setCorreo(mail);
      if (dir) setDireccion(dir);
      if (asig === true) setRecibe("si");
      if (asig === false) setRecibe("no");
      if (cel || mail || dir || asig !== null) {
        pushToast("Se leyeron datos de la ficha. Revíselos antes de guardar.");
      } else {
        pushToast("No se pudo leer la ficha. Complete los campos mirando el escaneo.", "error");
      }
    } catch {
      pushToast("No se pudo leer el escaneo. Complete los campos a mano.", "error");
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    if (!documento) return;
    setPending(true);
    if (file) {
      const upload = await uploadDocumentoFile(entidadId, relacionId, documento.id, file, documento.storage_path);
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir la ficha.", "error");
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documento.id, upload.path);
      if (savedFile.error) {
        setPending(false);
        pushToast(savedFile.error, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("celular", celular);
    form.set("correo", correo);
    form.set("direccion", direccion);
    form.set("recibe_asignacion_familiar", recibe);
    const saved = await guardarDatosFichaEscaneo(relacionId, form);
    setPending(false);
    if (saved.error) {
      pushToast(saved.error, "error");
      return;
    }
    setFile(null);
    pushToast("Datos de la ficha guardados.");
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-4 p-5`}>
      <div>
        <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.FICHA_DATOS}</p>
        <p className="text-sm text-muted-foreground">De aquí salen dirección, celular, correo y si recibe asignación familiar.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending || leyendo}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir ficha escaneada"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={(next) => void onFile(next)}
            />
          ) : null}
          {leyendo ? <p className="text-sm text-muted-foreground">Leyendo el escaneo…</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Celular" name="celular" value={celular} onChange={(event) => setCelular(event.target.value)} readOnly={!canWrite} />
          <Field label="Correo" name="correo" type="email" value={correo} onChange={(event) => setCorreo(event.target.value)} readOnly={!canWrite} />
          <div className="sm:col-span-2">
            <Field label="Dirección" name="direccion" value={direccion} onChange={(event) => setDireccion(event.target.value)} readOnly={!canWrite} />
          </div>
          <SelectField
            label="¿Recibe asignación familiar?"
            name="recibe_asignacion_familiar"
            value={recibe}
            allowEmpty
            disabled={!canWrite}
            options={[
              { value: "si", label: "Sí" },
              { value: "no", label: "No" },
            ]}
            onChange={(event) => setRecibe(event.target.value)}
          />
        </div>
      </div>
      {canWrite ? (
        <Button type="button" disabled={pending || leyendo} onClick={() => void guardar()}>
          {pending ? "Guardando…" : "Guardar datos de la ficha"}
        </Button>
      ) : null}
    </section>
  );
}

function CapturaPension({
  relacionId,
  entidadId,
  documento,
  pension,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  documento: DocumentoRow | null;
  pension: PensionRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [pending, setPending] = useState(false);
  const [tipo, setTipo] = useState<TipoPension | "">(pension?.tipo ?? "");

  useEffect(() => {
    if (!documento?.storage_path) {
      setRemoteUrl(null);
      return;
    }
    void getSignedDocumentoUrl(documento.storage_path).then((result) => {
      if (result.url) setRemoteUrl(result.url);
    });
  }, [documento?.storage_path]);

  async function onFile(next: File | null) {
    setFile(next);
    if (!next || !canWrite) return;
    setLeyendo(true);
    try {
      const texto = await leerTextoEscaneo(next);
      const leido = extraerTipoPensionDeTexto(texto);
      if (leido) {
        setTipo(leido);
        pushToast(`Se leyó ${leido}. Revíselo antes de guardar.`);
      } else {
        pushToast("No se vio si es AFP u ONP. Márquelo a mano.", "error");
      }
    } catch {
      pushToast("No se pudo leer el escaneo. Marque AFP u ONP a mano.", "error");
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    if (!documento) return;
    setPending(true);
    if (file) {
      const upload = await uploadDocumentoFile(entidadId, relacionId, documento.id, file, documento.storage_path);
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir el documento.", "error");
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documento.id, upload.path);
      if (savedFile.error) {
        setPending(false);
        pushToast(savedFile.error, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("tipo", tipo);
    const saved = await guardarTipoPensionAlta(relacionId, form);
    setPending(false);
    if (saved.error) {
      pushToast(saved.error, "error");
      return;
    }
    setFile(null);
    pushToast("Sistema de pensiones guardado.");
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-4 p-5`}>
      <div>
        <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}</p>
        <p className="text-sm text-muted-foreground">
          En el alta solo se indica AFP u ONP. Nombre de AFP, CUSPP y trámite se registran después, cuando el estudio da de alta la AFP.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending || leyendo}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir sistema de pensiones"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={(next) => void onFile(next)}
            />
          ) : null}
          {leyendo ? <p className="text-sm text-muted-foreground">Leyendo el escaneo…</p> : null}
        </div>
        <SelectField
          label="Sistema"
          name="tipo"
          value={tipo}
          allowEmpty
          disabled={!canWrite}
          options={[
            { value: "AFP", label: "AFP" },
            { value: "ONP", label: "ONP" },
          ]}
          onChange={(event) => setTipo(event.target.value as TipoPension | "")}
        />
      </div>
      {canWrite ? (
        <Button type="button" disabled={pending || leyendo} onClick={() => void guardar()}>
          {pending ? "Guardando…" : "Guardar AFP u ONP"}
        </Button>
      ) : null}
    </section>
  );
}
