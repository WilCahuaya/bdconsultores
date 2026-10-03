"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
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
import { guardarHijosAsignacion, type HijoAsignacionRow } from "@/lib/actions/hijos-asignacion";
import { evaluarHijo, hintArchivoAsignacion, textoResultadoHijo } from "@/lib/asignacion-familiar";
import { ASIGNACION_FAMILIAR_SOLES } from "@/lib/planillas-labels";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { Field, DateField, SelectField } from "@/components/fields";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { DireccionAfpnetFields, direccionAfpnetDesdePersona } from "@/components/ficha/DireccionAfpnetFields";
import { getSignedDocumentoUrl } from "@/lib/storage-url";
import { uploadDocumentoFile } from "@/lib/upload-documento";

export function PreviewEscaneo({
  file,
  remoteUrl,
  esPdf,
  vacio = "Suba el escaneo para verlo aquí.",
}: {
  file: File | null;
  remoteUrl?: string | null;
  esPdf: boolean;
  vacio?: string;
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
    return (
      <div className="flex h-[min(56vh,36rem)] items-center justify-center rounded-md border border-dashed bg-muted/30 p-4">
        <p className="text-center text-sm text-muted-foreground">{vacio}</p>
      </div>
    );
  }
  return esPdf ? (
    <iframe title="Vista previa" src={src} className="h-[min(72vh,44rem)] w-full rounded-md border bg-background" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Vista previa del escaneo" className="h-[min(72vh,44rem)] w-full rounded-md border bg-muted object-contain" />
  );
}

