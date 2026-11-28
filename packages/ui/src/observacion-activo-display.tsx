import { splitObservacionActivo } from "@inventario/types";

export function ObservacionActivoDisplay({
  observacion,
  className = "",
  lineClamp2,
}: {
  observacion?: string | null;
  className?: string;
  lineClamp2?: boolean;
}) {
  const { contador, admin } = splitObservacionActivo(observacion);
  if (!contador && !admin) return null;

  const clampClass = lineClamp2
    ? "line-clamp-2 text-xs leading-snug"
    : "whitespace-pre-wrap text-sm leading-snug";

  return (
    <span className={`${clampClass} uppercase ${className}`.trim()}>
      {contador ? <span className="text-foreground">{contador}</span> : null}
      {contador && admin ? <br /> : null}
      {admin ? <span className="text-blue-600 dark:text-blue-400">{admin}</span> : null}
    </span>
  );
}
