"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { quitarAdendaArchivo } from "@/lib/actions/adendas";
import { quitarComprobanteVidaLeyEmpresa, quitarDocumentoArchivo, quitarVidaLeyLoteArchivo } from "@/lib/actions/ficha";
import { quitarArchivoSolicitudRegistro } from "@/lib/actions/solicitudes-registro";
import type { ArchivoVidaLeyLote } from "@/lib/documento-storage";
import { quitarArchivoStorage } from "@/lib/upload-documento";

async function borrarStorage(path?: string) {
  if (path) await quitarArchivoStorage(path);
}

export function ConfirmarEliminarArchivo({
  descripcion,
  disabled,
  onEliminar,
}: {
  descripcion: string;
  disabled?: boolean;
  onEliminar: () => Promise<{ error?: string; path?: string }>;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmar() {
    setPending(true);
    const result = await onEliminar();
    if (result.error) {
      setPending(false);
      pushToast(result.error, "error");
      return;
    }
    await borrarStorage(result.path);
    setPending(false);
    setOpen(false);
    pushToast("Archivo eliminado.");
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={disabled || pending} onClick={() => setOpen(true)}>
        Eliminar archivo
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Eliminar archivo"
        description={descripcion}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending}
        onConfirm={() => void confirmar()}
      />
    </>
  );
}

export function EliminarDocumentoGuardado({
  relacionId,
  documentoId,
  descripcion,
  disabled,
}: {
  relacionId: string;
  documentoId: string;
  descripcion: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmarEliminarArchivo
      descripcion={descripcion}
      disabled={disabled}
      onEliminar={() => quitarDocumentoArchivo(relacionId, documentoId)}
    />
  );
}

export function EliminarArchivoVidaLey({
  relacionId,
  tipo,
  descripcion,
  disabled,
}: {
  relacionId: string;
  tipo: ArchivoVidaLeyLote;
  descripcion: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmarEliminarArchivo
      descripcion={descripcion}
      disabled={disabled}
      onEliminar={() => quitarVidaLeyLoteArchivo(relacionId, tipo)}
    />
  );
}

export function EliminarComprobanteEmpresa({
  relacionId,
  disabled,
}: {
  relacionId: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmarEliminarArchivo
      descripcion="¿Eliminar el comprobante de envío? Deja de verse para toda la empresa."
      disabled={disabled}
      onEliminar={() => quitarComprobanteVidaLeyEmpresa(relacionId)}
    />
  );
}

export function EliminarArchivoSolicitud({
  relacionId,
  solicitudId,
  disabled,
}: {
  relacionId: string;
  solicitudId: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmarEliminarArchivo
      descripcion="¿Eliminar la solicitud de registro? Deja de verse en todos los contratos que la comparten."
      disabled={disabled}
      onEliminar={() => quitarArchivoSolicitudRegistro(relacionId, solicitudId)}
    />
  );
}

export function EliminarPdfAdenda({
  relacionId,
  adendaId,
  disabled,
}: {
  relacionId: string;
  adendaId: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmarEliminarArchivo
      descripcion="¿Eliminar el PDF firmado de esta adenda?"
      disabled={disabled}
      onEliminar={() => quitarAdendaArchivo(relacionId, adendaId)}
    />
  );
}
