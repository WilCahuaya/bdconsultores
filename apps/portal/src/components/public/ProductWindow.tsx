const ACTIVOS = [
  { nombre: "Escritorio metálico", codigo: "84111501-0003", estado: "Registrado" },
  { nombre: "Computadora de escritorio", codigo: "43211507-0012", estado: "Registrado" },
  { nombre: "Silla giratoria", codigo: "56101504-0008", estado: "En campo" },
] as const;

const BARRAS = [2, 1, 3, 1, 1, 4, 1, 2, 1, 3, 2, 1, 1, 2, 4, 1, 2, 1, 3, 1, 2, 1];

/** Vista del sistema de inventario. Los bienes son un ejemplo, no un cliente real. */
export function ProductWindow() {
  return (
    <figure className="relative origin-center rotate-[-6deg]">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </span>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            bdconsultores.org · Inventario de activos
          </p>
        </div>

        <div className="grid min-h-[280px] sm:grid-cols-[9.5rem_1fr]">
          <aside className="hidden border-r bg-muted/30 p-3 sm:block">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              B&amp;D
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="rounded-md bg-primary/15 px-2 py-1.5 font-medium text-primary">Inventario</li>
              <li className="px-2 py-1.5 text-muted-foreground">Catálogo</li>
              <li className="px-2 py-1.5 text-muted-foreground">Reportes</li>
            </ul>
          </aside>

          <div className="space-y-3 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Inventario de activos</p>
                <p className="text-xs text-muted-foreground">3 bienes en esta sede</p>
              </div>
              <p className="rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                Buscar código
              </p>
            </div>

            <ul className="space-y-2">
              {ACTIVOS.map((activo) => (
                <li
                  key={activo.codigo}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{activo.nombre}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{activo.codigo}</p>
                  </div>
                  <span
                    className={
                      activo.estado === "En campo"
                        ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        : "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary"
                    }
                  >
                    {activo.estado}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 w-40 -rotate-2 rounded-md border border-foreground/80 bg-card px-2.5 py-2 shadow-lg">
        <p className="text-[10px] font-bold tracking-wide text-primary">B&amp;D</p>
        <p className="truncate text-[11px] font-medium text-foreground">Escritorio metálico</p>
        <div className="mt-1 flex h-7 items-end gap-px" aria-hidden>
          {BARRAS.map((ancho, index) => (
            <span
              key={`${ancho}-${index}`}
              className="bg-foreground"
              style={{ width: ancho, height: index % 4 === 0 ? "100%" : "78%" }}
            />
          ))}
        </div>
        <p className="mt-0.5 text-center font-mono text-[9px] tracking-wide text-foreground">
          84111501-0003
        </p>
      </div>

      <figcaption className="sr-only">
        Vista de ejemplo del inventario en el sistema de B&amp;D, con la etiqueta que se pega al bien.
      </figcaption>
    </figure>
  );
}
