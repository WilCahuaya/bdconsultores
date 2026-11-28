import {
  persistirComprobantesMenaje,
  type MenajeComprobante,
} from "@inventario/types";
import type { MenajeComprobanteCambio, MenajeComprobanteNuevo } from "@inventario/ui";
import { enqueueOfflineOp, isOnline, listMasterDomain } from "./master-cache";
import { cacheStorageFile } from "./media-cache";
import { fileToBase64, listCachedActivos, upsertCachedActivo } from "./offline";
import { getSupabaseClient } from "./supabase";
import type { ActivoConUbicacion } from "./activos";

type ActivoConComprobantes = ActivoConUbicacion & { comprobantes?: MenajeComprobante[] };

type ArchivoEnCola = {
  base64: string;
  name: string;
  type: string;
};

async function findActivoConComprobantes(
  activoId: string,
): Promise<{ entidadId: string; activo: ActivoConComprobantes } | null> {
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  for (const entidad of entidades) {
    const lista = (await listCachedActivos(entidad.id)) as ActivoConComprobantes[];
    const activo = lista.find((item) => item.id === activoId);
    if (activo) return { entidadId: entidad.id, activo };
  }
  return null;
}

async function archivoEnCola(file: File | null | undefined): Promise<ArchivoEnCola | null> {
  if (!file) return null;
  return { base64: await fileToBase64(file), name: file.name, type: file.type || "application/pdf" };
}

async function guardarComprobantesMenajeLocal(args: {
  entidadId: string;
  activoId: string;
  nuevo: MenajeComprobanteNuevo | null;
  cambios: MenajeComprobanteCambio[];
}): Promise<{ error?: string; comprobantes?: MenajeComprobante[] }> {
  const found = await findActivoConComprobantes(args.activoId);
  if (!found) return { error: "Menaje no encontrado en este equipo." };
  const comprobantes = [...(found.activo.comprobantes ?? [])];
  const nuevoEnCola = args.nuevo
    ? {
        cantidad: args.nuevo.cantidad,
        precio: args.nuevo.precio,
        serie: args.nuevo.serie,
        fecha: args.nuevo.fecha,
        localId: "",
        archivo: await archivoEnCola(args.nuevo.archivo as File | null | undefined),
      }
    : null;

  if (args.nuevo && nuevoEnCola) {
    const localId = `pending-comp-${crypto.randomUUID()}`;
    nuevoEnCola.localId = localId;
    let pdfPath: string | null = null;
    if (nuevoEnCola.archivo) {
      const bytes = Uint8Array.from(atob(nuevoEnCola.archivo.base64), (char) => char.charCodeAt(0));
      const ext = nuevoEnCola.archivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      pdfPath = `${args.entidadId}/${args.activoId}/comprobantes/${localId}.${ext}`;
      await cacheStorageFile("comprobantes-activos", pdfPath, bytes);
    }
    comprobantes.push({
      id: localId,
      activo_id: args.activoId,
      cantidad: args.nuevo.cantidad,
      precio: args.nuevo.precio,
      serie: args.nuevo.serie,
      pdf_path: pdfPath,
      fecha: args.nuevo.fecha,
    });
  }

  const cambiosEnCola = [];
  for (const cambio of args.cambios) {
    const index = comprobantes.findIndex((item) => item.id === cambio.id);
    if (index < 0) continue;
    const archivo = await archivoEnCola(cambio.archivo as File | null | undefined);
    let pdfPath = comprobantes[index]?.pdf_path ?? null;
    if (archivo) {
      const bytes = Uint8Array.from(atob(archivo.base64), (char) => char.charCodeAt(0));
      const ext = archivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      pdfPath = `${args.entidadId}/${args.activoId}/comprobantes/${cambio.id}.${ext}`;
      await cacheStorageFile("comprobantes-activos", pdfPath, bytes);
    }
    comprobantes[index] = {
      id: cambio.id,
      activo_id: args.activoId,
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
      pdf_path: pdfPath,
    };
    cambiosEnCola.push({
      id: cambio.id,
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
      pdfAnterior: cambio.pdf_path,
      archivo,
    });
  }

  await upsertCachedActivo(found.entidadId, { ...found.activo, comprobantes } as ActivoConUbicacion);
  await enqueueOfflineOp(
    "menaje:comprobantes",
    found.entidadId,
    { activoId: args.activoId, nuevo: nuevoEnCola, cambios: cambiosEnCola },
    args.activoId,
  );
  return { comprobantes };
}

