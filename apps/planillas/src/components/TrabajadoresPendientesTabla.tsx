"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { panelCardClass, PanelSearchInput } from "@inventario/ui/panel";
import type {
  CeldaPendiente,
  ColumnaPendienteId,
  ColorPendiente,
  ContratoGeneradoAviso,
  FilaPendienteTrabajador,
} from "@/lib/actions/pendientes";
import { formatNumeroTrabajador } from "@/lib/planillas-labels";

const COLOR_CLASS: Record<ColorPendiente, string> = {
  gris: "bg-muted/70 text-muted-foreground",
  ambar: "bg-amber-100 text-amber-950 dark:bg-amber-900/70 dark:text-amber-50",
  rojo: "bg-red-100 font-semibold text-red-800 dark:bg-red-900/80 dark:text-red-50",
  verde: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-50",
};

type DatoLaboralKey =
  | "cargoSigla"
  | "mesInicio"
  | "fechaIngreso"
  | "fechaCese"
  | "tiempo"
  | "remuneracion"
  | "asignacion"
  | "bruta";

const DATOS: { key: DatoLaboralKey; label: string; title: string; money?: boolean }[] = [
  { key: "cargoSigla", label: "Cargo", title: "Cargo" },
  { key: "mesInicio", label: "Mes", title: "Mes de inicio en la empresa" },
  { key: "fechaIngreso", label: "Inicio", title: "Fecha de inicio en la empresa" },
  { key: "fechaCese", label: "Cese", title: "Fin del último contrato firmado o con solicitud" },
  { key: "tiempo", label: "Tiempo", title: "Tiempo completo o parcial" },
  { key: "remuneracion", label: "Remuneración", title: "Remuneración", money: true },
  { key: "asignacion", label: "Asig. fam.", title: "Asignación familiar", money: true },
  { key: "bruta", label: "Rem. bruta", title: "Remuneración más asignación familiar", money: true },
];

const COLUMNAS: { id: ColumnaPendienteId; corto: string; estudio?: boolean }[] = [
  { id: "contrato", corto: "Contrato" },
  { id: "vidaLey", corto: "Vida Ley", estudio: true },
  { id: "asistencia", corto: "Asistencia" },
  { id: "vacaciones", corto: "Vacaciones" },
];

function textoBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function coincide(fila: FilaPendienteTrabajador, consulta: string) {
  const q = textoBusqueda(consulta.trim());
  if (!q) return true;
  return textoBusqueda([formatNumeroTrabajador(fila.numero), fila.nombre, fila.dni, fila.cargo].filter(Boolean).join(" ")).includes(q);
}

function tienePendiente(fila: FilaPendienteTrabajador, columnas: { id: ColumnaPendienteId }[]) {
  return columnas.some((col) => {
    const color = fila.celdas[col.id].color;
    return color === "ambar" || color === "rojo";
  });
}

