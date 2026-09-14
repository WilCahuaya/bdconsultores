"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PlanillasNav({
  entidadId,
  esEstudio,
}: {
  entidadId?: string;
  esEstudio?: boolean;
}) {
  const pathname = usePathname();
  const query = entidadId ? `?entidadId=${entidadId}` : "";
  const trabajadoresActive = pathname === "/" || pathname.startsWith("/trabajadores");
  const pendientesActive = pathname.startsWith("/pendientes");
  const contratosActive = pathname.startsWith("/contratos");
  const vidaLeyActive = pathname.startsWith("/vida-ley");
  const asistenciasActive = pathname.startsWith("/asistencias");
  const vacacionesActive = pathname.startsWith("/vacaciones");

  const linkClass = (active: boolean) =>
    active
      ? "border-b-2 border-primary px-1 pb-2 text-sm font-medium text-primary"
      : "px-1 pb-2 text-sm text-muted-foreground hover:text-foreground";

  return (
    <nav className="flex flex-wrap gap-4 border-b border-border">
      <Link href={`/${query}`} className={linkClass(trabajadoresActive)}>
        Trabajadores
      </Link>
      <Link href={`/pendientes${query}`} className={linkClass(pendientesActive)}>
        Pendientes
      </Link>
      <Link href={`/contratos${query}`} className={linkClass(contratosActive)}>
        Contratos
      </Link>
      {esEstudio ? (
        <Link href={`/vida-ley${query}`} className={linkClass(vidaLeyActive)}>
          Vida Ley
        </Link>
      ) : null}
      <Link href={`/asistencias${query}`} className={linkClass(asistenciasActive)}>
        Asistencias
      </Link>
      <Link href={`/vacaciones${query}`} className={linkClass(vacacionesActive)}>
        Vacaciones
      </Link>
    </nav>
  );
}
