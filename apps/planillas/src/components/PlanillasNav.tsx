"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PlanillasNav({ entidadId }: { entidadId?: string }) {
  const pathname = usePathname();
  const query = entidadId ? `?entidadId=${entidadId}` : "";
  const trabajadoresActive = pathname === "/" || pathname.startsWith("/trabajadores");
  const pendientesActive = pathname.startsWith("/pendientes");

  const linkClass = (active: boolean) =>
    active
      ? "border-b-2 border-primary px-1 pb-2 text-sm font-medium text-primary"
      : "px-1 pb-2 text-sm text-muted-foreground hover:text-foreground";

  return (
    <nav className="flex gap-4 border-b border-border">
      <Link href={`/${query}`} className={linkClass(trabajadoresActive)}>
        Trabajadores
      </Link>
      <Link href={`/pendientes${query}`} className={linkClass(pendientesActive)}>
        Pendientes
      </Link>
    </nav>
  );
}
