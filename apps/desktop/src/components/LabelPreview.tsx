import { useEffect, useState, type ReactNode } from "react";
import { normalizeCodigoBarrasDisplay } from "@inventario/types";
import { formatLineaInventarioEtiqueta, LABEL_HEIGHT_MM, LABEL_WIDTH_MM } from "../lib/zpl";
import { fetchLabelaryPreviewPng } from "../lib/labelary-preview";

interface LabelPreviewProps {
  previewZpl: string;
  entidadNombre: string;
  codigoBarras: string;
  nombreBien: string;
  fechaAdquisicion?: string | null;
}

const labelFrameStyle = {
  width: `${LABEL_WIDTH_MM}mm`,
  height: `${LABEL_HEIGHT_MM}mm`,
} as const;

function LabelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex justify-center">
      <div
        className="relative overflow-hidden rounded-md border-2 border-border bg-white shadow-sm"
        style={labelFrameStyle}
      >
        {children}
      </div>
    </div>
  );
}

function LabelDataSummary({
  nombreBien,
  codigoBarras,
  entidadNombre,
  fechaAdquisicion,
}: {
  nombreBien: string;
  codigoBarras: string;
  entidadNombre: string;
  fechaAdquisicion?: string | null;
}) {
  const lineaAnios = formatLineaInventarioEtiqueta(fechaAdquisicion);
  const codigoLegible = normalizeCodigoBarrasDisplay(codigoBarras);

  return (
    <LabelFrame>
      <div className="flex h-full flex-col justify-between p-[1.5mm] text-center leading-tight text-black">
        <p className="text-[2.2mm] font-bold uppercase">{nombreBien.toUpperCase()}</p>
        <div className="space-y-[0.5mm]">
          <p className="text-[2.4mm] font-semibold tabular-nums">{codigoLegible}</p>
          <p
            className={
              lineaAnios.centered
                ? "text-[1.8mm] text-gray-700"
                : "pl-[5.6mm] text-[1.8mm] text-gray-700"
            }
          >
            {lineaAnios.text}
          </p>
          <p className="text-[2mm] font-bold uppercase">{entidadNombre.toUpperCase()}</p>
        </div>
      </div>
    </LabelFrame>
  );
}

export function LabelPreview({
  previewZpl,
  entidadNombre,
  codigoBarras,
  nombreBien,
  fechaAdquisicion,
}: LabelPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setUsedFallback(false);
      setImageUrl(null);

      const result = await fetchLabelaryPreviewPng(previewZpl);
      if (cancelled) {
        if (result.ok) URL.revokeObjectURL(result.objectUrl);
        return;
      }

      if (result.ok) {
        revoked = result.objectUrl;
        setImageUrl(result.objectUrl);
        setUsedFallback(false);
      } else {
        setUsedFallback(true);
      }
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [previewZpl]);

  if (loading) {
    return (
      <LabelFrame>
        <div className="flex h-full items-center justify-center text-[2mm] text-muted-foreground">
          Generando…
        </div>
      </LabelFrame>
    );
  }

  if (imageUrl && !usedFallback) {
    return (
      <LabelFrame>
        <img
          src={imageUrl}
          alt="Vista previa de etiqueta"
          className="block h-full w-full object-fill"
          draggable={false}
        />
      </LabelFrame>
    );
  }

  return (
    <div className="space-y-2">
      <LabelDataSummary
        nombreBien={nombreBien}
        codigoBarras={codigoBarras}
        entidadNombre={entidadNombre}
        fechaAdquisicion={fechaAdquisicion}
      />
      <p className="text-center text-xs text-muted-foreground">
        Sin conexión o vista previa no disponible. Puede imprimir una prueba.
      </p>
    </div>
  );
}
