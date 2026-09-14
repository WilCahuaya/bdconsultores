"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addVacacion, deleteVacacion, type VacacionRow } from "@/lib/actions/vacaciones";
import { DateField, Field, SelectField } from "@/components/fields";
import { formatFechaPlanilla } from "@/lib/planillas-labels";
import {
  DIAS_VACACIONES_ANUALES,
  ESTADO_VACACION,
  ESTADO_VACACION_LABEL,
} from "@/lib/vacaciones";

export function FichaVacaciones({
  relacionId,
  periodo,
  derecho,
  diasTomados,
  saldo,
  registros,
  canWrite,
}: {
  relacionId: string;
  periodo: number;
  derecho: boolean;
  diasTomados: number;
  saldo: number;
  registros: VacacionRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [eliminando, setEliminando] = useState<VacacionRow | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await addVacacion(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Vacaciones registradas.");
    router.refresh();
  }

  async function onEliminar() {
    if (!eliminando) return;
    setPending(true);
    const result = await deleteVacacion(relacionId, eliminando.id);
    setPending(false);
    setEliminando(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Registro de vacaciones eliminado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-2 p-5`}>
        <p className="text-sm font-medium">Periodo {periodo}</p>
        {derecho ? (
          <p className="text-sm text-muted-foreground">
            {DIAS_VACACIONES_ANUALES} días correspondientes · {diasTomados} registrados · saldo {saldo}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no genera derecho (un año de servicio). Puede registrar un goce si ya lo tomó.
          </p>
        )}
      </section>

      <ul className={`${panelCardClass} divide-y p-0`}>
        {registros.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Sin vacaciones registradas en este periodo.</li>
        ) : (
          registros.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {formatFechaPlanilla(item.fecha_inicio)} – {formatFechaPlanilla(item.fecha_fin)} · {item.dias}{" "}
                día{item.dias === 1 ? "" : "s"} · {ESTADO_VACACION_LABEL[item.estado]}
                {item.observaciones ? ` · ${item.observaciones}` : ""}
              </span>
              {canWrite ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setEliminando(item)}>
                  Quitar
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {canWrite ? (
        <form action={onSubmit} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar goce</p>
          <input type="hidden" name="periodo" value={String(periodo)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Fecha de inicio" name="fecha_inicio" required />
            <DateField label="Fecha de fin" name="fecha_fin" required />
            <Field label="Días" name="dias" inputMode="numeric" placeholder="Se calcula si lo deja vacío" />
            <SelectField
              label="Estado"
              name="estado"
              defaultValue="PROGRAMADO"
              options={ESTADO_VACACION.map((value) => ({
                value,
                label: ESTADO_VACACION_LABEL[value],
              }))}
            />
            <Field label="Observaciones" name="observaciones" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={Boolean(eliminando)}
        title="Quitar este goce"
        description="Se elimina el registro de vacaciones. No afecta el contrato."
        confirmLabel="Quitar"
        pending={pending}
        onClose={() => setEliminando(null)}
        onConfirm={() => void onEliminar()}
      />
    </div>
  );
}
