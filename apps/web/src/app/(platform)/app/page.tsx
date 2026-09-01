import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MODULE_INVENTARIO,
  MODULE_INVENTARIO_FULL,
  MODULE_PLANILLAS,
  PLATFORM_NAME,
  inventarioHomePathForRole,
} from "@inventario/types";
import { getProfile } from "@/lib/auth/profile";
import { panelCardClass } from "@inventario/ui/panel";

export const metadata: Metadata = {
  title: `Aplicaciones · ${PLATFORM_NAME}`,
};

export default async function PlatformHomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const inventarioHref = inventarioHomePathForRole(profile.rol);
  const inventarioBlurb =
    profile.rol === "ADMIN_ENTIDAD"
      ? "Activos fijos de su entidad: ambientes, preregistro y reportes."
      : "Activos fijos: entidades, inventario, catálogo, usuarios y reportes.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-primary sm:text-2xl">Aplicaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola, {profile.nombre}. Elija el módulo con el que desea trabajar.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href={inventarioHref}
            className={`${panelCardClass} flex h-full flex-col gap-2 p-5 transition-colors hover:border-primary/40 hover:bg-primary/5`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Módulo</p>
            <h2 className="text-lg font-semibold text-foreground">{MODULE_INVENTARIO}</h2>
            <p className="text-sm text-muted-foreground">{MODULE_INVENTARIO_FULL}</p>
            <p className="mt-auto pt-2 text-sm text-foreground/80">{inventarioBlurb}</p>
          </Link>
        </li>
        <li>
          <div
            className={`${panelCardClass} flex h-full flex-col gap-2 p-5 opacity-70`}
            aria-disabled="true"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Próximamente
            </p>
            <h2 className="text-lg font-semibold text-foreground">{MODULE_PLANILLAS}</h2>
            <p className="text-sm text-muted-foreground">Gestión laboral y de planillas</p>
            <p className="mt-auto pt-2 text-sm text-foreground/80">
              Contratos, documentos, T-Registro y planilla mensual. Aún no está habilitado.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
