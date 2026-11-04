"use client";

import { Label } from "./components";
import { InfoHintButton } from "./info-hint-button";

export type CategoriaBienKey = "ACTIVO" | "CUENTA_ORDEN" | "MENAJE";

export interface CategoriaBienOpcion {
  key: CategoriaBienKey;
  titulo: string;
  descripcion: string;
  ejemplos: string;
}

interface CategoriaBienSelectorProps {
  value: CategoriaBienKey;
  onChange: (value: CategoriaBienKey) => void;
  ayuda: string;
  opciones: CategoriaBienOpcion[];
  className?: string;
  headerClassName?: string;
}

export function CategoriaBienSelector({
  value,
  onChange,
  ayuda,
  opciones,
  className = "grid gap-3 sm:grid-cols-2",
  headerClassName,
}: CategoriaBienSelectorProps) {
  return (
    <div className={className}>
      <div className={headerClassName ?? "sm:col-span-2"}>
        <div className="flex items-center gap-1.5">
          <Label>Categoría</Label>
          <InfoHintButton title="¿Cómo elegir la categoría?">
            <p>{ayuda}</p>
          </InfoHintButton>
        </div>
      </div>
      {opciones.map((opcion) => (
        <label
          key={opcion.key}
          className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="radio"
            name="categoria"
            value={opcion.key}
            checked={value === opcion.key}
            onChange={() => onChange(opcion.key)}
            className="shrink-0"
          />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm">
            <strong>{opcion.titulo}</strong>
            <InfoHintButton title={opcion.titulo}>
              <p>{opcion.descripcion}</p>
              <p>
                <span className="font-medium text-foreground">Ejemplos: </span>
                {opcion.ejemplos}
              </p>
            </InfoHintButton>
          </span>
        </label>
      ))}
    </div>
  );
}
