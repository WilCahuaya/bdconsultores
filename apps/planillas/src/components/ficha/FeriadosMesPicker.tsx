"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@inventario/ui";
import { guardarFeriadosMes, listarFeriadosMes } from "@/lib/actions/asistencias";
import { diaSemanaDeIso, diasIsoDelMes, etiquetaDia } from "@/lib/horario-asistencia";
import type { DiaSemana } from "@/lib/horario-laboral";

const DIA_CORTO: Record<DiaSemana, string> = {
  LUNES: "L",
  MARTES: "M",
  MIERCOLES: "X",
  JUEVES: "J",
  VIERNES: "V",
  SABADO: "S",
  DOMINGO: "D",
};

export function FeriadosMesPicker({
  entidadId,
  mes,
  fechasIniciales,
  canWrite,
  onChange,
}: {
  entidadId: string;
  mes: string;
  fechasIniciales?: string[];
  canWrite: boolean;
  onChange?: (fechas: string[]) => void;
}) {
  const { pushToast } = useToast();
  const dias = diasIsoDelMes(mes);
  const [seleccion, setSeleccion] = useState<string[]>(fechasIniciales ?? []);
  const [guardando, setGuardando] = useState(false);
  const seleccionRef = useRef(seleccion);
  const cola = useRef(Promise.resolve());
  const omitirCargaInicial = useRef(fechasIniciales !== undefined);
  const toastRef = useRef(pushToast);
  seleccionRef.current = seleccion;
  toastRef.current = pushToast;

  useEffect(() => {
    if (omitirCargaInicial.current) {
      omitirCargaInicial.current = false;
      return;
    }
    let cancel = false;
    seleccionRef.current = [];
    setSeleccion([]);
    void listarFeriadosMes(entidadId, mes)
      .then((fechas) => {
        if (cancel) return;
        seleccionRef.current = fechas;
        setSeleccion(fechas);
        onChange?.(fechas);
      })
      .catch(() => {
        if (!cancel) toastRef.current("No se pudieron cargar los feriados.", "error");
      });
    return () => {
      cancel = true;
    };
  }, [entidadId, mes]);

  function toggle(iso: string) {
    if (!canWrite) return;
    const prev = seleccionRef.current;
    const next = prev.includes(iso) ? prev.filter((dia) => dia !== iso) : [...prev, iso].sort();
    seleccionRef.current = next;
    setSeleccion(next);
    onChange?.(next);
    const fechas = next;
    cola.current = cola.current.then(async () => {
      setGuardando(true);
      const result = await guardarFeriadosMes(entidadId, mes, fechas);
      setGuardando(false);
      if (result.error) toastRef.current(result.error, "error");
    });
  }

  const marcados = seleccion
    .map((iso) => Number(iso.slice(8, 10)))
    .sort((a, b) => a - b)
    .join(", ");

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Feriados</p>
        <p className="text-sm text-muted-foreground">
          Elija uno o más días del mes. En el Excel se escribe Feriado y esas horas no se acumulan.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días feriados del mes">
        {dias.map((iso) => {
          const activo = seleccion.includes(iso);
          const numero = Number(iso.slice(8, 10));
          const dia = diaSemanaDeIso(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={!canWrite}
              aria-pressed={activo}
              title={`${etiquetaDia(dia)} ${numero}${activo ? ", feriado" : ""}`}
              onClick={() => toggle(iso)}
              className={`flex h-10 w-9 flex-col items-center justify-center rounded-md border text-xs ${
                activo
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              } disabled:cursor-default disabled:opacity-60`}
            >
              <span className="text-[10px] leading-none opacity-80">{DIA_CORTO[dia]}</span>
              <span className="leading-none">{numero}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {guardando ? "Guardando…" : marcados ? `Días feriados: ${marcados}` : "Ningún feriado marcado."}
      </p>
    </div>
  );
}