function archivoEsPdf(file: File | null, path: string | null): boolean {
  if (file) return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

function capturaCardClass(alerta: boolean) {
  return alerta
    ? `${panelCardClass} !overflow-visible border-amber-400 bg-amber-50 p-5`
    : `${panelCardClass} !overflow-visible p-5`;
}

function AlertaFaltaDocumento({ nombre }: { nombre: string }) {
  return <p className="text-sm font-medium text-amber-900">Alerta: falta el documento de {nombre}.</p>;
}

export function CapturaDesplegable({
  titulo,
  alerta,
  alertaNombre,
  hint,
  defaultOpen,
  textoListo,
  datos,
  preview,
}: {
  titulo: string;
  alerta: boolean;
  alertaNombre: string;
  hint: string;
  defaultOpen?: boolean;
  textoListo?: string;
  datos: ReactNode;
  preview: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const abiertoAlInicio = useRef(defaultOpen ?? alerta);
  const inicioAplicado = useRef(false);
  const asignarDetails = useCallback((node: HTMLDetailsElement | null) => {
    detailsRef.current = node;
    if (!node || inicioAplicado.current) return;
    inicioAplicado.current = true;
    if (abiertoAlInicio.current) node.open = true;
  }, []);

  function alternar(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const details = detailsRef.current;
    if (!details) return;
    const scroller = details.closest("main");
    const top = scroller?.scrollTop ?? 0;
    details.open = !details.open;
    if (!scroller) return;
    scroller.scrollTop = top;
    requestAnimationFrame(() => {
      scroller.scrollTop = top;
    });
  }

  return (
    <details ref={asignarDetails} className={`group ${capturaCardClass(alerta)}`}>
      <summary
        onClick={alternar}
        className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden [&::marker]:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{titulo}</p>
          {alerta ? (
            <AlertaFaltaDocumento nombre={alertaNombre} />
          ) : (
            <p className="text-sm text-emerald-800">{textoListo ?? "Documento cargado"}</p>
          )}
        </div>
      </summary>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{hint}</p>
          {datos}
        </div>
        <div className="lg:sticky lg:top-4">{preview}</div>
      </div>
    </details>
  );
}

export function FichaAltaDocumentos({
  relacionId,
  entidadId,
  trabajador,
  documentos,
  pension,
  hijos,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  documentos: DocumentoRow[];
  pension: PensionRow | null;
  hijos: HijoAsignacionRow[];
  canWrite: boolean;
}) {
  const dniDoc = documentos.find((d) => d.tipo === "DNI") ?? null;
  const fichaDoc = documentos.find((d) => d.tipo === "FICHA_DATOS") ?? null;
  const pensionDoc = documentos.find((d) => d.tipo === "PENSIONES_FIRMADO") ?? null;
  const asignacionDoc = documentos.find((d) => d.tipo === "ASIGNACION_FAMILIAR") ?? null;
  const recibe = trabajador.recibe_asignacion_familiar;

  return (
    <div className="space-y-4">
      <CapturaDni relacionId={relacionId} entidadId={entidadId} trabajador={trabajador} documento={dniDoc} canWrite={canWrite} />
      <CapturaFicha relacionId={relacionId} entidadId={entidadId} trabajador={trabajador} documento={fichaDoc} canWrite={canWrite} />
      <CapturaPension relacionId={relacionId} entidadId={entidadId} documento={pensionDoc} pension={pension} canWrite={canWrite} />
      {recibe || hijos.length > 0 ? (
        <CapturaAsignacion
          relacionId={relacionId}
          entidadId={entidadId}
          documento={asignacionDoc}
          hijosIniciales={hijos}
          canWrite={canWrite}
        />
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

  const alerta = !file && !documento?.storage_path;
  const preview = (
    <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
  );

  return (
    <CapturaDesplegable
      titulo={TIPO_DOCUMENTO_LABEL.DNI}
      alerta={alerta}
      alertaNombre="DNI"
      hint="Suba el escaneo y complete nombres y fecha. Con 8 dígitos se busca el DNI; con 9, el carné de extranjería. El número de la ficha no se cambia aquí."
      preview={preview}
      datos={
        <>
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir DNI escaneado"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setFile}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="DNI o carné" name="dni_leido" value={dni} copyable onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 9))} readOnly={!canWrite} />
            <Field label="Nombres" name="nombres" value={nombres} onChange={(event) => setNombres(event.target.value)} readOnly={!canWrite} />
            <Field label="Apellido paterno" name="apellido_paterno" value={apellidoPaterno} onChange={(event) => setApellidoPaterno(event.target.value)} readOnly={!canWrite} />
            <Field label="Apellido materno" name="apellido_materno" value={apellidoMaterno} onChange={(event) => setApellidoMaterno(event.target.value)} readOnly={!canWrite} />
            <DateField label="Fecha de nacimiento" name="fecha_nacimiento" value={fechaNacimiento} onChange={setFechaNacimiento} readOnly={!canWrite} />
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending || (dni.length !== 8 && dni.length !== 9)} onClick={() => void buscarReniec()}>
                Buscar en RENIEC
              </Button>
              <Button type="button" disabled={pending} onClick={() => void guardar()}>
                {pending ? "Guardando…" : "Guardar datos del DNI"}
              </Button>
            </div>
          ) : null}
        </>
      }
    />
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
  const [pending, setPending] = useState(false);
  const [celular, setCelular] = useState(p.celular ?? "");
  const [correo, setCorreo] = useState(p.correo ?? "");
  const [direccion, setDireccion] = useState(() => direccionAfpnetDesdePersona(p));
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
    form.set("tipo_via", direccion.tipo_via);
    form.set("via_nombre", direccion.via_nombre);
    form.set("via_numero", direccion.via_numero);
    form.set("referencia", direccion.referencia);
    form.set("distrito", direccion.distrito);
    form.set("provincia", direccion.provincia);
    form.set("region", direccion.region);
    form.set("direccion", "");
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

  const alerta = !file && !documento?.storage_path;
  const preview = (
    <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
  );

  return (
    <CapturaDesplegable
      titulo={TIPO_DOCUMENTO_LABEL.FICHA_DATOS}
      alerta={alerta}
      alertaNombre="ficha de datos personales"
      hint="Suba el escaneo y complete la dirección: región, provincia, distrito, tipo de vía y número. Eso se copia en AFPNet y queda armado para la ficha, por ejemplo Av. Grau 123 - El Tambo - Huancayo - Junín."
      preview={preview}
      datos={
        <>
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir ficha escaneada"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setFile}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Celular" name="celular" value={celular} inputMode="tel" onChange={(event) => setCelular(event.target.value)} readOnly={!canWrite} />
            <Field label="Correo" name="correo" type="email" value={correo} onChange={(event) => setCorreo(event.target.value)} readOnly={!canWrite} />
            <DireccionAfpnetFields value={direccion} onChange={setDireccion} canWrite={canWrite} />
            <SelectField
              label="¿Recibe asignación familiar?"
              name="recibe_asignacion_familiar"
              value={recibe}
              allowEmpty
              disabled={!canWrite}
              options={[
                { value: "si", label: `Sí · S/ ${ASIGNACION_FAMILIAR_SOLES.toFixed(2)}` },
                { value: "no", label: "No" },
              ]}
              onChange={(event) => setRecibe(event.target.value)}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Si marca Sí, registre los hijos en Asignación familiar. Los S/ {ASIGNACION_FAMILIAR_SOLES.toFixed(2)} quedan solo cuando al menos uno corresponde.
            </p>
          </div>
          {canWrite ? (
            <Button type="button" disabled={pending} onClick={() => void guardar()}>
              {pending ? "Guardando…" : "Guardar datos de la ficha"}
            </Button>
          ) : null}
        </>
      }
    />
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

  const alerta = !file && !documento?.storage_path;
  const preview = (
    <PreviewEscaneo file={file} remoteUrl={file ? null : remoteUrl} esPdf={archivoEsPdf(file, documento?.storage_path ?? null)} />
  );

  return (
    <CapturaDesplegable
      titulo={TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}
      alerta={alerta}
      alertaNombre="sistema de pensiones firmado"
      hint="Suba el sistema de pensiones firmado e indique AFP u ONP. Si es AFP, el alta queda válida con el nombre de AFP y el CUSPP. El documento de alta AFP es opcional."
      preview={preview}
      datos={
        <>
          {canWrite ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar escaneo" : "Subir sistema de pensiones"}
              emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setFile}
            />
          ) : null}
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
          {canWrite ? (
            <Button type="button" disabled={pending} onClick={() => void guardar()}>
              {pending ? "Guardando…" : "Guardar AFP u ONP"}
            </Button>
          ) : null}
        </>
      }
    />
  );
}

type HijoForm = {
  key: string;
  nombre: string;
  fecha: string;
  menor: boolean;
  estudios: boolean;
  discapacidad: boolean;
};

function hijoFormDe(row: HijoAsignacionRow): HijoForm {
  return {
    key: row.id,
    nombre: row.nombre,
    fecha: row.fecha_nacimiento,
    menor: row.menor,
    estudios: row.estudios_superiores,
    discapacidad: row.discapacidad,
  };
}

function CapturaAsignacion({
  relacionId,
  entidadId,
  documento,
  hijosIniciales,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  documento: DocumentoRow | null;
  hijosIniciales: HijoAsignacionRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hijos, setHijos] = useState<HijoForm[]>(() => hijosIniciales.map(hijoFormDe));
  const firma = hijosIniciales.map((hijo) => hijo.id).join("|");

  useEffect(() => {
    setHijos(hijosIniciales.map(hijoFormDe));
  }, [firma]);

  useEffect(() => {
    if (!documento?.storage_path) {
      setRemoteUrl(null);
      return;
    }
    void getSignedDocumentoUrl(documento.storage_path).then((result) => {
      if (result.url) setRemoteUrl(result.url);
    });
  }, [documento?.storage_path]);

  const evaluaciones = hijos.map((hijo) =>
    evaluarHijo({
      fechaNacimiento: hijo.fecha,
      menor: hijo.menor,
      estudios: hijo.estudios,
      discapacidad: hijo.discapacidad,
    }),
  );
  const corresponde = evaluaciones.some((item) => item.corresponde);
  const tieneArchivo = Boolean(file || documento?.storage_path);
  const pideArchivo = hijos.length === 0 || corresponde;
  const hint =
    hijos.length === 0
      ? "Agregue cada hijo con nombre completo y fecha de nacimiento. Marque si es menor de 18, por estudios superiores o por discapacidad."
      : hintArchivoAsignacion(evaluaciones);

  function actualizar(key: string, patch: Partial<HijoForm>) {
    setHijos((actual) => actual.map((hijo) => (hijo.key === key ? { ...hijo, ...patch } : hijo)));
  }

  async function guardar() {
    if (hijos.length === 0) {
      pushToast("Agregue al menos un hijo.", "error");
      return;
    }
    setPending(true);
    const saved = await guardarHijosAsignacion(
      relacionId,
      hijos.map((hijo) => ({
        nombre: hijo.nombre,
        fechaNacimiento: hijo.fecha,
        menor: hijo.menor,
        estudios: hijo.estudios,
        discapacidad: hijo.discapacidad,
      })),
    );
    if (saved.error) {
      setPending(false);
      pushToast(saved.error, "error");
      return;
    }
    if (saved.recibe && !file && !documento?.storage_path) {
      setPending(false);
      pushToast("Hijos guardados. Falta el archivo con el sustento.", "error");
      router.refresh();
      return;
    }
    if (saved.recibe && file && documento) {
      const upload = await uploadDocumentoFile(entidadId, relacionId, documento.id, file, documento.storage_path);
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir el documento.", "error");
        router.refresh();
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documento.id, upload.path);
      if (savedFile.error) {
        setPending(false);
        pushToast(savedFile.error, "error");
        router.refresh();
        return;
      }
    }
    setPending(false);
    setFile(null);
    pushToast(
      saved.recibe
        ? "Asignación familiar guardada."
        : "Hijos guardados. Con estos datos no corresponde la asignación.",
    );
    router.refresh();
  }

  const preview = (
    <PreviewEscaneo
      file={file}
      remoteUrl={file ? null : remoteUrl}
      esPdf={archivoEsPdf(file, documento?.storage_path ?? null)}
      vacio="Suba el archivo único de asignación familiar para verlo aquí."
    />
  );

  return (
    <CapturaDesplegable
      titulo={TIPO_DOCUMENTO_LABEL.ASIGNACION_FAMILIAR}
      alerta={pideArchivo && !tieneArchivo}
      alertaNombre="asignación familiar"
      textoListo={corresponde ? "Documento cargado" : "No corresponde asignación"}
      hint={hint}
      preview={preview}
      datos={
        <div className="space-y-4">
          {hijos.length > 0 ? (
            <p className="text-sm font-medium">
              {corresponde ? `Corresponde S/ ${ASIGNACION_FAMILIAR_SOLES.toFixed(2)}.` : "No corresponde la asignación."}
            </p>
          ) : null}
          {hijos.map((hijo, index) => {
            const evaluacion = evaluaciones[index];
            return (
              <div key={hijo.key} className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Nombre completo"
                    name={`hijo_nombre_${hijo.key}`}
                    value={hijo.nombre}
                    readOnly={!canWrite}
                    onChange={(event) => actualizar(hijo.key, { nombre: event.target.value })}
                  />
                  <DateField
                    label="Fecha de nacimiento"
                    name={`hijo_nacimiento_${hijo.key}`}
                    value={hijo.fecha}
                    readOnly={!canWrite}
                    onChange={(value) => actualizar(hijo.key, { fecha: value })}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hijo.menor}
                      disabled={!canWrite}
                      onChange={(event) => actualizar(hijo.key, { menor: event.target.checked })}
                    />
                    Menor de 18
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hijo.estudios}
                      disabled={!canWrite}
                      onChange={(event) => actualizar(hijo.key, { estudios: event.target.checked })}
                    />
                    Estudios superiores
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hijo.discapacidad}
                      disabled={!canWrite}
                      onChange={(event) => actualizar(hijo.key, { discapacidad: event.target.checked })}
                    />
                    Discapacidad
                  </label>
                </div>
                {evaluacion ? (
                  <div className="space-y-1 text-sm">
                    <p className={evaluacion.corresponde ? "text-emerald-800" : "text-muted-foreground"}>
                      {textoResultadoHijo(evaluacion)}
                    </p>
                    {evaluacion.avisos.map((aviso) => (
                      <p key={aviso} className="text-amber-900">
                        {aviso}
                      </p>
                    ))}
                  </div>
                ) : null}
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setHijos((actual) => actual.filter((item) => item.key !== hijo.key))}
                  >
                    Quitar hijo
                  </Button>
                ) : null}
              </div>
            );
          })}
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                setHijos((actual) => [
                  ...actual,
                  { key: crypto.randomUUID(), nombre: "", fecha: "", menor: false, estudios: false, discapacidad: false },
                ])
              }
            >
              Agregar hijo
            </Button>
          ) : null}
          {canWrite && (corresponde || file || documento?.storage_path) ? (
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={file}
              buttonLabel={file || documento?.storage_path ? "Cambiar archivo" : "Subir asignación familiar"}
              emptyLabel="Un solo archivo. PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setFile}
            />
          ) : null}
          {canWrite ? (
            <Button type="button" disabled={pending || !documento} onClick={() => void guardar()}>
              {pending ? "Guardando…" : "Guardar asignación familiar"}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
