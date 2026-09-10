import {
  estructuraHorarioParcial,
  formatClausulaCompleto,
  parseHorario,
  type HorarioGuardado,
  type HorarioLaboral,
} from "@/lib/horario-laboral";

export function HorarioContratoVista({
  value,
  className,
}: {
  value: string | HorarioLaboral | HorarioGuardado | null | undefined;
  className?: string;
}) {
  const parsed = typeof value === "object" && value ? value : parseHorario(typeof value === "string" ? value : null);
  if (!parsed) return <p className={className}>—</p>;
  if (parsed.tipo === "COMPLETO") {
    return <p className={className}>{formatClausulaCompleto(parsed)}</p>;
  }
  if (parsed.tipo === "TEXTO") {
    return <p className={`whitespace-pre-line ${className ?? ""}`}>{parsed.texto}</p>;
  }

  const data = estructuraHorarioParcial(parsed);
  return (
    <div className={className}>
      {data.intro ? <p>{data.intro}</p> : null}
      <ul className="mt-2 list-disc space-y-2 pl-5">
        {data.bloques.map((bloque) => (
          <li key={bloque.titulo}>
            <span>{bloque.titulo}</span>
            {bloque.items.length > 0 ? (
              <ul className="mt-1 list-[circle] space-y-1 pl-5">
                {bloque.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {data.total ? <li>{data.total}</li> : null}
      </ul>
    </div>
  );
}
