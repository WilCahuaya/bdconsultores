"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { generarVidaLey, saveVidaLey, type VidaLeyRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { Field, DateField, SelectField } from "@/components/fields";
import { opcionesEstadoVidaLey } from "@/lib/planillas-labels";
import { descargarVidaLeyWord } from "@/lib/descargar-vida-ley-word";

export function FichaVidaLey({
  relacionId,
  trabajador,
  vidaLey,
  canWrite,
}: {
  relacionId: string;
  trabajador: TrabajadorListItem;
  vidaLey: VidaLeyRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [generando, setGenerando] = useState(false);

  async function onGenerar() {
    setGenerando(true);
    const result = await generarVidaLey(relacionId);
    if (result.error) {
      setGenerando(false);
      pushToast(result.error, "error");
      return;
    }
    const descarga = await descargarVidaLeyWord({ relacionId });
    setGenerando(false);
    if (descarga.error) {
      pushToast(descarga.error, "error");
      return;
    }
    pushToast("Trámite Vida Ley elaborado.");
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await saveVidaLey(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Vida Ley guardada.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-3 p-5`}>
        <div>
          <p className="text-sm font-medium">Trámite para la aseguradora</p>
          <p className="text-sm text-muted-foreground">
            Se genera el Word con los datos de {trabajador.persona.nombres} y la empresa. Al generar, el estado pasa a
            Elaborado.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" disabled={generando} onClick={() => void onGenerar()}>
            {generando ? "Generando…" : vidaLey?.estado === "Elaborado" ? "Descargar Word" : "Generar Word"}
          </Button>
        ) : null}
      </section>
      <form action={onSubmit} className={`${panelCardClass} space-y-4 p-5`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Estado"
            name="estado"
            defaultValue={vidaLey?.estado}
            allowEmpty
            disabled={!canWrite}
            options={opcionesEstadoVidaLey(vidaLey?.estado)}
          />
          <Field label="N° póliza" name="numero_poliza" defaultValue={vidaLey?.numero_poliza} readOnly={!canWrite} />
          <DateField label="Inicio" name="fecha_inicio" defaultValue={vidaLey?.fecha_inicio} readOnly={!canWrite} />
          <DateField label="Fin" name="fecha_fin" defaultValue={vidaLey?.fecha_fin} readOnly={!canWrite} />
        </div>
        {canWrite ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar Vida Ley"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo consulta.</p>
        )}
      </form>
    </div>
  );
}
