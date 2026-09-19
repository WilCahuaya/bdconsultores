import type { CreateEntidadInput } from "./entidades";
import {
  cambiarUbicacionActivo,
  createActivo,
  darDeBajaActivo,
  deleteActivosPorCodigos,
  deleteActivosPreregistrados,
  recuperarActivo,
  registrarActivo,
  updateActivo,
  type ActivoConUbicacion,
  type CreateActivoInput,
  type UpdateActivoInput,
} from "./activos";
import {
  base64ToFile,
  removeCachedActivo,
  type QueuedFiles,
  type QueuedPayload,
  upsertCachedActivo,
} from "./offline";
import { syncAdminResponsableForEntidad } from "./responsables-admin-sync";
import { syncSedePrincipalDireccionFromEntidad } from "./sede-principal-direccion";
import { getSupabaseClient } from "./supabase";
import { updateActivoPaths, uploadActivoFile } from "./storage";
import type {
  CreateResponsableInput,
  UpdateResponsableInput,
} from "@inventario/types";
import {
  buildAmbientePreregistroNombre,
  normalizeResponsableDni,
  normalizeResponsableNombre,
  RESPONSABLE_CARGO_DEFAULT,
} from "@inventario/types";

interface SyncQueueItem {
  id: string;
  operation: string;
  entidad_id: string;
  activo_id: string | null;
  payload: string;
  last_error: string | null;
}

async function uploadQueuedFiles(
  entidadId: string,
  activoId: string,
  files?: QueuedFiles,
  comprobanteSerie?: string,
) {
  if (!files) return;

  if (files.comprobanteBase64 && files.comprobanteName && files.comprobanteType) {
    const file = base64ToFile(
      files.comprobanteBase64,
      files.comprobanteName,
      files.comprobanteType,
    );
    const upload = await uploadActivoFile(entidadId, activoId, file, "comprobante");
    if (upload.path) {
      await updateActivoPaths(activoId, {
        comprobante_path: upload.path,
        comprobante_serie: comprobanteSerie?.trim() || null,
      });
    }
  }

  if (files.fotoBase64 && files.fotoName && files.fotoType) {
    const file = base64ToFile(files.fotoBase64, files.fotoName, files.fotoType);
    const upload = await uploadActivoFile(entidadId, activoId, file, "foto");
    if (upload.path) {
      await updateActivoPaths(activoId, { foto_path: upload.path });
    }
  }
}

async function processActivoOp(item: SyncQueueItem): Promise<void> {
  const body = JSON.parse(item.payload) as QueuedPayload;

  if (item.operation === "create") {
    const queuedInput = body.input as Omit<CreateActivoInput, "entidad_id">;
    const estadoFromLocal = body.localActivo?.estado_registro;
    const result = await createActivo({
      entidad_id: item.entidad_id,
      ...queuedInput,
      estado_registro:
        queuedInput.estado_registro ??
        (estadoFromLocal === "PREREGISTRADO" || estadoFromLocal === "REGISTRADO"
          ? estadoFromLocal
          : queuedInput.sede_id && queuedInput.ambiente_id
            ? "REGISTRADO"
            : "PREREGISTRADO"),
      sede_id: queuedInput.sede_id ?? body.localActivo?.sede_id ?? undefined,
      ambiente_id: queuedInput.ambiente_id ?? body.localActivo?.ambiente_id ?? undefined,
    });
    if (result.error) throw new Error(result.error);
    const activoId = result.data!.id;
    await uploadQueuedFiles(
      item.entidad_id,
      activoId,
      body.files,
      body.input.comprobante_serie as string | undefined,
    );
    const localId = body.localActivo?.id;
    if (localId && localId !== activoId && String(localId).startsWith("pending-")) {
      await removeCachedActivo(item.entidad_id, localId);
    }
    await upsertCachedActivo(item.entidad_id, {
      ...(result.data as ActivoConUbicacion),
      sede_nombre: body.localActivo?.sede_nombre,
      ambiente_nombre: body.localActivo?.ambiente_nombre,
    });
    return;
  }

  if (item.operation === "update") {
    const activoId = item.activo_id;
    if (!activoId) throw new Error("Falta activo_id en cola de actualización");
    const result = await updateActivo(activoId, body.input as UpdateActivoInput);
    if (result.error) throw new Error(result.error);
    await uploadQueuedFiles(
      item.entidad_id,
      activoId,
      body.files,
      body.input.comprobante_serie as string | undefined,
    );
    if (result.data) {
      await upsertCachedActivo(item.entidad_id, {
        ...result.data,
        sede_nombre: body.localActivo?.sede_nombre,
        ambiente_nombre: body.localActivo?.ambiente_nombre,
      });
    }
    return;
  }

  throw new Error(`Operación de activo desconocida: ${item.operation}`);
}

