import { DIAS_SEMANA, DIA_LABEL } from "@/lib/horario-laboral";
import { DIA_LETRA, formatoHorasDia, semanaHorasDeHorario } from "@/lib/horario-asistencia";

function celdasHoras(horario: string | null) {
  const semana = semanaHorasDeHorario(horario);
  if (semana.estado === "vacio") {
    return (
      <td colSpan={7} className="border border-border px-2 py-2 text-center text-muted-foreground">
        Sin horario
      </td>
    );
  }
  if (semana.estado === "texto") {
    return (
      <td colSpan={7} className="border border-border px-2 py-2 text-center text-muted-foreground">
        Horario en texto
      </td>
    );
  }
  return DIAS_SEMANA.map((dia) => {
    const minutos = semana.minutos[dia];
    const noTrabaja = minutos == null;
    return (
      <td
        key={dia}
        className="w-12 border border-border px-1 py-2 text-center"
        title={noTrabaja ? `${DIA_LABEL[dia]}: no trabaja` : `${DIA_LABEL[dia]}: ${formatoHorasDia(minutos)} h`}
      >
        {noTrabaja ? (
          <span className="font-semibold text-red-600 dark:text-red-400" aria-label="No trabaja">
            X
          </span>
        ) : (
          <span className="tabular-nums">{formatoHorasDia(minutos)}</span>
        )}
      </td>
    );
  });
}

export function AsistenciaDiaEncabezados({ rowSpan }: { rowSpan?: number }) {
  return DIAS_SEMANA.map((dia) => (
    <th
      key={dia}
      scope="col"
      rowSpan={rowSpan}
      aria-label={DIA_LABEL[dia]}
      className="w-12 max-w-12 border border-amber-300 bg-amber-200 px-0.5 py-2 text-center text-sm font-bold text-foreground align-middle dark:border-amber-800 dark:bg-amber-900/50"
    >
      {DIA_LETRA[dia]}
    </th>
  ));
}

function encabezadoDias() {
  return (
    <tr className="bg-amber-200 dark:bg-amber-900/50">
      <AsistenciaDiaEncabezados />
    </tr>
  );
}

export function AsistenciaHorasCeldas({
  horario,
  activo = true,
}: {
  horario: string | null;
  activo?: boolean;
}) {
  if (!activo) {
    return DIAS_SEMANA.map((dia) => (
      <td key={dia} className="w-12 border border-border px-1 py-2 text-center text-muted-foreground">
        —
      </td>
    ));
  }
  return celdasHoras(horario);
}

export function AsistenciaDiasHoras({
  filas,
}: {
  filas: { id: string; etiqueta?: string; horario: string | null }[];
}) {
  if (filas.length === 0) return null;
  return (
    <div className="space-y-3">
      {filas.map((fila) => (
        <div key={fila.id} className="space-y-1">
          {fila.etiqueta ? <p className="text-xs text-muted-foreground">{fila.etiqueta}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>{encabezadoDias()}</thead>
              <tbody>
                <tr className="bg-background">{celdasHoras(fila.horario)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
