"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SedeConConteo } from "@inventario/types";
import { Button, Dialog, Input, Label } from "@inventario/ui";
import {
  AmbientesIcon,
  DeleteIcon,
  EditIcon,
  PanelDataTable,
  PanelIconAction,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  PanelToolbar,
  SUCURSALES_TABLE_COL_WIDTHS_PCT,
  panelTableBodyRowClass,
  panelTableHeadRowClass,
  panelTableMutedClass,
  panelTableNowrapCellClass,
  panelTableShrinkCellClass,
  panelTableStickyHeadClass,
} from "@inventario/ui/panel";
import { createSede, deleteSede, updateSede } from "@/lib/actions/ubicacion";
import {
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
  StatusBadge,
} from "./panel-ui";

interface GestionarSucursalesProps {
  entidadId: string;
  sedes: SedeConConteo[];
  onSedesChange?: (sedes: SedeConConteo[]) => void;
  onViewAmbientes?: (sedeId: string) => void;
}

export function GestionarSucursales({
  entidadId,
  sedes: initial,
  onSedesChange,
  onViewAmbientes,
}: GestionarSucursalesProps) {
  const router = useRouter();
  const [sedes, setSedes] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSede, setEditSede] = useState<SedeConConteo | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSedes(initial);
  }, [initial]);

  function updateSedes(next: SedeConConteo[]) {
    setSedes(next);
    onSedesChange?.(next);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    const nombre = String(new FormData(form).get("nombre"));
    const direccion = String(new FormData(form).get("direccion") || "");
    const result = await createSede(entidadId, nombre, direccion);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    updateSedes([...sedes, { ...result.data!, ambiente_count: 0 }]);
    setCreateOpen(false);
    form.reset();
    router.refresh();
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editSede) return;
    setPending(true);
    setMessage(null);
    const nombre = String(new FormData(event.currentTarget).get("nombre"));
    const direccion = String(new FormData(event.currentTarget).get("direccion") || "");
    const result = await updateSede(editSede.id, nombre, direccion);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    updateSedes(
      sedes.map((s) =>
        s.id === editSede.id
          ? { ...s, nombre: nombre.trim(), direccion: direccion.trim() || null }
          : s,
      ),
    );
    setEditSede(null);
    router.refresh();
  }

  async function handleDelete(sede: SedeConConteo) {
    if (!confirm(`¿Eliminar la sucursal "${sede.nombre}"?`)) return;
    setMessage(null);
    const result = await deleteSede(sede.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    updateSedes(sedes.filter((s) => s.id !== sede.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PanelToolbar
        left={<PanelCountLabel count={sedes.length} singular="sucursal" plural="sucursales" />}
        right={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            + Nueva sucursal
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        Puede renombrar cualquier sucursal. Solo puede eliminar las que no tengan ambientes
        asociados. La sucursal Principal no se puede editar ni eliminar.
      </p>

      {message && <PanelFlashMessage variant="error">{message}</PanelFlashMessage>}

      {sedes.length === 0 ? (
        <PanelEmptyState
          message="No hay sucursales registradas."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              + Crear primera sucursal
            </Button>
          }
        />
      ) : (
        <PanelDataTable>
          <PanelTableColgroup widths={SUCURSALES_TABLE_COL_WIDTHS_PCT} />
          <thead className={panelTableStickyHeadClass}>
            <tr className={panelTableHeadRowClass}>
              <PanelTableTh>Sucursal</PanelTableTh>
              <PanelTableTh>Dirección</PanelTableTh>
              <PanelTableTh align="center" className={panelTableShrinkCellClass}>
                Ambientes
              </PanelTableTh>
              <PanelTableTh className={panelTableNowrapCellClass}>Tipo</PanelTableTh>
              <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                Acciones
              </PanelTableTh>
            </tr>
          </thead>
          <tbody>
            {sedes.map((sede) => (
              <tr key={sede.id} className={panelTableBodyRowClass}>
                <PanelTableTd className="font-medium" title={sede.nombre}>
                  {onViewAmbientes ? (
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      title="Ver ambientes de esta sucursal"
                      onClick={() => onViewAmbientes(sede.id)}
                    >
                      {sede.nombre}
                    </button>
                  ) : (
                    sede.nombre
                  )}
                </PanelTableTd>
                <PanelTableTd className={panelTableMutedClass} title={sede.direccion ?? undefined}>
                  {sede.direccion ?? "—"}
                </PanelTableTd>
                <PanelTableTd align="center" className={panelTableShrinkCellClass}>
                  {onViewAmbientes ? (
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      title="Ver ambientes de esta sucursal"
                      onClick={() => onViewAmbientes(sede.id)}
                    >
                      {sede.ambiente_count}
                    </button>
                  ) : (
                    sede.ambiente_count
                  )}
                </PanelTableTd>
                <PanelTableTd className={panelTableNowrapCellClass}>
                  {sede.es_principal ? (
                    <StatusBadge variant="active">Principal</StatusBadge>
                  ) : (
                    <span className={panelTableMutedClass}>Secundaria</span>
                  )}
                </PanelTableTd>
                <PanelTableTd align="right" className={`overflow-visible ${panelTableNowrapCellClass}`}>
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    {onViewAmbientes && (
                      <PanelIconAction
                        label="Ambientes"
                        onClick={() => onViewAmbientes(sede.id)}
                      >
                        <AmbientesIcon />
                      </PanelIconAction>
                    )}
                    {!sede.es_principal && (
                      <>
                        <PanelIconAction label="Editar" onClick={() => setEditSede(sede)}>
                          <EditIcon />
                        </PanelIconAction>
                        <PanelIconAction
                          label="Eliminar"
                          variant="danger"
                          onClick={() => handleDelete(sede)}
                        >
                          <DeleteIcon />
                        </PanelIconAction>
                      </>
                    )}
                  </div>
                </PanelTableTd>
              </tr>
            ))}
          </tbody>
        </PanelDataTable>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva sucursal">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sucursal_nombre">Nombre</Label>
            <Input id="sucursal_nombre" name="nombre" required placeholder="Ej. Chupaca" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sucursal_direccion">Dirección</Label>
            <Input
              id="sucursal_direccion"
              name="direccion"
              placeholder="Ej. Av. Principal 123, Chupaca"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Crear
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!editSede} onClose={() => setEditSede(null)} title="Editar sucursal">
        {editSede && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_sucursal">Nombre</Label>
              <Input id="edit_sucursal" name="nombre" required defaultValue={editSede.nombre} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_sucursal_direccion">Dirección</Label>
              <Input
                id="edit_sucursal_direccion"
                name="direccion"
                defaultValue={editSede.direccion ?? ""}
                placeholder="Ej. Av. Principal 123, Chupaca"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditSede(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
