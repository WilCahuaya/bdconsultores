import type { ReactNode } from "react";
import type { CatalogoNacional } from "@inventario/types";
import { formatCuentaContableDisplay } from "@inventario/types";
import { panelTableMutedClass } from "./panel-list-table";
import {
  PanelTableTd,
  PanelTableTh,
  panelTableNameCellClass,
  panelTableNowrapCellClass,
} from "./panel-table-layout";
import type { PanelTableColSpec } from "./panel-table-layout";

export const CATALOGO_ITEM_TABLE_COLS: PanelTableColSpec[] = [
  { type: "shrink" },
  { type: "grow" },
  { type: "grow" },
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
];

export function catalogoCampoTexto(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export function CatalogoItemTableHead({
  actionsLabel,
}: {
  actionsLabel: string;
}) {
  return (
    <>
      <PanelTableTh className={panelTableNowrapCellClass}>Código</PanelTableTh>
      <PanelTableTh className={panelTableNameCellClass}>Denominación</PanelTableTh>
      <PanelTableTh>Grupo</PanelTableTh>
      <PanelTableTh>Clase</PanelTableTh>
      <PanelTableTh className={panelTableNowrapCellClass}>Código cuenta contable</PanelTableTh>
      <PanelTableTh>Nombre cuenta contable</PanelTableTh>
      <PanelTableTh className={panelTableNowrapCellClass}>Depreciación</PanelTableTh>
      <PanelTableTh>Resolución</PanelTableTh>
      <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
      <PanelTableTh align="right" className={panelTableNowrapCellClass}>
        {actionsLabel}
      </PanelTableTh>
    </>
  );
}

export function CatalogoItemTableCells({
  item,
  estadoBadge,
  actions,
}: {
  item: CatalogoNacional;
  estadoBadge: ReactNode;
  actions: ReactNode;
}) {
  return (
    <>
      <PanelTableTd className={`font-mono text-xs ${panelTableNowrapCellClass}`}>
        {item.codigo}
      </PanelTableTd>
      <PanelTableTd className={panelTableNameCellClass} title={item.denominacion}>
        {item.denominacion}
      </PanelTableTd>
      <PanelTableTd className={panelTableMutedClass} title={item.grupo ?? undefined}>
        {catalogoCampoTexto(item.grupo)}
      </PanelTableTd>
      <PanelTableTd className={panelTableMutedClass} title={item.clase ?? undefined}>
        {catalogoCampoTexto(item.clase)}
      </PanelTableTd>
      <PanelTableTd className={panelTableNowrapCellClass} title={item.cuenta_codigo ?? undefined}>
        {catalogoCampoTexto(item.cuenta_codigo)}
      </PanelTableTd>
      <PanelTableTd
        className={panelTableMutedClass}
        title={formatCuentaContableDisplay(item.cuenta_codigo, item.contabilidad)}
      >
        {catalogoCampoTexto(item.contabilidad)}
      </PanelTableTd>
      <PanelTableTd className={panelTableNowrapCellClass}>
        {catalogoCampoTexto(item.depreciacion)}
      </PanelTableTd>
      <PanelTableTd className={panelTableMutedClass} title={item.resolucion ?? undefined}>
        {catalogoCampoTexto(item.resolucion)}
      </PanelTableTd>
      <PanelTableTd className={panelTableNowrapCellClass}>{estadoBadge}</PanelTableTd>
      <PanelTableTd align="right" className={panelTableNowrapCellClass}>
        {actions}
      </PanelTableTd>
    </>
  );
}

export function CatalogoItemDetalle({
  item,
  origenLabel,
}: {
  item: CatalogoNacional;
  origenLabel: string;
}) {
  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Código", value: item.codigo },
    { label: "Denominación", value: item.denominacion },
    { label: "Grupo", value: item.grupo },
    { label: "Clase", value: item.clase },
    { label: "Código cuenta contable", value: item.cuenta_codigo },
    { label: "Nombre cuenta contable", value: item.contabilidad },
    { label: "Depreciación", value: item.depreciacion },
    { label: "Resolución", value: item.resolucion },
    { label: "Estado", value: item.estado },
    { label: "Origen", value: origenLabel },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd className="text-sm text-foreground">{catalogoCampoTexto(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
