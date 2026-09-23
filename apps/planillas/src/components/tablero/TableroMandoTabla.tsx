import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
import { etiquetaMesAsistencia } from "@/lib/horario-asistencia";
import { TABLERO_COLUMNAS, type TableroCelda, type TableroColor } from "@/lib/tablero";
import type { TableroFila } from "@/lib/actions/tablero";
import { TableroMarcaToggle } from "@/components/tablero/TableroMarcaToggle";
import { TableroMesBar } from "@/components/tablero/TableroMesBar";

const COLOR_CLASS: Record<TableroColor, string> = {
  gris: "bg-muted/70 text-muted-foreground",
  ambar: "bg-amber-100 text-amber-950 dark:bg-amber-900/70 dark:text-amber-50",
  rojo: "bg-red-100 font-semibold text-red-800 dark:bg-red-900/80 dark:text-red-50",
  verde: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-50",
};

function CeldaVista({
  celda,
  entidadId,
  mes,
}: {
  celda: TableroCelda;
  entidadId: string;
  mes: string;
}) {
  const marcas = celda.marcas ?? (celda.marca ? [celda.marca] : []);
  const inner = (
    <div className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center ${COLOR_CLASS[celda.color]}`}>
      <span className="text-sm leading-none">{celda.texto}</span>
      {marcas.length > 0 ? (
        <span className="flex flex-wrap justify-center gap-1">
          {marcas.map((marca) => (
            <TableroMarcaToggle
              key={marca.clave}
              entidadId={entidadId}
              mes={mes}
              clave={marca.clave}
              hecho={marca.hecho}
              label={marca.label}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
  if (celda.href && marcas.length === 0) {
    return (
      <Link href={celda.href} title={celda.titulo} className="block hover:opacity-90">
        {inner}
      </Link>
    );
  }
  if (celda.href) {
    return (
      <div title={celda.titulo}>
        {inner}
        <Link href={celda.href} className="mt-0.5 block text-center text-[10px] font-medium text-primary hover:underline">
          Ver
        </Link>
      </div>
    );
  }
  return <div title={celda.titulo}>{inner}</div>;
}

export function TableroMandoTabla({ mes, filas }: { mes: string; filas: TableroFila[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TableroMesBar mes={mes} />
        <p className="text-sm text-muted-foreground">{etiquetaMesAsistencia(mes)}. El día 1 se reinicia el período.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.verde}`}>Verde: listo</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.ambar}`}>Ámbar: pendiente</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.rojo}`}>Rojo: vence o atrasado</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.gris}`}>Gris: no aplica</span>
      </div>

      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-medium">Empresa</th>
              {TABLERO_COLUMNAS.map((col) => (
                <th key={col.id} className="px-2 py-2 text-center text-[11px] font-medium leading-tight" title={col.etiqueta}>
                  {col.corto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-muted-foreground" colSpan={TABLERO_COLUMNAS.length + 1}>
                  No hay empresas con Planillas activas.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.entidadId} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    <p className="font-medium text-foreground">{fila.etiqueta}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[fila.peCodigo, fila.ruc].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  {TABLERO_COLUMNAS.map((col) => (
                    <td key={col.id} className="px-1.5 py-1.5 align-top">
                      <CeldaVista celda={fila.celdas[col.id]} entidadId={fila.entidadId} mes={mes} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
