"use client";

import { CATALOGO_CLASES_OPCIONES } from "@inventario/types";
import { CatalogoListaSelectField, type CatalogoListaSelectFieldProps } from "./catalogo-lista-select-field";

export type ClaseCatalogoComboboxProps = Omit<
  CatalogoListaSelectFieldProps,
  "label" | "opciones" | "emptyOptionLabel" | "confirmLabel" | "personalizadoTag" | "customHint" | "opcionTipo"
> & {
  label?: string;
  clases?: string[];
  opciones?: string[];
  suggestedClase?: string | null;
};

export function ClaseCatalogoCombobox({
  id = "catalogo_clase",
  label = "Clase",
  clases = [...CATALOGO_CLASES_OPCIONES],
  personalizadas = [],
  suggestedClase = null,
  helperText = "Seleccione una clase de la lista o elija «Otros» para escribir una personalizada.",
  opciones,
  suggestedValue,
  ...rest
}: ClaseCatalogoComboboxProps) {
  return (
    <CatalogoListaSelectField
      id={id}
      label={label}
      opciones={opciones ?? clases}
      personalizadas={personalizadas}
      opcionTipo="clase"
      suggestedValue={suggestedClase ?? suggestedValue ?? null}
      helperText={helperText}
      emptyOptionLabel="Seleccione una clase"
      confirmLabel="Usar esta clase"
      personalizadoTag="clase personalizada"
      customHint={
        <>
          Clase personalizada. Ej.: <strong>25 OTROS SUMINISTROS</strong>
        </>
      }
      customPlaceholder="25 OTROS SUMINISTROS"
      {...rest}
    />
  );
}
