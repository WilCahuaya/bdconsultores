"use client";

import { PlanillasVistaBajas } from "@/components/PlanillasVistaBajas";

export function ContratosVistaBajas({
  entidadId,
  checked,
}: {
  entidadId: string;
  checked: boolean;
}) {
  return <PlanillasVistaBajas entidadId={entidadId} checked={checked} hrefBase="/contratos" />;
}
