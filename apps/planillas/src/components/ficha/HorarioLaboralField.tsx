"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@inventario/ui";
import { fieldClass } from "@/components/fields";
import { HorarioContratoVista } from "@/components/ficha/HorarioContratoVista";
import {
  DIA_LABEL,
  DIAS_SEMANA,
  formatClausulaCompleto,
  horasEfectivasBloque,
  horasEfectivasCompleto,
  horasEfectivasSemanaParcial,
  horarioInicialParaJornada,
  parseHorario,
  serializeHorario,
  type DiaSemana,
  type HorarioBloque,
  type HorarioCompleto,
  type HorarioLaboral,
  type HorarioParcial,
  type HorarioTexto,
} from "@/lib/horario-laboral";

function formatoHoras(minutos: number | null): string {
  if (minutos == null) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function HorarioLaboralField({
  jornada,
  defaultValue,
  readOnly,
}: {
  jornada: string;
  defaultValue?: string | null;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState<HorarioLaboral | HorarioTexto | null>(() =>
    horarioInicialParaJornada(jornada, defaultValue),
  );
  const legado = parseHorario(defaultValue)?.tipo === "TEXTO" ? defaultValue : null;

  useEffect(() => {
    setValue((prev) => {
      if (jornada === "TIEMPO_COMPLETO" && prev?.tipo === "COMPLETO") return prev;
      if (jornada === "TIEMPO_PARCIAL" && prev?.tipo === "PARCIAL") return prev;
      return horarioInicialParaJornada(jornada, defaultValue);
    });
  }, [jornada, defaultValue]);

  const serialized = useMemo(() => {
    if (!value) return "";
    if (value.tipo === "TEXTO") return value.texto;
    return serializeHorario(value);
  }, [value]);

  if (!jornada) {
    return (
      <div className="sm:col-span-2">
        <input type="hidden" name="horario" value={defaultValue ?? ""} />
        <p className="text-sm text-muted-foreground">Elija la jornada para armar el horario del contrato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <input type="hidden" name="horario" value={serialized} />
      {value?.tipo === "COMPLETO" ? (
        <HorarioCompletoEditor value={value} readOnly={readOnly} onChange={setValue} />
      ) : null}
      {value?.tipo === "PARCIAL" ? (
        <HorarioParcialEditor value={value} readOnly={readOnly} onChange={setValue} />
      ) : null}
      {legado && value?.tipo !== "TEXTO" ? (
        <p className="text-xs text-muted-foreground">Texto anterior: {legado}</p>
      ) : null}
    </div>
  );
}

function TimeInput({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="time"
        className={fieldClass}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DiaSelect({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: DiaSemana;
  readOnly?: boolean;
  onChange: (value: DiaSemana) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className={fieldClass}
        value={value}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value as DiaSemana)}
      >
        {DIAS_SEMANA.map((dia) => (
          <option key={dia} value={dia}>
            {DIA_LABEL[dia]}
          </option>
        ))}
      </select>
    </label>
  );
}

function HorarioCompletoEditor({
  value,
  readOnly,
  onChange,
}: {
  value: HorarioCompleto;
  readOnly?: boolean;
  onChange: (value: HorarioCompleto) => void;
}) {
  const horas = horasEfectivasCompleto(value);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Horario</p>
      <p className="text-xs text-muted-foreground">
        En tiempo completo el contrato lo redacta en un párrafo: días, entrada, salida y refrigerio.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <DiaSelect
          label="Desde el"
          value={value.diaInicio}
          readOnly={readOnly}
          onChange={(diaInicio) => onChange({ ...value, diaInicio })}
        />
        <DiaSelect
          label="Hasta el"
          value={value.diaFin}
          readOnly={readOnly}
          onChange={(diaFin) => onChange({ ...value, diaFin })}
        />
        <TimeInput label="Ingreso" value={value.desde} readOnly={readOnly} onChange={(desde) => onChange({ ...value, desde })} />
        <TimeInput label="Salida" value={value.hasta} readOnly={readOnly} onChange={(hasta) => onChange({ ...value, hasta })} />
        <TimeInput
          label="Refrigerio desde"
          value={value.refrigerioDesde}
          readOnly={readOnly}
          onChange={(refrigerioDesde) => onChange({ ...value, refrigerioDesde })}
        />
        <TimeInput
          label="Refrigerio hasta"
          value={value.refrigerioHasta}
          readOnly={readOnly}
          onChange={(refrigerioHasta) => onChange({ ...value, refrigerioHasta })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Efectivas: {formatoHoras(horas?.dia ?? null)} por día
        {horas ? ` · ${formatoHoras(horas.semana)} por semana` : ""}
      </p>
      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">{formatClausulaCompleto(value)}</p>
    </div>
  );
}

function HorarioParcialEditor({
  value,
  readOnly,
  onChange,
}: {
  value: HorarioParcial;
  readOnly?: boolean;
  onChange: (value: HorarioParcial) => void;
}) {
  const semana = horasEfectivasSemanaParcial(value);

  function setBloque(index: number, bloque: HorarioBloque) {
    onChange({
      ...value,
      bloques: value.bloques.map((item, i) => (i === index ? bloque : item)),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Horario</p>
      <p className="text-xs text-muted-foreground">
        Si hay mañana y tarde, el hueco se redacta como horario de refrigerio. El tope semanal sale en la cláusula.
      </p>
      {value.bloques.map((bloque, index) => {
        const porDia = horasEfectivasBloque(bloque);
        return (
          <div key={index} className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Bloque {index + 1}</p>
              {!readOnly && value.bloques.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange({ ...value, bloques: value.bloques.filter((_, i) => i !== index) })
                  }
                >
                  Quitar bloque
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => {
                const checked = bloque.dias.includes(dia);
                return (
                  <label key={dia} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => {
                        const dias = checked ? bloque.dias.filter((d) => d !== dia) : [...bloque.dias, dia];
                        setBloque(index, { ...bloque, dias: DIAS_SEMANA.filter((d) => dias.includes(d)) });
                      }}
                    />
                    {DIA_LABEL[dia]}
                  </label>
                );
              })}
            </div>
            {bloque.tramos.map((tramo, tIndex) => (
              <div key={tIndex} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <TimeInput
                  label="Desde"
                  value={tramo.desde}
                  readOnly={readOnly}
                  onChange={(desde) =>
                    setBloque(index, {
                      ...bloque,
                      tramos: bloque.tramos.map((item, i) => (i === tIndex ? { ...item, desde } : item)),
                    })
                  }
                />
                <TimeInput
                  label="Hasta"
                  value={tramo.hasta}
                  readOnly={readOnly}
                  onChange={(hasta) =>
                    setBloque(index, {
                      ...bloque,
                      tramos: bloque.tramos.map((item, i) => (i === tIndex ? { ...item, hasta } : item)),
                    })
                  }
                />
                {!readOnly && bloque.tramos.length > 1 ? (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setBloque(index, { ...bloque, tramos: bloque.tramos.filter((_, i) => i !== tIndex) })
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!readOnly ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBloque(index, { ...bloque, tramos: [...bloque.tramos, { desde: "", hasta: "" }] })}
              >
                Agregar tramo
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">Efectivas: {formatoHoras(porDia)} por día</p>
          </div>
        );
      })}
      {!readOnly ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              bloques: [...value.bloques, { dias: [], tramos: [{ desde: "", hasta: "" }] }],
            })
          }
        >
          Agregar bloque
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">Total semana: {formatoHoras(semana)}</p>
      <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
        <HorarioContratoVista value={value} />
      </div>
    </div>
  );
}
