import Link from "next/link";
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
        className="border border-border px-2 py-2 text-center"
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

function letraDia(dia: (typeof DIAS_SEMANA)[number]) {
  return (
    <>
      <span className="sr-only">{DIA_LABEL[dia]}</span>
      <span aria-hidden>{DIA_LETRA[dia]}</span>
    </>
  );
}

function encabezadoDias() {
  return (
    <tr className="bg-amber-200 dark:bg-amber-900/50">
      {DIAS_SEMANA.map((dia) => (
        <th
          key={dia}
          scope="col"
          className="w-14 border border-amber-300 px-1 py-2 text-center text-sm font-bold text-foreground dark:border-amber-800"
        >
          {letraDia(dia)}
        </th>
      ))}
    </tr>
  );
}

export function AsistenciaSemanaTabla({
  titulo,
  filas,
}: {
  titulo: string;
  filas: { id: string; nombre: string; href?: string; horario: string | null }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="bg-amber-200 dark:bg-amber-900/50">
            <th
              scope="col"
              className="border border-amber-300 px-3 py-2 text-center text-base font-bold uppercase text-red-600 dark:border-amber-800 dark:text-red-300"
            >
              {titulo}
            </th>
            {DIAS_SEMANA.map((dia) => (
              <th
                key={dia}
                scope="col"
                className="w-14 border border-amber-300 px-1 py-2 text-center font-bold text-foreground dark:border-amber-800"
              >
                {letraDia(dia)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-border px-4 py-8 text-muted-foreground">
                No hay trabajadores activos en este mes.
              </td>
            </tr>
          ) : (
            filas.map((fila) => (
              <tr key={fila.id} className="bg-background">
                <th scope="row" className="border border-border px-3 py-2 text-left font-medium uppercase">
                  {fila.href ? (
                    <Link href={fila.href} className="text-primary hover:underline">
                      {fila.nombre}
                    </Link>
                  ) : (
                    fila.nombre
                  )}
                </th>
                {celdasHoras(fila.horario)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
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
