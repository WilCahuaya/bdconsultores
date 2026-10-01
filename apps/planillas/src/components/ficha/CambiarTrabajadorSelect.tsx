"use client";

import { useRouter } from "next/navigation";

export function CambiarTrabajadorSelect({
  trabajadores,
  relacionId,
  query,
}: {
  trabajadores: { id: string; etiqueta: string }[];
  relacionId: string;
  query?: string;
}) {
  const router = useRouter();
  const sufijo = query ? `?${query.replace(/^\?/, "")}` : "";

  return (
    <label className="mt-3 block max-w-md space-y-1.5">
      <span className="text-sm font-medium text-foreground">Trabajador</span>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        value={relacionId}
        disabled={trabajadores.length < 2}
        onChange={(event) => {
          if (event.target.value === relacionId) return;
          router.push(`/trabajadores/${event.target.value}${sufijo}`);
        }}
      >
        {trabajadores.map((trabajador) => (
          <option key={trabajador.id} value={trabajador.id}>
            {trabajador.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
