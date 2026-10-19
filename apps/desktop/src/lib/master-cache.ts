export type MasterDomain =
  | "entidades"
  | "sedes"
  | "ambientes"
  | "espacios"
  | "edificios"
  | "pisos"
  | "responsables"
  | "visitas"
  | "visita_ambientes";

export async function replaceMasterDomain(
  domain: MasterDomain,
  entidadId: string,
  items: unknown[],
): Promise<number> {
  if (!window.electronAPI?.offlineMasterReplace) return 0;
  return window.electronAPI.offlineMasterReplace(domain, entidadId, items);
}

export async function listMasterDomain<T>(
  domain: MasterDomain,
  entidadId = "",
): Promise<T[]> {
  if (!window.electronAPI?.offlineMasterList) return [];
  const rows = await window.electronAPI.offlineMasterList(domain, entidadId);
  return rows as T[];
}

export async function upsertMasterItem(
  domain: MasterDomain,
  entidadId: string,
  item: unknown,
): Promise<void> {
  await window.electronAPI?.offlineMasterUpsert?.(domain, entidadId, item);
}

export async function removeMasterItem(
  domain: MasterDomain,
  entidadId: string,
  id: string,
): Promise<void> {
  await window.electronAPI?.offlineMasterRemove?.(domain, entidadId, id);
}

export async function findMasterItem<T>(
  domain: MasterDomain,
  id: string,
): Promise<{ entidadId: string; data: T } | null> {
  if (!window.electronAPI?.offlineMasterFind) return null;
  const row = await window.electronAPI.offlineMasterFind(domain, id);
  if (!row) return null;
  return { entidadId: row.entidadId, data: row.data as T };
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function enqueueOfflineOp(
  operation: string,
  entidadId: string,
  payload: unknown,
  activoId?: string | null,
): Promise<string | null> {
  if (!window.electronAPI?.offlineEnqueue) return null;
  const row = await window.electronAPI.offlineEnqueue({
    operation,
    entidad_id: entidadId,
    activo_id: activoId ?? null,
    payload,
  });
  return (row as { id: string }).id;
}

export function newLocalId(): string {
  return crypto.randomUUID();
}