function IconoDocumento({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function IconoContratoGenerado({ contrato }: { contrato: ContratoGeneradoAviso }) {
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!abierto) return;
    function cerrar(event: MouseEvent) {
      if (boton.current?.contains(event.target as Node)) return;
      setAbierto(false);
    }
    function cerrarScroll() {
      setAbierto(false);
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") setAbierto(false);
    }
    window.addEventListener("mousedown", cerrar);
    window.addEventListener("keydown", tecla);
    window.addEventListener("scroll", cerrarScroll, true);
    return () => {
      window.removeEventListener("mousedown", cerrar);
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", cerrarScroll, true);
    };
  }, [abierto]);

  function abrir() {
    const rect = boton.current?.getBoundingClientRect();
    if (rect) {
      const ancho = 220;
      const alto = 64;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - ancho - 8);
      const abajo = rect.bottom + 6;
      const top = abajo + alto > window.innerHeight ? Math.max(8, rect.top - alto - 6) : abajo;
      setPos({ top, left });
    }
    setAbierto((actual) => !actual);
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Ver fechas del contrato generado"
        aria-expanded={abierto}
      >
        <IconoDocumento className="h-3.5 w-3.5" />
      </button>
      {abierto
        ? createPortal(
            <div
              className="fixed z-50 w-[13.75rem] rounded-md border bg-card px-3 py-2 text-left text-xs shadow-md"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="font-medium">Contrato generado</p>
              <p className="mt-1 text-muted-foreground">
                Del {contrato.inicio} al {contrato.fin}.
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function CeldaCese({ laboral }: { laboral: FilaPendienteTrabajador["laboral"] }) {
  return (
    <div className="inline-flex items-center justify-center gap-1">
      <span
        title={laboral.ceseTitulo}
        className={laboral.ceseAlerta ? "font-medium text-red-600 dark:text-red-400" : undefined}
      >
        {laboral.fechaCese}
      </span>
      {laboral.contratoGenerado ? <IconoContratoGenerado contrato={laboral.contratoGenerado} /> : null}
    </div>
  );
}

function CeldaVista({ celda }: { celda: CeldaPendiente }) {
  const inner = (
    <div className={`flex min-h-8 items-center justify-center rounded-md px-1 py-1 text-center text-xs leading-none ${COLOR_CLASS[celda.color]}`}>
      {celda.texto}
    </div>
  );
  if (!celda.href) return <div title={celda.titulo}>{inner}</div>;
  return (
    <Link href={celda.href} title={celda.titulo} className="block hover:opacity-90">
      {inner}
    </Link>
  );
}

export function TrabajadoresPendientesTabla({
  filas,
  esEstudio,
  filtroExtra,
  vacioMensaje,
}: {
  filas: FilaPendienteTrabajador[];
  esEstudio: boolean;
  filtroExtra?: ReactNode;
  vacioMensaje?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const columnas = useMemo(() => COLUMNAS.filter((col) => !col.estudio || esEstudio), [esEstudio]);
  const visibles = useMemo(() => {
    return filas.filter((fila) => {
      if (soloPendientes && !tienePendiente(fila, columnas)) return false;
      return coincide(fila, consulta);
    });
  }, [filas, consulta, soloPendientes, columnas]);
  const filtrando = consulta.trim().length > 0 || soloPendientes;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full min-w-[16rem] sm:w-80">
            <PanelSearchInput value={consulta} onChange={setConsulta} placeholder="Buscar número, nombre o DNI…" />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={soloPendientes}
              onChange={(event) => setSoloPendientes(event.target.checked)}
            />
            Solo con pendientes
          </label>
          {filtroExtra}
        </div>
        <p className="text-sm text-muted-foreground">
          {filtrando
            ? `${visibles.length} de ${filas.length}`
            : `${filas.length} ${filas.length === 1 ? "trabajador" : "trabajadores"}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.verde}`}>Verde: al día</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.ambar}`}>Ámbar: pendiente</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.rojo}`}>Rojo: vence o vencido</span>
        <span className={`rounded px-2 py-1 ${COLOR_CLASS.gris}`}>Gris: no aplica</span>
      </div>

      <div className={panelCardClass}>
        <div className="max-h-[calc(100dvh-16rem)] overflow-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-12 min-w-12 border-b bg-muted px-2 py-2 text-center font-medium">
                  Nº
                </th>
                <th className="sticky left-12 top-0 z-30 w-[16rem] min-w-[16rem] border-b bg-muted px-3 py-2 font-medium">
                  Trabajador
                </th>
                {DATOS.map((col) => (
                  <th
                    key={col.key}
                    title={col.title}
                    className={`sticky top-0 z-20 whitespace-nowrap border-b bg-muted px-2 py-2 text-[11px] font-medium ${col.money ? "text-right" : "text-center"}`}
                  >
                    {col.label}
                  </th>
                ))}
                {columnas.map((col) => (
                  <th
                    key={col.id}
                    className="sticky top-0 z-20 border-b bg-muted px-2 py-2 text-center text-[11px] font-medium"
                  >
                    {col.corto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-muted-foreground" colSpan={columnas.length + DATOS.length + 2}>
                    {filas.length === 0
                      ? vacioMensaje ?? "No hay trabajadores en esta empresa."
                      : "Ningún trabajador coincide con el filtro."}
                  </td>
                </tr>
              ) : (
                visibles.map((fila) => {
                  const titulo = [fila.nombre, fila.dni, fila.cargo].filter(Boolean).join(" · ");
                  return (
                    <tr key={fila.id}>
                      <td className="sticky left-0 z-10 w-12 min-w-12 border-b bg-background px-2 py-1 text-center font-mono text-xs">
                        {formatNumeroTrabajador(fila.numero) || "—"}
                      </td>
                      <td className="sticky left-12 z-10 w-[16rem] min-w-[16rem] max-w-[16rem] border-b bg-background px-3 py-1">
                        <div className="flex min-w-0 items-baseline gap-2" title={titulo}>
                          <Link href={`/trabajadores/${fila.id}`} className="min-w-0 truncate font-medium text-primary hover:underline">
                            {fila.nombre}
                          </Link>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{fila.dni}</span>
                        </div>
                      </td>
                      {DATOS.map((col) => (
                        <td
                          key={col.key}
                          title={col.key === "cargoSigla" ? fila.laboral.cargoTitulo : col.key === "fechaCese" ? undefined : col.title}
                          className={`whitespace-nowrap border-b px-2 py-1 align-middle text-xs ${col.money ? "text-right tabular-nums" : "text-center"}`}
                        >
                          {col.key === "fechaCese" ? <CeldaCese laboral={fila.laboral} /> : fila.laboral[col.key]}
                        </td>
                      ))}
                      {columnas.map((col) => (
                        <td key={col.id} className="border-b px-1.5 py-1 align-middle">
                          <CeldaVista celda={fila.celdas[col.id]} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
