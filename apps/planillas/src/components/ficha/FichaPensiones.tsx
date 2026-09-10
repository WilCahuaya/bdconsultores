"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import type { Entidad, TipoPension } from "@inventario/types";
import { savePension, type PensionRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import {
  AFP_NOMBRES,
  TIPO_PENSION_LABEL,
  TRAMITE_PENSION_LABEL,
  formatFechaPlanilla,
  nombreCompleto,
} from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";

const AFPNET_URL = "https://www.afpnet.com.pe/";

function Copiar({ value }: { value: string }) {
  const { pushToast } = useToast();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!value}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => pushToast("Copiado."),
          () => pushToast("No se pudo copiar.", "error"),
        );
      }}
    >
      Copiar
    </Button>
  );
}

function DatoAlta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{value || "—"}</p>
      </div>
      {value ? <Copiar value={value} /> : null}
    </div>
  );
}

export function FichaPensiones({
  relacionId,
  pension,
  trabajador,
  entidad,
  canWrite,
}: {
  relacionId: string;
  pension: PensionRow | null;
  trabajador: TrabajadorListItem;
  entidad: Entidad | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [tipo, setTipo] = useState<TipoPension | "">(pension?.tipo ?? "");
  const esAfp = tipo === "AFP";
  const esOnp = tipo === "ONP";
  const tramitado = esAfp && pension?.tramite_estado === "TRAMITADO";
  const persona = trabajador.persona;
  const nombre = nombreCompleto(persona);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await savePension(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast(esAfp ? "Alta AFP registrada en Planillas." : "Pensiones guardadas.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-3">
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">1. Tipo</p>
          <p className="mt-1 font-medium">{tipo ? TIPO_PENSION_LABEL[tipo] : "Márquelo en Documentos"}</p>
        </li>
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">2. Alta AFP</p>
          <p className="mt-1 font-medium">
            {esOnp ? "No aplica" : tramitado ? "Tramitado" : esAfp ? "Pendiente en AFPNet" : "—"}
          </p>
        </li>
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">3. T-Registro</p>
          <p className="mt-1 font-medium">
            {esOnp || tramitado ? "Ya puede registrarse" : "Después del alta AFP"}
          </p>
        </li>
      </ol>

      {!tipo ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          En Documentos aún no se marcó AFP u ONP. El estudio no puede tramitar el alta hasta que la empresa lo indique.
        </p>
      ) : null}

      {esAfp ? (
        <section className={`${panelCardClass} space-y-4 p-5`}>
          <div>
            <p className="text-sm font-medium">Datos para el alta en la AFP</p>
            <p className="text-sm text-muted-foreground">
              Planillas no entra sola al portal. Copie estos datos, dé de alta en AFPNet y luego pegue el CUSPP aquí.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatoAlta label="Empresa" value={entidad?.nombre ?? ""} />
            <DatoAlta label="RUC" value={entidad?.ruc ?? ""} />
            <DatoAlta label="DNI" value={persona.dni} />
            <DatoAlta label="Nombres y apellidos" value={nombre} />
            <DatoAlta label="Fecha de nacimiento" value={persona.fecha_nacimiento ? formatFechaPlanilla(persona.fecha_nacimiento) : ""} />
            <DatoAlta label="Fecha de ingreso a la empresa" value={trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : ""} />
          </div>
          <a
            href={AFPNET_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Abrir AFPNet
          </a>
        </section>
      ) : null}

      {esOnp ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          Es ONP: no hay alta en AFP. Puede seguir a T-Registro.
        </p>
      ) : null}

      <form action={onSubmit} className="space-y-4">
        <FormSection
          title={esAfp ? "Registrar el trámite AFP" : "AFP / ONP"}
          hint={
            esAfp
              ? "Cuando el portal de la AFP confirme el alta, indique AFP, CUSPP y márquelo tramitado."
              : "El tipo se marca en Documentos. Si cambia aquí, quede alineado con el expediente."
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sistema"
              name="tipo"
              value={tipo}
              allowEmpty
              disabled={!canWrite}
              options={Object.entries(TIPO_PENSION_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(event) => setTipo(event.target.value as TipoPension | "")}
            />
            {esAfp ? (
              <>
                <SelectField
                  label="AFP"
                  name="afp_nombre"
                  defaultValue={pension?.afp_nombre}
                  allowEmpty
                  disabled={!canWrite}
                  options={[
                    ...(pension?.afp_nombre && !(AFP_NOMBRES as readonly string[]).includes(pension.afp_nombre)
                      ? [{ value: pension.afp_nombre, label: pension.afp_nombre }]
                      : []),
                    ...AFP_NOMBRES.map((nombreAfp) => ({ value: nombreAfp, label: nombreAfp })),
                  ]}
                />
                <Field label="CUSPP" name="cuspp" defaultValue={pension?.cuspp} readOnly={!canWrite} />
                <SelectField
                  label="Trámite AFP"
                  name="tramite_estado"
                  defaultValue={pension?.tramite_estado ?? "PENDIENTE"}
                  disabled={!canWrite}
                  options={Object.entries(TRAMITE_PENSION_LABEL)
                    .filter(([value]) => value !== "NO_APLICA")
                    .map(([value, label]) => ({ value, label }))}
                />
                <DateField label="Fecha de trámite" name="fecha_tramite" defaultValue={pension?.fecha_tramite} readOnly={!canWrite} />
              </>
            ) : (
              <input type="hidden" name="tramite_estado" value="NO_APLICA" />
            )}
          </div>
          {canWrite ? (
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : esAfp ? "Guardar trámite AFP" : "Guardar"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Solo consulta.</p>
          )}
        </FormSection>
      </form>

      {esOnp || tramitado ? (
        <Link
          href={`/trabajadores/${relacionId}?tab=t-registro`}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Continuar a T-Registro
        </Link>
      ) : null}
    </div>
  );
}
