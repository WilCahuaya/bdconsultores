"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeActivosChanges,
  subscribeEstructuraChanges,
} from "@inventario/realtime";
import { createClient } from "@/lib/supabase/client";

interface PanelDataSyncProps {
  /** Admin: limita realtime a la entidad del perfil. Contador: null = global. */
  entidadId?: string | null;
}

/**
 * Mantiene el panel al día con cambios de otros clientes (web/desktop):
 * - Realtime de activos + estructura (entidades, sedes, ambientes, responsables)
 * - Refetch al volver a la pestaña / enfocar la ventana
 */
export function PanelDataSync({ entidadId }: PanelDataSyncProps) {
  const router = useRouter();
  const refreshRef = useRef(() => {
    router.refresh();
  });
  refreshRef.current = () => {
    router.refresh();
  };
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        refreshRef.current();
      }, 400);
    };

    const supabase = createClient();
    const unsubActivos = subscribeActivosChanges(supabase, {
      entidadId,
      onChange: scheduleRefresh,
    });
    const unsubEstructura = subscribeEstructuraChanges(supabase, {
      entidadId,
      onChange: scheduleRefresh,
    });

    return () => {
      unsubActivos();
      unsubEstructura();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [entidadId]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        refreshRef.current();
      }, 400);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", scheduleRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", scheduleRefresh);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
