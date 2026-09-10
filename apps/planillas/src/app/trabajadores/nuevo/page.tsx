import Link from "next/link";
import { redirect } from "next/navigation";
import { esUsuarioEntidad } from "@inventario/types";
import { PlanillasShell } from "@/components/PlanillasShell";
import { NuevoTrabajadorForm } from "@/components/NuevoTrabajadorForm";
import { puedeCrearEntidad, puedeCrearTrabajador, requirePlanillasProfile } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";

export default async function NuevoTrabajadorPage({
  searchParams,
}: {
  searchParams: { entidadId?: string };
}) {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearTrabajador(profile)) redirect("/");

  const entidades = await listEntidadesPlanillas();
  const defaultEntidadId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";

  return (
    <PlanillasShell profile={profile} entidadId={defaultEntidadId || undefined}>
      <div className="space-y-6">
        <div>
          <Link href={defaultEntidadId ? `/?entidadId=${defaultEntidadId}` : "/"} className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">Nuevo trabajador</h1>
          {esUsuarioEntidad(profile.rol) ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Identifique a la persona y siga a Documentos. Ahí se suben DNI, ficha y AFP/ONP, y se capturan los datos del contrato. El estudio validará el alta.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Identifique a la persona y siga a Documentos. Ahí se suben DNI, ficha y AFP/ONP, y se capturan los datos del contrato. El alta queda aceptada al registrarla desde el estudio.
            </p>
          )}
        </div>
        {entidades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay empresas activas.
            {puedeCrearEntidad(profile) ? (
              <>
                {" "}
                <Link href="/empresas/nueva" className="font-medium text-primary hover:underline">
                  Crear empresa
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <NuevoTrabajadorForm
            entidades={entidades}
            defaultEntidadId={defaultEntidadId}
            lockEntidad={esUsuarioEntidad(profile.rol)}
          />
        )}
      </div>
    </PlanillasShell>
  );
}