async function processMasterOp(
  item: SyncQueueItem,
  visitaIdMap: Map<string, string>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const payload = JSON.parse(item.payload) as Record<string, unknown>;
  const op = item.operation;

  if (op === "entidad:create") {
    const input = payload.input as CreateEntidadInput;
    const entidadId = String(payload.id);
    const sedeId = String(payload.sedeId);
    const preregistroId = String(payload.preregistroId);
    const adminDni = normalizeResponsableDni(input.admin_dni ?? "");

    const { error: insertError } = await supabase.from("entidades").insert({
      id: entidadId,
      nombre: input.nombre.trim(),
      numero_interno: input.numero_interno?.trim() || null,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc: input.ruc?.trim() || null,
      direccion: input.direccion?.trim() || null,
      admin_nombre: input.admin_nombre?.trim() || null,
      admin_email: input.admin_email?.trim() || null,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
    });
    if (insertError && insertError.code !== "23505") {
      throw new Error(insertError.message);
    }

    // Los triggers de BD crean automáticamente una sede "Principal" y un ambiente
    // de preregistros con IDs generados en el servidor. Los reemplazamos por los
    // IDs locales para que coincidan con lo que ya se guardó en el caché offline.
    const { data: autoSede } = await supabase
      .from("sedes")
      .select("id")
      .eq("entidad_id", entidadId)
      .eq("es_principal", true)
      .maybeSingle();

    if (autoSede && autoSede.id !== sedeId) {
      const { error: delError } = await supabase.from("sedes").delete().eq("id", autoSede.id);
      if (delError) throw new Error(delError.message);
    }

    const { data: existingSede } = await supabase
      .from("sedes")
      .select("id")
      .eq("id", sedeId)
      .maybeSingle();

    if (!existingSede) {
      const { error: sedeError } = await supabase.from("sedes").insert({
        id: sedeId,
        entidad_id: entidadId,
        nombre: "Principal",
        direccion: input.direccion?.trim() || null,
        es_principal: true,
      });
      if (sedeError) throw new Error(sedeError.message);
    }

    const { data: existingAmbiente } = await supabase
      .from("ambientes")
      .select("id")
      .eq("id", preregistroId)
      .maybeSingle();

    if (!existingAmbiente) {
      const { error: ambienteError } = await supabase.from("ambientes").insert({
        id: preregistroId,
        sede_id: sedeId,
        nombre: buildAmbientePreregistroNombre(),
        es_preregistro: true,
      });
      if (ambienteError) throw new Error(ambienteError.message);
    }

    await syncSedePrincipalDireccionFromEntidad(supabase, entidadId, input.direccion);

    if (input.admin_nombre && input.admin_email) {
      await syncAdminResponsableForEntidad(
        supabase,
        entidadId,
        input.admin_nombre,
        input.admin_email,
        input.admin_telefono,
        adminDni,
      );
    }
    return;
  }

  if (op === "entidad:update") {
    const input = payload.input as CreateEntidadInput;
    const adminDni = normalizeResponsableDni(input.admin_dni ?? "");
    const { error } = await supabase
      .from("entidades")
      .update({
        nombre: input.nombre.trim(),
        numero_interno: input.numero_interno?.trim() || null,
        nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
        ruc: input.ruc?.trim() || null,
        direccion: input.direccion?.trim() || null,
        admin_nombre: input.admin_nombre?.trim() || null,
        admin_email: input.admin_email?.trim() || null,
        admin_dni: adminDni,
        admin_telefono: input.admin_telefono?.trim() || null,
      })
      .eq("id", item.entidad_id);
    if (error) throw new Error(error.message);
    await syncSedePrincipalDireccionFromEntidad(supabase, item.entidad_id, input.direccion);
    if (input.admin_nombre && input.admin_email) {
      await syncAdminResponsableForEntidad(
        supabase,
        item.entidad_id,
        input.admin_nombre,
        input.admin_email,
        input.admin_telefono,
        adminDni,
      );
    }
    return;
  }

  if (op === "entidad:setActivo") {
    const { error } = await supabase
      .from("entidades")
      .update({ activo: Boolean(payload.activo) })
      .eq("id", item.entidad_id);
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "entidad:delete") {
    const { error } = await supabase.from("entidades").delete().eq("id", item.entidad_id);
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "sede:create") {
    const { error } = await supabase.from("sedes").insert({
      id: String(payload.id),
      entidad_id: item.entidad_id,
      nombre: String(payload.nombre),
      direccion: (payload.direccion as string | null) ?? null,
      es_principal: false,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return;
  }

  if (op === "sede:update") {
    const { error } = await supabase
      .from("sedes")
      .update({
        nombre: String(payload.nombre),
        direccion: (payload.direccion as string | null) ?? null,
      })
      .eq("id", String(payload.sedeId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "sede:delete") {
    const { error } = await supabase
      .from("sedes")
      .update({ activo: false })
      .eq("id", String(payload.sedeId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "ambiente:create") {
    const input = payload.input as {
      sedeId: string;
      nombre: string;
      descripcion?: string | null;
      responsableId?: string | null;
      espacioId?: string | null;
    };
    const { error } = await supabase.from("ambientes").insert({
      id: String(payload.id),
      sede_id: input.sedeId,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      responsable_id: input.responsableId ?? null,
      espacio_id: input.espacioId ?? null,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return;
  }

  if (op === "ambiente:update") {
    const input = payload.input as {
      nombre: string;
      descripcion?: string | null;
      responsableId?: string | null;
      espacioId?: string | null;
    };
    const { error } = await supabase
      .from("ambientes")
      .update({
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        responsable_id: input.responsableId ?? null,
        espacio_id: input.espacioId ?? null,
      })
      .eq("id", String(payload.ambienteId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "ambiente:delete") {
    const { error } = await supabase
      .from("ambientes")
      .update({ activo: false })
      .eq("id", String(payload.ambienteId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "ambiente:assignResponsable") {
    const { error } = await supabase
      .from("ambientes")
      .update({ responsable_id: (payload.responsableId as string | null) ?? null })
      .eq("id", String(payload.ambienteId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "espacio:create") {
    const { error } = await supabase.from("espacios").insert({
      id: String(payload.id),
      sede_id: String(payload.sedeId),
      nombre: String(payload.nombre),
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "espacio:delete") {
    await supabase
      .from("ambientes")
      .update({ espacio_id: null })
      .eq("espacio_id", String(payload.espacioId));
    const { error } = await supabase
      .from("espacios")
      .update({ activo: false })
      .eq("id", String(payload.espacioId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "responsable:create") {
    const input = payload.input as CreateResponsableInput;
    const trimOrNull = (v?: string) => {
      const t = v?.trim();
      return t ? t : null;
    };
    const { error } = await supabase.from("responsables").insert({
      id: String(payload.id),
      entidad_id: item.entidad_id,
      nombre: normalizeResponsableNombre(input.nombre),
      dni: normalizeResponsableDni(input.dni) || null,
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      cargo: RESPONSABLE_CARGO_DEFAULT,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return;
  }

  if (op === "responsable:update") {
    const input = payload.input as UpdateResponsableInput;
    const trimOrNull = (v?: string) => {
      const t = v?.trim();
      return t ? t : null;
    };
    const telefono = trimOrNull(input.telefono);
    if (payload.soloTelefonoAdmin) {
      const { error } = await supabase
        .from("responsables")
        .update({ telefono })
        .eq("id", String(payload.responsableId));
      if (error) throw new Error(error.message);
      await supabase
        .from("entidades")
        .update({ admin_telefono: telefono })
        .eq("id", item.entidad_id);
      return;
    }
    const { error } = await supabase
      .from("responsables")
      .update({
        nombre: normalizeResponsableNombre(input.nombre),
        dni: normalizeResponsableDni(input.dni) || null,
        email: trimOrNull(input.email),
        telefono,
        ...(input.activo !== undefined ? { activo: input.activo } : {}),
      })
      .eq("id", String(payload.responsableId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "responsable:setActivo") {
    const { error } = await supabase
      .from("responsables")
      .update({ activo: Boolean(payload.activo) })
      .eq("id", String(payload.responsableId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "responsable:delete") {
    const { error } = await supabase
      .from("responsables")
      .delete()
      .eq("id", String(payload.responsableId));
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "visita:abrir") {
    const localId = String(payload.id);
    const sedeId = (payload.sedeId as string | null) ?? null;
    const { data, error } = await supabase.rpc("abrir_visita_campo", {
      p_entidad_id: item.entidad_id,
      p_sede_id: sedeId,
    });
    if (error) throw new Error(error.message);
    if (data) visitaIdMap.set(localId, data as string);
    return;
  }

  if (op === "visita:culminar") {
    const { error } = await supabase.rpc("culminar_ambiente_visita", {
      p_ambiente_id: String(payload.ambienteId),
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "visita:cerrar") {
    const localId = String(payload.visitaId);
    const sedeId = (payload.sedeId as string | null) ?? null;
    let realId = visitaIdMap.get(localId) ?? localId;

    const { error } = await supabase.rpc("cerrar_visita_campo", { p_visita_id: realId });
    if (error) {
      // Reintenta resolviendo la visita abierta actual (p. ej. tras reinicio entre
      // el "abrir" y el "cerrar" offline, cuando ya no tenemos el mapeo en memoria).
      let query = supabase
        .from("visitas_campo")
        .select("id")
        .eq("entidad_id", item.entidad_id)
        .eq("estado", "ABIERTO");
      query = sedeId ? query.eq("sede_id", sedeId) : query.is("sede_id", null);
      const { data: abierta } = await query.maybeSingle();
      if (!abierta?.id) throw new Error(error.message);
      realId = abierta.id as string;
      const { error: retryError } = await supabase.rpc("cerrar_visita_campo", {
        p_visita_id: realId,
      });
      if (retryError) throw new Error(retryError.message);
    }
    return;
  }

  if (op === "activos:updateSimilares") {
    const activoId = String(payload.activoId);
    const patch = payload.patch as Record<string, unknown>;
    const { error } = await supabase.rpc("update_activos_similares", {
      p_activo_id: activoId,
      p_patch: patch,
    });
    if (error) throw new Error(error.message);
    const files = payload.files as QueuedFiles | undefined;
    if (files) {
      await uploadQueuedFiles(
        item.entidad_id,
        activoId,
        files,
        typeof patch.comprobante_serie === "string" ? patch.comprobante_serie : undefined,
      );
    }
    return;
  }

  if (op === "activos:deletePorCodigos") {
    const codigos = payload.codigos as string[];
    const result = await deleteActivosPorCodigos(item.entidad_id, codigos.join("\n"));
    if (result.error) throw new Error(result.error);
    return;
  }

  if (op === "activos:deletePreregistrados") {
    const activoIds = payload.activoIds as string[];
    const result = await deleteActivosPreregistrados(item.entidad_id, activoIds);
    if (result.error) throw new Error(result.error);
    return;
  }

  if (op === "catalogo:create") {
    const row = payload.payload as Record<string, unknown>;
    const { error } = await supabase.from("catalogo_nacional").insert(row);
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "catalogo:update") {
    const codigo = String(payload.codigo);
    if (payload.mode === "contabilidad") {
      const updatePayload = payload.payload as {
        cuenta_codigo?: string | null;
        contabilidad?: string | null;
        depreciacion?: string | null;
      };
      const { error } = await supabase.rpc("update_catalogo_nacional_contabilidad", {
        p_codigo: codigo,
        p_cuenta_codigo: updatePayload.cuenta_codigo ?? "",
        p_contabilidad: updatePayload.contabilidad ?? "",
        p_depreciacion: updatePayload.depreciacion ?? "",
      });
      if (error) throw new Error(error.message);
      return;
    }

    const updatePayload = payload.payload as Record<string, unknown>;
    const { error } = await supabase
      .from("catalogo_nacional")
      .update(updatePayload)
      .eq("codigo", codigo)
      .eq("origen", "PROPIO");
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "catalogo:delete") {
    const codigo = String(payload.codigo);
    const { error } = await supabase
      .from("catalogo_nacional")
      .delete()
      .eq("codigo", codigo)
      .eq("origen", "PROPIO");
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "cuenta:upsert") {
    const { error } = await supabase.rpc("upsert_cuenta_contable", {
      p_codigo: String(payload.codigo),
      p_nombre: String(payload.nombre),
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "cuenta:delete") {
    const { error } = await supabase.rpc("delete_cuenta_contable", {
      p_codigo: String(payload.codigo),
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (op === "activo:baja") {
    const result = await darDeBajaActivo(String(payload.activoId), String(payload.motivo));
    if (result.error) throw new Error(result.error);
    return;
  }

  if (op === "activo:recuperar") {
    const result = await recuperarActivo(String(payload.activoId));
    if (result.error) throw new Error(result.error);
    return;
  }

  if (op === "activo:cambiarUbicacion") {
    const result = await cambiarUbicacionActivo(
      String(payload.activoId),
      String(payload.sedeId),
      String(payload.ambienteId),
    );
    if (result.error) throw new Error(result.error);
    if (result.data) {
      await upsertCachedActivo(item.entidad_id, result.data);
    }
    return;
  }

  if (op === "activo:validarPreregistro") {
    const result = await registrarActivo(String(payload.activoId), {
      sedeId: String(payload.sedeId),
      ambienteId: String(payload.ambienteId),
    });
    if (result.error) throw new Error(result.error);
    if (result.data) {
      await upsertCachedActivo(item.entidad_id, result.data);
    }
    return;
  }

  throw new Error(`Operación desconocida en cola: ${op}`);
}

export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  lastError: string | null;
}> {
  if (!window.electronAPI?.offlineQueue) {
    return { processed: 0, failed: 0, lastError: null };
  }

  const queue = (await window.electronAPI.offlineQueue()) as SyncQueueItem[];
  let processed = 0;
  let failed = 0;
  let lastError: string | null = null;
  const visitaIdMap = new Map<string, string>();

  for (const item of queue) {
    try {
      if (item.operation === "create" || item.operation === "update") {
        await processActivoOp(item);
      } else {
        await processMasterOp(item, visitaIdMap);
      }
      await window.electronAPI.offlineRemove(item.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de sincronización";
      await window.electronAPI.offlineSetError(item.id, message);
      lastError = message;
      failed++;
    }
  }

  return { processed, failed, lastError };
}
