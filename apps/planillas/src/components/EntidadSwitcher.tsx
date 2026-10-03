"use client";

import { useRouter } from "next/navigation";
import { entidadEtiqueta, type Entidad } from "@inventario/types";

export function EntidadSwitcher({
  entidades,
  selectedId,
  locked,
  hrefBase = "/",
  queryExtra,
  inline = false,
}: {
  entidades: Entidad[];
  selectedId: string;
  locked?: boolean;
  hrefBase?: string;
  queryExtra?: string;
  inline?: boolean;
}) {
  const router = useRouter();

  const select = (
    <select
      aria-label="Empresa"
      className={
        inline
          ? "h-9 max-w-[min(100%,28rem)] rounded-md border border-input bg-background px-2 text-sm font-medium shadow-sm"
          : "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
      }
      value={selectedId}
      disabled={locked || entidades.length === 0}
      onChange={(event) => {
        const params = new URLSearchParams();
        params.set("entidadId", event.target.value);
        if (new URLSearchParams(window.location.search).get("bajas") === "1") params.set("bajas", "1");
        if (queryExtra) {
          new URLSearchParams(queryExtra.replace(/^&/, "")).forEach((value, key) => {
            params.set(key, value);
          });
        }
        router.push(`${hrefBase}?${params.toString()}`);
      }}
    >
        {entidades.map((entidad) => (
          <option key={entidad.id} value={entidad.id}>
            {entidadEtiqueta(entidad)}
            {entidad.ruc ? ` · RUC ${entidad.ruc}` : ""}
          </option>
        ))}
    </select>
  );

  if (inline) return select;

  return (
    <label className="block max-w-md space-y-1.5">
      <span className="text-sm font-medium text-foreground">Empresa</span>
      {select}
    </label>
  );
}
