import { useEffect, useState } from "react";
import type { Entidad, SedeConConteo } from "@inventario/types";
import { EspaciosGestionPanel, Select } from "@inventario/ui";
import { PanelBanner, panelFieldsetClass } from "@inventario/ui/panel";
import {
  createEspacio,
  deleteEspacio,
  ensureEspaciosHasta,
  listEspacios,
  listSedesConConteo,
  updateEspacio,
} from "../lib/ubicacion";

export function EspaciosView({
  entidades,
  entidadId,
  onEntidadChange,
}: {
  entidades: Entidad[];
  entidadId: string;
  onEntidadChange: (id: string) => void;
}) {
  const [sedes, setSedes] = useState<SedeConConteo[]>([]);
  const entidad = entidades.find((e) => e.id === entidadId);

  useEffect(() => {
    if (!entidadId) {
      setSedes([]);
      return;
    }
    let cancelled = false;
    void listSedesConConteo(entidadId).then((data) => {
      if (!cancelled) setSedes(data);
    });
    return () => {
      cancelled = true;
    };
  }, [entidadId]);

  return (
    <div className="space-y-4">
      {entidades.length > 1 ? (
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <fieldset className={panelFieldsetClass}>
            <legend className="px-1 text-sm font-semibold text-foreground">Entidad de trabajo</legend>
            <Select
              value={entidadId}
              onChange={onEntidadChange}
              options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
            />
          </fieldset>
          {entidad ? (
            <PanelBanner
              label="Entidad"
              title={entidad.nombre}
              subtitle={entidad.ruc ? `RUC ${entidad.ruc}` : undefined}
            />
          ) : null}
        </div>
      ) : null}

      {entidadId ? (
        <EspaciosGestionPanel
          key={entidadId}
          sedes={sedes}
          onList={listEspacios}
          onCreate={async (sedeId, nombre, descripcion) => {
            const result = await createEspacio(sedeId, nombre, descripcion);
            return result.error ? { error: result.error } : {};
          }}
          onEnsureHasta={async (sedeId, cantidad, descripcion) => {
            const result = await ensureEspaciosHasta(sedeId, cantidad, descripcion);
            return result.error ? { error: result.error } : { creados: result.creados };
          }}
          onUpdateDescripcion={async (espacioId, descripcion) => {
            const result = await updateEspacio(espacioId, descripcion);
            return result.error ? { error: result.error } : {};
          }}
          onDelete={async (espacioId) => {
            const result = await deleteEspacio(espacioId);
            return result.error ? { error: result.error } : {};
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Seleccione una entidad para gestionar sus espacios.</p>
      )}
    </div>
  );
}
