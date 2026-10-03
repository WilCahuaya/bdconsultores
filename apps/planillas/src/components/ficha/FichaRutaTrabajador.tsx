"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function FichaRutaTrabajador({
  entidadId,
  empresa,
  trabajadores,
  relacionId,
  query,
  raiz = "Trabajador",
  hrefRaiz,
  hrefDestino,
}: {
  entidadId: string;
  empresa: string;
  trabajadores: { id: string; etiqueta: string }[];
  relacionId: string;
  query?: string;
  raiz?: string;
  hrefRaiz?: string;
  hrefDestino?: (relacionId: string) => string;
}) {
  const router = useRouter();
  const sufijo = query ? `?${query.replace(/^\?/, "")}` : "";

  return (
    <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
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
      <div className="relative min-w-0 max-w-[16rem] flex-1 sm:max-w-xs">
        <select
          aria-label="Trabajador"
          className="h-8 w-full cursor-pointer appearance-none truncate rounded-md bg-transparent py-1 pl-1 pr-6 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={relacionId}
          disabled={trabajadores.length < 2}
          onChange={(event) => {
            if (event.target.value === relacionId) return;
            const destino = hrefDestino
              ? hrefDestino(event.target.value)
              : `/trabajadores/${event.target.value}${sufijo}`;
            router.push(destino);
          }}
        >
          {trabajadores.map((trabajador) => (
            <option key={trabajador.id} value={trabajador.id}>
              {trabajador.etiqueta}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-muted-foreground" aria-hidden>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </nav>
  );
}
