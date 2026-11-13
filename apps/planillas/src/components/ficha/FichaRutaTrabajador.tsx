"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@inventario/ui";

export function FichaRutaTrabajador({
  entidadId,
  empresa,
  trabajadores,
  relacionId,
  query,
  raiz = "Trabajador",
  hrefRaiz,
  destinoPrefijo,
  destinoSufijo = "",
}: {
  entidadId: string;
  empresa: string;
  trabajadores: { id: string; etiqueta: string }[];
  relacionId: string;
  query?: string;
  raiz?: string;
  hrefRaiz?: string;
  destinoPrefijo?: string;
  destinoSufijo?: string;
}) {
  const router = useRouter();
  const sufijo = query ? `?${query.replace(/^\?/, "")}` : "";

  return (
    <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs sm:text-sm">
      <Link href={hrefRaiz ?? `/?entidadId=${entidadId}`} className="shrink-0 text-primary hover:underline">
        {raiz}
      </Link>
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        ›
      </span>
      <span className="min-w-0 max-w-[9rem] truncate text-foreground sm:max-w-[14rem]" title={empresa}>
        {empresa}
      </span>
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        ›
      </span>
      <div className="min-w-0 max-w-[16rem] flex-1 sm:max-w-xs">
        <Select
          aria-label="Trabajador"
          size="compact"
          value={relacionId}
          disabled={trabajadores.length < 2}
          options={trabajadores.map((trabajador) => ({
            value: trabajador.id,
            label: trabajador.etiqueta,
          }))}
          onChange={(value) => {
            if (value === relacionId) return;
            const destino = destinoPrefijo
              ? `${destinoPrefijo}${value}${destinoSufijo}`
              : `/trabajadores/${value}${sufijo}`;
            router.push(destino);
          }}
          className="!h-7 !max-w-full !border-0 !bg-transparent !pl-1 !pr-7 !text-xs !font-medium !text-foreground !shadow-none sm:!text-sm"
        />
      </div>
    </nav>
  );
}
