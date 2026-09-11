"use client";

import { useRouter } from "next/navigation";
import type { Entidad } from "@inventario/types";

export function EntidadSwitcher({
  entidades,
  selectedId,
  locked,
  hrefBase = "/",
  queryExtra,
}: {
  entidades: Entidad[];
  selectedId: string;
  locked?: boolean;
  hrefBase?: string;
  queryExtra?: string;
}) {
  const router = useRouter();

  return (
    <label className="block max-w-md space-y-1.5">
      <span className="text-sm font-medium text-foreground">Empresa</span>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        value={selectedId}
        disabled={locked || entidades.length === 0}
        onChange={(event) => {
          const extra = queryExtra ? `&${queryExtra.replace(/^&/, "")}` : "";
          router.push(`${hrefBase}?entidadId=${event.target.value}${extra}`);
        }}
      >
        {entidades.map((entidad) => (
          <option key={entidad.id} value={entidad.id}>
            {entidad.nombre}
            {entidad.ruc ? ` · RUC ${entidad.ruc}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