export async function aplicarComprobantesMenajeDesdeCola(payload: {
  activoId: string;
  entidadId: string;
  nuevo: {
    cantidad: number;
    precio: number | null;
    serie: string | null;
    fecha: string | null;
    localId: string;
    archivo: ArchivoEnCola | null;
  } | null;
  cambios: Array<{
    id: string;
    cantidad: number;
    precio: number | null;
    serie: string | null;
    fecha: string | null;
    pdfAnterior?: string | null;
    archivo: ArchivoEnCola | null;
  }>;
}): Promise<{ error?: string }> {
  const { base64ToFile } = await import("./offline");
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const result = await persistirComprobantesMenaje(supabase, {
    activoId: payload.activoId,
    usuarioId: data.user?.id ?? null,
    nuevo: payload.nuevo
      ? {
          cantidad: payload.nuevo.cantidad,
          precio: payload.nuevo.precio,
          serie: payload.nuevo.serie,
          fecha: payload.nuevo.fecha,
          archivo: payload.nuevo.archivo
            ? base64ToFile(payload.nuevo.archivo.base64, payload.nuevo.archivo.name, payload.nuevo.archivo.type)
            : null,
        }
      : null,
    cambios: payload.cambios.map((cambio) => ({
      id: cambio.id,
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
      archivo: cambio.archivo
        ? base64ToFile(cambio.archivo.base64, cambio.archivo.name, cambio.archivo.type)
        : null,
      pdfAnterior: cambio.pdfAnterior,
    })),
    subirPdf: async (comprobanteId, archivo, pdfAnterior) => {
      const file = archivo as File;
      return uploadMenajeComprobantePdf(payload.entidadId, payload.activoId, comprobanteId, file, pdfAnterior);
    },
  });
  return { error: result.error };
}

export async function aplicarComprobantesMenajeLocalDesdeCola(payload: {
  activoId: string;
  nuevo: {
    localId: string;
    cantidad: number;
    precio: number | null;
    serie: string | null;
    fecha: string | null;
    archivo: ArchivoEnCola | null;
  } | null;
  cambios: Array<{
    id: string;
    cantidad: number;
    precio: number | null;
    serie: string | null;
    fecha: string | null;
    archivo: ArchivoEnCola | null;
  }>;
}): Promise<void> {
  const found = await findActivoConComprobantes(payload.activoId);
  if (!found) return;
  const comprobantes = [...(found.activo.comprobantes ?? [])];
  if (payload.nuevo && !comprobantes.some((item) => item.id === payload.nuevo?.localId)) {
    let pdfPath: string | null = null;
    if (payload.nuevo.archivo) {
      const bytes = Uint8Array.from(atob(payload.nuevo.archivo.base64), (char) => char.charCodeAt(0));
      const ext = payload.nuevo.archivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      pdfPath = `${found.entidadId}/${payload.activoId}/comprobantes/${payload.nuevo.localId}.${ext}`;
      await cacheStorageFile("comprobantes-activos", pdfPath, bytes);
    }
    comprobantes.push({
      id: payload.nuevo.localId,
      activo_id: payload.activoId,
      cantidad: payload.nuevo.cantidad,
      precio: payload.nuevo.precio,
      serie: payload.nuevo.serie,
      fecha: payload.nuevo.fecha,
      pdf_path: pdfPath,
    });
  }
  for (const cambio of payload.cambios) {
    const index = comprobantes.findIndex((item) => item.id === cambio.id);
    if (index < 0) continue;
    comprobantes[index] = {
      ...comprobantes[index],
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
    };
  }
  await upsertCachedActivo(found.entidadId, { ...found.activo, comprobantes } as ActivoConUbicacion);
}

async function uploadMenajeComprobantePdf(
  entidadId: string,
  activoId: string,
  comprobanteId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${entidadId}/${activoId}/comprobantes/${comprobanteId}.${ext}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from("comprobantes-activos").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) return { error: error.message };
  if (previousPath && previousPath !== path) {
    await supabase.storage.from("comprobantes-activos").remove([previousPath]);
  }
  return { path };
}

export async function aplicarComprobantesMenaje(args: {
  entidadId: string;
  activoId: string;
  nuevo: MenajeComprobanteNuevo | null;
  cambios: MenajeComprobanteCambio[];
}): Promise<{ error?: string; comprobantes?: MenajeComprobante[] }> {
  if (!args.nuevo && args.cambios.length === 0) return {};
  if (!isOnline()) return guardarComprobantesMenajeLocal(args);
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return persistirComprobantesMenaje(supabase, {
    activoId: args.activoId,
    usuarioId: data.user?.id ?? null,
    nuevo: args.nuevo,
    cambios: args.cambios.map((cambio) => ({
      id: cambio.id,
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
      archivo: cambio.archivo,
      pdfAnterior: cambio.pdf_path,
    })),
    subirPdf: (comprobanteId, archivo, pdfAnterior) =>
      uploadMenajeComprobantePdf(
        args.entidadId,
        args.activoId,
        comprobanteId,
        archivo as File,
        pdfAnterior,
      ),
  });
}
