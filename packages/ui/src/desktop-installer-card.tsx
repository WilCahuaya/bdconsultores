const cardClass = "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm";

export interface DesktopInstallerCardProps {
  version: string;
  fileName: string | null;
  sizeLabel: string | null;
  updatedLabel: string | null;
  downloadHref: string | null;
  available: boolean;
}

export function DesktopInstallerCard({
  version,
  fileName,
  sizeLabel,
  updatedLabel,
  downloadHref,
  available,
}: DesktopInstallerCardProps) {
  return (
    <section className={`${cardClass} space-y-4 p-5 sm:p-6`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Windows 10 y 11
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          B&amp;D Consultores Inventario {version}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Aplicación de escritorio para el trabajo de campo y para imprimir etiquetas 50×25 mm en
          la impresora Honeywell. La web no envía esas etiquetas a la impresora.
        </p>
      </div>

      {available && downloadHref ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Archivo</dt>
            <dd className="mt-1 font-medium text-foreground">{fileName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tamaño</dt>
            <dd className="mt-1 font-medium text-foreground">{sizeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Compilado</dt>
            <dd className="mt-1 font-medium text-foreground">{updatedLabel}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          En este servidor todavía no hay un instalador publicado. Cuando se genere con el
          escritorio, aparecerá aquí para descargarlo.
        </p>
      )}

      {available && downloadHref ? (
        <a
          href={downloadHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Descargar instalador
        </a>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Windows puede indicar que la aplicación no está firmada. En ese aviso elija Más
        información y luego Ejecutar de todas formas.
      </p>
    </section>
  );
}
