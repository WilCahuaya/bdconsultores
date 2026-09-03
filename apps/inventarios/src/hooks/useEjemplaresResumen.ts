"use client";

import { useEffect, useState } from "react";
import type { EjemplaresSimilaresResumen } from "@inventario/types";
import { getEjemplaresSimilaresResumen } from "@/lib/actions/activos";

export function useEjemplaresResumen(activoId: string | null | undefined) {
  const [resumen, setResumen] = useState<EjemplaresSimilaresResumen | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activoId) {
      setResumen(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getEjemplaresSimilaresResumen(activoId)
      .then((data) => {
        if (!cancelled) setResumen(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activoId]);

  return { resumen, loading };
}
