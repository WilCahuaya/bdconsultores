"use client";

import { useEffect, useState } from "react";
import type { Entidad, TrabajadorPlanillaOpcion } from "@inventario/types";
import { entidadUsaPlanillas } from "@inventario/types";
import { listTrabajadoresActivosPlanilla } from "@/lib/actions/responsables";

/** Trabajadores activos si la empresa usa Planillas. `trabajadores` es null si el módulo está apagado. */
export function useTrabajadoresPlanilla(entidad: Pick<Entidad, "id" | "usa_planillas">): {
  trabajadores: TrabajadorPlanillaOpcion[] | null;
  cargando: boolean;
} {
  const habilitado = entidadUsaPlanillas(entidad);
  const [trabajadores, setTrabajadores] = useState<TrabajadorPlanillaOpcion[] | null>(null);
  const [cargando, setCargando] = useState(habilitado);

  useEffect(() => {
    if (!habilitado) {
      setTrabajadores(null);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    void listTrabajadoresActivosPlanilla(entidad.id).then((rows) => {
      if (cancelado) return;
      setTrabajadores(rows);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [habilitado, entidad.id]);

  if (!habilitado) return { trabajadores: null, cargando: false };
  return { trabajadores: trabajadores ?? [], cargando };
}
