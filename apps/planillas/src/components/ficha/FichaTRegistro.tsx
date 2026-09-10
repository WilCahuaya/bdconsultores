"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addTRegistro, type DocumentoRow, type PensionRow, type TRegistroRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import {
  TIPO_DOCUMENTO_LABEL,
  TIPO_T_REGISTRO_LABEL,
  TREGISTRO_URL,
  codigoOcupacionTRegistro,
  etiquetaCodigoOcupacion,
  formatFechaPlanilla,
  LEYENDA_CODIGO_OCUPACION,
} from "@/lib/planillas-labels";
import { Field, DateField, SelectField } from "@/components/fields";
import { DatoAlta } from "@/components/ficha/DatoAlta";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";

function tipoAfpCopia(pension: PensionRow | null): string {
  if (!pension?.tipo) return "";
  if (pension.tipo === "ONP") return "ONP";
  return pension.afp_nombre?.trim() ?? "";
}

function remuneracionCopia(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

export function FichaTRegistro({
  relacionId,
  items,
  pension,
  trabajador,
  documentoDni,
  documentoFicha,
  canWrite,
}: {
  relacionId: string;
  items: TRegistroRow[];
  pension: PensionRow | null;
  trabajador: TrabajadorListItem;
  documentoDni: DocumentoRow | null;
  documentoFicha: DocumentoRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(items.length === 0);
  const persona = trabajador.persona;
  const codigoOcupacion = codigoOcupacionTRegistro(trabajador.cargo);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await addTRegistro(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMostrarForm(false);
    pushToast("Registro guardado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <DocumentoPrevisualizacion
        titulo={TIPO_DOCUMENTO_LABEL.DNI}
        storagePath={documentoDni?.storage_path}
        vacio="Suba el DNI en Documentos para verlo aquí."
      />
      <DocumentoPrevisualizacion
        titulo={TIPO_DOCUMENTO_LABEL.FICHA_DATOS}
        storagePath={documentoFicha?.storage_path}
        vacio="Suba la ficha en Documentos para verla aquí."
      />
      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">Datos para pegar en T-Registro</p>
          <p className="text-sm text-muted-foreground">
            Planillas no entra sola. Abra SUNAT, copie estos datos y péguelos en el alta.
          </p>
        </div>
        <a
          href={TREGISTRO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Abrir T-Registro
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          <DatoAlta label="DNI" value={persona.dni} />
          <DatoAlta
            label="Fecha de nacimiento"
            value={persona.fecha_nacimiento ? formatFechaPlanilla(persona.fecha_nacimiento) : ""}
          />
          <DatoAlta label="Número de teléfono" value={persona.celular ?? ""} />
          <DatoAlta label="Correo" value={persona.correo ?? ""} />
          <DatoAlta
            label="Fecha de inicio del trabajador"
            value={trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : ""}
          />
          <DatoAlta label={etiquetaCodigoOcupacion(trabajador.cargo)} value={codigoOcupacion} />
          <DatoAlta label="Remuneración" value={remuneracionCopia(trabajador.remuneracion)} />
          <DatoAlta label="Tipo de AFP" value={tipoAfpCopia(pension)} />
          <DatoAlta label="CUSPP" value={pension?.cuspp?.trim() ?? ""} />
        </div>
        <p className="text-xs text-muted-foreground">
          {LEYENDA_CODIGO_OCUPACION.map((item) => `${item.corto} ${item.codigo}`).join(" · ")}
        </p>
      </section>
      <ul className={`${panelCardClass} divide-y p-0`}>
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Sin altas ni bajas registradas.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {TIPO_T_REGISTRO_LABEL[item.tipo]}
                {item.fecha ? ` · ${formatFechaPlanilla(item.fecha)}` : ""}
              </span>
              <span className="text-muted-foreground">{item.realizado ? "Realizado" : "Pendiente"}</span>
            </li>
          ))
        )}
      </ul>
      {canWrite && !mostrarForm ? (
        <Button type="button" variant="outline" onClick={() => setMostrarForm(true)}>
          Registrar alta o baja
        </Button>
      ) : null}
      {canWrite && mostrarForm ? (
        <form action={onSubmit} key={items.length} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar alta o baja</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              name="tipo"
              options={Object.entries(TIPO_T_REGISTRO_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <DateField label="Fecha" name="fecha" />
            <Field label="Observaciones" name="observaciones" />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="realizado" />
              Ya se realizó en T-Registro
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar"}
            </Button>
            {items.length > 0 ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
