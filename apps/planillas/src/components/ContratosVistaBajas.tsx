"use client";

import { useRouter } from "next/navigation";
import { MostrarBajasCheck } from "@/components/MostrarBajasCheck";

export function ContratosVistaBajas({
  entidadId,
  checked,
}: {
  entidadId: string;
  checked: boolean;
}) {
  const router = useRouter();
  return (
    <MostrarBajasCheck
      entidadId={entidadId}
      checked={checked}
      onCheckedChange={(next) => {
        const url = new URL(window.location.href);
        if (entidadId) url.searchParams.set("entidadId", entidadId);
        if (next) url.searchParams.set("bajas", "1");
        else url.searchParams.delete("bajas");
        router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      }}
    />
  );
}
