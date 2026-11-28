import { upsertMasterItem, removeMasterItem } from "./master-cache";
import { removeCachedActivo } from "./offline";
import { aplicarComprobantesMenajeLocalDesdeCola } from "./menaje-comprobantes-client";
import { aplicarBajaMenajeLocal, aplicarEliminarMenajeLocal } from "./activos";
import {
  aplicarAnularRevisionLocal,
  aplicarResolverFaltanteLocal,
  aplicarRevisionVisitaLocal,
} from "./visitas-campo";

type QueueItem = { operation: string; entidad_id?: string; payload: string };

/**
 * Después de bajar la copia del servidor, vuelve a aplicar lo que sigue en la cola.
 * Si no, la bajada pisaría un cambio que todavía no se pudo subir.
 */
export async function reapplyPendingOverlays(): Promise<void> {
  if (!window.electronAPI?.offlineQueue) return;
  const queue = (await window.electronAPI.offlineQueue()) as QueueItem[];
  for (const item of queue) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(item.payload) as Record<string, unknown>;
    } catch {
      continue;
    }
    try {
      if (item.operation === "visita:revision") {
        await aplicarRevisionVisitaLocal({
          activoId: String(payload.activoId ?? ""),
          hallado: Boolean(payload.hallado),
          estadoBien: (payload.estadoBien as "BUENO" | "REGULAR" | "MALO" | null) ?? null,
          accion: (payload.accion as "BAJA" | "FALTANTE" | null) ?? null,
          motivo: (payload.motivo as string | null) ?? null,
        });
      } else if (item.operation === "visita:anularSi") {
        await aplicarAnularRevisionLocal(String(payload.activoId ?? ""));
      } else if (item.operation === "visita:resolver") {
        await aplicarResolverFaltanteLocal({
          activoId: String(payload.activoId ?? ""),
          accion: payload.accion === "BAJA" ? "BAJA" : "MOVER",
          destinoAmbienteId: (payload.destinoAmbienteId as string | null) ?? null,
          motivo: (payload.motivo as string | null) ?? null,
        });
      } else if (item.operation === "menaje:baja") {
        if (payload.localBajaId && item.entidad_id) {
          await removeCachedActivo(item.entidad_id, String(payload.localBajaId));
        }
        await aplicarBajaMenajeLocal(
          String(payload.activoId ?? ""),
          String(payload.motivo ?? ""),
          Number(payload.cantidad),
        );
      } else if (item.operation === "menaje:eliminar") {
        await aplicarEliminarMenajeLocal(String(payload.activoId ?? ""), true);
      } else if (item.operation === "menaje:comprobantes") {
        await aplicarComprobantesMenajeLocalDesdeCola({
          activoId: String(payload.activoId ?? ""),
          nuevo: (payload.nuevo ?? null) as never,
          cambios: (Array.isArray(payload.cambios) ? payload.cambios : []) as never,
        });
      } else if (item.operation === "catalogo:opcionUpsert") {
        const tipo = String(payload.tipo ?? "");
        const valor = String(payload.valor ?? "").trim();
        if (tipo && valor) {
          await upsertMasterItem("catalogo_opciones", "", { id: `${tipo}::${valor}`, tipo, valor });
        }
      } else if (item.operation === "catalogo:opcionDelete") {
        const tipo = String(payload.tipo ?? "");
        const valor = String(payload.valor ?? "").trim();
        if (tipo && valor) await removeMasterItem("catalogo_opciones", "", `${tipo}::${valor}`);
      }
    } catch {
      /* la cola conserva el error; la próxima subida lo reintenta */
    }
  }
}
