"use client";

import { useRouter } from "next/navigation";
import { MostrarBajasCheck } from "@/components/MostrarBajasCheck";

export function PlanillasVistaBajas({
  entidadId,
  checked,
  hrefBase,
}: {
  entidadId: string;
  checked: boolean;
  hrefBase: string;
}) {
  const router = useRouter();
  return (
    <MostrarBajasCheck
      entidadId={entidadId}
      checked={checked}
      onCheckedChange={(next) => {
        const params = new URLSearchParams(window.location.search);
        if (entidadId) params.set("entidadId", entidadId);
        if (next) params.set("bajas", "1");
        else params.delete("bajas");
        // Sin basePath: el router de Next ya lo antepone (p. ej. /planillas).
        const query = params.toString();
        router.replace(query ? `${hrefBase}?${query}` : hrefBase);
      }}
    />
  );
}
