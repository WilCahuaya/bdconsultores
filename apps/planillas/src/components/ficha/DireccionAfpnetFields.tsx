"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { CopiarValor, Field, SelectField, fieldClass } from "@/components/fields";
import { armarDireccionPersona, opcionesTipoVia } from "@/lib/planillas-labels";
import {
  autoSeleccionarUbigeo,
  canonizarUbigeo,
  distritosPeru,
  filtrarUbigeo,
  provinciasPeru,
  regionesPeru,
} from "@/lib/ubigeo-peru";

export type DireccionAfpnetValue = {
  tipo_via: string;
  via_nombre: string;
  via_numero: string;
  referencia: string;
  region: string;
  provincia: string;
  distrito: string;
};

export function direccionAfpnetDesdePersona(persona: {
  tipo_via?: string | null;
  via_nombre?: string | null;
  via_numero?: string | null;
  referencia?: string | null;
  region?: string | null;
  provincia?: string | null;
  distrito?: string | null;
}): DireccionAfpnetValue {
  const region = canonizarUbigeo(regionesPeru(), persona.region);
  const provincia = canonizarUbigeo(provinciasPeru(region), persona.provincia);
  const distrito = canonizarUbigeo(distritosPeru(region, provincia), persona.distrito);
  return {
    tipo_via: persona.tipo_via ?? "",
    via_nombre: persona.via_nombre ?? "",
    via_numero: persona.via_numero ?? "",
    referencia: persona.referencia ?? "",
    region,
    provincia,
    distrito,
  };
}

function UbigeoCombobox({
  label,
  name,
  value,
  opciones,
  disabled,
  placeholder,
  inputRef,
  onChange,
  onPicked,
}: {
  label: string;
  name: string;
  value: string;
  opciones: string[];
  disabled?: boolean;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onPicked?: () => void;
}) {
  const listId = useId();
  const innerRef = useRef<HTMLInputElement>(null);
  const fieldRef = inputRef ?? innerRef;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const opcionesConValor = useMemo(() => {
    if (value && !opciones.includes(value)) return [value, ...opciones];
    return opciones;
  }, [opciones, value]);
  const filtradas = filtrarUbigeo(opcionesConValor, query);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function elegir(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
    onPicked?.();
  }

  function aplicarFiltro(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    const unico = autoSeleccionarUbigeo(opcionesConValor, nextQuery);
    if (unico && unico !== value) elegir(unico);
  }

  return (
    <label className="relative block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input type="hidden" name={name} value={value} />
      <input
        ref={fieldRef}
        className={fieldClass}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          fieldRef.current?.select();
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          const unico = autoSeleccionarUbigeo(opcionesConValor, query);
          if (unico) {
            if (unico !== value) onChange(unico);
            setQuery(unico);
            return;
          }
          setQuery(value);
        }}
        onChange={(event) => aplicarFiltro(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const unico = autoSeleccionarUbigeo(opcionesConValor, query) ?? filtradas[0];
            if (unico) elegir(unico);
          }
          if (event.key === "Escape") {
            setQuery(value);
            setOpen(false);
          }
        }}
      />
      {open && !disabled && filtradas.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {filtradas.slice(0, 80).map((item) => (
            <li key={item} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={item === value}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${item === value ? "bg-primary/10 font-medium text-primary" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => elegir(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

export function DireccionAfpnetFields({
  value,
  onChange,
  canWrite,
}: {
  value: DireccionAfpnetValue;
  onChange: (next: DireccionAfpnetValue) => void;
  canWrite: boolean;
}) {
  const provinciaInput = useRef<HTMLInputElement>(null);
  const distritoInput = useRef<HTMLInputElement>(null);
  const regiones = regionesPeru();
  const region = canonizarUbigeo(regiones, value.region);
  const provincias = provinciasPeru(region);
  const provincia = canonizarUbigeo(provincias, value.provincia);
  const distritos = distritosPeru(region, provincia);
  const distrito = canonizarUbigeo(distritos, value.distrito);
  const armada = armarDireccionPersona(value);

  function patch(partial: Partial<DireccionAfpnetValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <>
      <UbigeoCombobox
        label="Región"
        name="region"
        value={region}
        opciones={regiones}
        disabled={!canWrite}
        placeholder="Escriba iniciales, ej. Jun"
        onChange={(next) =>
          patch({
            region: canonizarUbigeo(regiones, next),
            provincia: "",
            distrito: "",
          })
        }
        onPicked={() => window.setTimeout(() => provinciaInput.current?.focus(), 50)}
      />
      <UbigeoCombobox
        label="Provincia"
        name="provincia"
        value={provincia}
        opciones={provincias}
        disabled={!canWrite || !region}
        placeholder={region ? "Escriba iniciales, ej. Hua" : "Primero elija región"}
        inputRef={provinciaInput}
        onChange={(next) =>
          patch({
            provincia: canonizarUbigeo(provincias, next),
            distrito: "",
          })
        }
        onPicked={() => window.setTimeout(() => distritoInput.current?.focus(), 50)}
      />
      <UbigeoCombobox
        label="Distrito"
        name="distrito"
        value={distrito}
        opciones={distritos}
        disabled={!canWrite || !provincia}
        placeholder={provincia ? "Escriba iniciales, ej. El T" : "Primero elija provincia"}
        inputRef={distritoInput}
        onChange={(next) => patch({ distrito: canonizarUbigeo(distritos, next) })}
      />
      <SelectField
        label="Tipo de vía"
        name="tipo_via"
        value={value.tipo_via}
        allowEmpty
        disabled={!canWrite}
        options={opcionesTipoVia(value.tipo_via)}
        onChange={(event) => patch({ tipo_via: event.target.value })}
      />
      <Field
        label="Nombre de avenida, calle o jirón"
        name="via_nombre"
        value={value.via_nombre}
        onChange={(event) => patch({ via_nombre: event.target.value })}
        readOnly={!canWrite}
      />
      <Field
        label="Número de casa"
        name="via_numero"
        value={value.via_numero}
        onChange={(event) => patch({ via_numero: event.target.value })}
        readOnly={!canWrite}
      />
      <Field
        label="Referencia"
        name="referencia"
        value={value.referencia}
        placeholder="Si no tiene número de casa"
        onChange={(event) => patch({ referencia: event.target.value })}
        readOnly={!canWrite}
      />
      <div className="sm:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Dirección para la ficha y AFPNet</p>
          {armada ? <CopiarValor value={armada} /> : null}
        </div>
        <p className="font-mono text-sm">{armada || "—"}</p>
        <input type="hidden" name="direccion" value={armada ?? ""} />
      </div>
    </>
  );
}
