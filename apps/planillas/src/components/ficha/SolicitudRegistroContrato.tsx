"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import {
  desvincularSolicitudContrato,
  guardarArchivoSolicitud,
  registrarSolicitudRegistro,
  vincularContratosASolicitud,
  type ContratoEnlazable,
  type SolicitudRegistroVista,
} from "@/lib/actions/solicitudes-registro";
import { DOCUMENTO_ACCEPT, nombreDescargaDocumento } from "@/lib/documento-storage";
import { nombreBaseSolicitudRegistro } from "@/lib/nombre-archivo";
import { formatFechaPlanilla } from "@/lib/planillas-labels";
import { getSignedDocumentoUrl } from "@/lib/storage-url";
import { quitarArchivoSolicitud, uploadSolicitudFile } from "@/lib/upload-documento";
import { Field } from "@/components/fields";
import { EliminarArchivoSolicitud } from "@/components/ficha/ConfirmarEliminarArchivo";
import { MarcoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";

function nombreSolicitud(solicitud: SolicitudRegistroVista): string {
  if (solicitud.trabajadores.length > 0) {
    return `${nombreBaseSolicitudRegistro(solicitud.trabajadores)}.pdf`;
  }
  const guardado = solicitud.nombre_archivo?.trim();
  if (guardado) {
    return /\.pdf$/i.test(guardado) ? guardado : `${guardado.replace(/\.[^.]+$/, "") || guardado}.pdf`;
  }
  return nombreDescargaDocumento("Solicitud de registro", solicitud.storage_path ?? "solicitud.pdf");
}

function etiquetaSolicitud(solicitud: SolicitudRegistroVista): string {
  const nombre = nombreSolicitud(solicitud);
  const fecha = formatFechaPlanilla(solicitud.created_at);
  const cantidad = solicitud.trabajadores.length;
  const quienes = cantidad === 1 ? "1 trabajador" : `${cantidad} trabajadores`;
  const nota = solicitud.observaciones?.trim();
  const detalle = nota ? `${fecha} · ${quienes} · ${nota}` : `${fecha} · ${quienes}`;
  return `${nombre} · ${detalle}`;
}

export function SolicitudRegistroContrato({
  relacionId,
  entidadId,
  contratoId,
  canWrite,
  cerrado,
  solicitud,
  solicitudes,
  enlazables,
}: {
  relacionId: string;
  entidadId: string;
  contratoId: string;
  canWrite: boolean;
  cerrado: boolean;
  solicitud: SolicitudRegistroVista | null;
  solicitudes: SolicitudRegistroVista[];
  enlazables: ContratoEnlazable[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reemplazo, setReemplazo] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [elegidaId, setElegidaId] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);

  const otras = enlazables.filter((item) => item.contratoId !== contratoId);
  const paraAgregar = otras.filter(
    (item) => item.libre && item.solicitudId !== solicitud?.id,
  );
  const elegida = solicitudes.find((item) => item.id === elegidaId) ?? null;
  const puedeEditar = canWrite && !cerrado;

  function toggle(contrato: string) {
    setMarcados((actual) =>
      actual.includes(contrato) ? actual.filter((id) => id !== contrato) : [...actual, contrato],
    );
  }

  async function descargar() {
    if (!solicitud?.storage_path) return;
    setOpening(true);
    const result = await getSignedDocumentoUrl(solicitud.storage_path, {
      download: nombreSolicitud(solicitud),
    });
    setOpening(false);
    if (result.error || !result.url) {
      pushToast(result.error ?? "No se pudo abrir el archivo.", "error");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function onVincularExistente() {
    if (!elegida) return;
    setPending("vincular");
    const result = await vincularContratosASolicitud(relacionId, elegida.id, [contratoId]);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Solicitud enlazada a este contrato.");
    router.refresh();
  }

  async function onCrear() {
    if (!archivo) {
      pushToast("Seleccione el archivo de la solicitud.", "error");
      return;
    }
    const solicitudId = crypto.randomUUID();
    setPending("crear");
    const upload = await uploadSolicitudFile(entidadId, solicitudId, archivo, null);
    if (upload.error || !upload.path) {
      setPending(null);
      pushToast(upload.error ?? "No se pudo subir el archivo.", "error");
      return;
    }
    const result = await registrarSolicitudRegistro(
      relacionId,
      solicitudId,
      upload.path,
      [contratoId, ...marcados],
      nota,
    );
    if (result.error) {
      await quitarArchivoSolicitud(upload.path);
      setPending(null);
      pushToast(result.error, "error");
      return;
    }
    setArchivo(null);
    setNota("");
    setMarcados([]);
    setPending(null);
    pushToast("Solicitud guardada. Quienes la comparten ya pueden verla.");
    router.refresh();
  }

  async function onReemplazar() {
    if (!solicitud || !reemplazo) return;
    setPending("reemplazar");
    const upload = await uploadSolicitudFile(entidadId, solicitud.id, reemplazo, solicitud.storage_path);
    if (upload.error || !upload.path) {
      setPending(null);
      pushToast(upload.error ?? "No se pudo subir el archivo.", "error");
      return;
    }
    const result = await guardarArchivoSolicitud(relacionId, solicitud.id, upload.path);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setReemplazo(null);
    pushToast("Archivo actualizado para todos los que comparten esta solicitud.");
    router.refresh();
  }

  async function onAgregar() {
    if (!solicitud || marcados.length === 0) return;
    setPending("agregar");
    const result = await vincularContratosASolicitud(relacionId, solicitud.id, marcados);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMarcados([]);
    pushToast("Trabajadores agregados a la solicitud.");
    router.refresh();
  }

  async function onQuitar() {
    setPending("quitar");
    const result = await desvincularSolicitudContrato(relacionId, contratoId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Este contrato ya no usa esa solicitud.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Solicitud de registro de contratos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          También valida el contrato. Si el documento incluye a varias personas, súbalo una vez y márquelas: cada una lo ve en su contrato.
        </p>
      </div>
      <MarcoPrevisualizacion
        sinBotonDescarga
        titulo="Solicitud de registro de contratos"
        storagePath={reemplazo || archivo ? null : solicitud?.storage_path}
        file={reemplazo ?? archivo}
      >
      {solicitud?.storage_path ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Archivo: {nombreSolicitud(solicitud)}
            {solicitud.observaciones?.trim() ? ` · ${solicitud.observaciones.trim()}` : ""}
            {solicitud.trabajadores.length > 0
              ? `. La ven: ${solicitud.trabajadores.map((item) => item.etiqueta).join(", ")}.`
              : "."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={opening} onClick={() => void descargar()}>
              {opening ? "Preparando…" : "Descargar"}
            </Button>
            {puedeEditar ? (
              <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void onQuitar()}>
                {pending === "quitar" ? "Quitando…" : "Quitar de este contrato"}
              </Button>
            ) : null}
            {canWrite ? (
              <EliminarArchivoSolicitud relacionId={relacionId} solicitudId={solicitud.id} disabled={pending !== null} />
            ) : null}
          </div>
          {canWrite ? (
            <div className="space-y-2">
              <DocumentoFileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={pending !== null}
                file={reemplazo}
                buttonLabel={reemplazo ? "Cambiar archivo" : "Reemplazar archivo"}
                emptyLabel="El reemplazo se ve en todos los contratos que comparten esta solicitud."
                onFileChange={setReemplazo}
              />
              {reemplazo ? (
                <Button type="button" size="sm" disabled={pending !== null} onClick={() => void onReemplazar()}>
                  {pending === "reemplazar" ? "Guardando…" : "Guardar reemplazo"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {puedeEditar && paraAgregar.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Agregar trabajadores a esta solicitud</p>
              <ListaTrabajadores items={paraAgregar} marcados={marcados} disabled={pending !== null} onToggle={toggle} />
              <Button type="button" size="sm" disabled={pending !== null || marcados.length === 0} onClick={() => void onAgregar()}>
                {pending === "agregar" ? "Agregando…" : "Agregar"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : puedeEditar ? (
        <div className="space-y-4">
          {solicitudes.some((item) => item.storage_path) ? (
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Usar una solicitud ya subida</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={elegidaId}
                  onChange={(event) => setElegidaId(event.target.value)}
                >
                  <option value="">Elegir…</option>
                  {solicitudes
                    .filter((item) => item.storage_path)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {etiquetaSolicitud(item)}
                      </option>
                    ))}
                </select>
              </label>
              {elegida && elegida.trabajadores.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ya la ven: {elegida.trabajadores.map((item) => item.etiqueta).join(", ")}.
                </p>
              ) : null}
              <Button type="button" size="sm" disabled={!elegida || pending !== null} onClick={() => void onVincularExistente()}>
                {pending === "vincular" ? "Enlazando…" : "Usar en este contrato"}
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            <p className="text-sm font-medium">Subir una nueva</p>
            <Field
              label="Nota"
              name="nota_solicitud"
              value={nota}
              maxLength={200}
              placeholder="Opcional. Por ejemplo, el mes del registro."
              onChange={(event) => setNota(event.target.value)}
            />
            <DocumentoFileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending !== null}
              file={archivo}
              buttonLabel={archivo ? "Cambiar archivo" : "Seleccionar PDF o imagen"}
              emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
              onFileChange={setArchivo}
            />
            {paraAgregar.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Este contrato queda incluido. Solo aparecen versiones libres (sin solicitud o con fecha fin vencida).
                </p>
                <ListaTrabajadores items={paraAgregar} marcados={marcados} disabled={pending !== null} onToggle={toggle} />
              </div>
            ) : null}
            <Button type="button" size="sm" disabled={pending !== null || !archivo} onClick={() => void onCrear()}>
              {pending === "crear" ? "Subiendo…" : "Subir solicitud"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Este contrato no tiene solicitud de registro.</p>
      )}
      </MarcoPrevisualizacion>
    </div>
  );
}

function ListaTrabajadores({
  items,
  marcados,
  disabled,
  onToggle,
}: {
  items: ContratoEnlazable[];
  marcados: string[];
  disabled: boolean;
  onToggle: (contratoId: string) => void;
}) {
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
      {items.map((item) => (
        <li key={item.contratoId}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={marcados.includes(item.contratoId)}
              disabled={disabled}
              onChange={() => onToggle(item.contratoId)}
            />
            <span>
              {item.etiqueta}
              {item.solicitudId ? " · contrato vencido (puede renovar)" : ""}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
