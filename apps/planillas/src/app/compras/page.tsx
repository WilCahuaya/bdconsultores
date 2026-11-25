import { redirect } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { ComprasSunatPanel } from "@/components/ComprasSunatPanel";
import { SinEmpresasPlanillas } from "@/components/ProcesoResumenCard";
import { puedeCrearEntidad, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import {
  credencialSunat,
  estadoDescargaSunat,
  listarComprasSunat,
} from "@/lib/actions/compras-sunat";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function periodoInicial(valor?: string): string {
  if (valor && /^[0-9]{6}$/.test(valor)) return valor;
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ComprasSunatPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; periodo?: string };
}) {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) redirect("/");

  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((entidad) => entidad.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const periodo = periodoInicial(searchParams.periodo);
  const [credencial, compras, descarga] = selectedId
    ? await Promise.all([
        credencialSunat(selectedId),
        listarComprasSunat(selectedId, periodo),
        estadoDescargaSunat(selectedId, periodo),
      ])
    : [null, [], null];

  return (
    <PlanillasShell profile={profile} entidadId={selectedId}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Compras SUNAT</h1>
          {selectedId ? (
            <EntidadSwitcher entidades={entidades} selectedId={selectedId} hrefBase="/compras" queryExtra={`periodo=${periodo}`} inline />
          ) : null}
        </div>
        {!selectedId || !credencial ? (
          <SinEmpresasPlanillas canCreate={puedeCrearEntidad(profile)} />
        ) : (
          <ComprasSunatPanel
            entidadId={selectedId}
            credencial={credencial}
            periodo={periodo}
            compras={compras}
            descarga={descarga}
            empresaNombre={entidades.find((entidad) => entidad.id === selectedId)?.nombre ?? ""}
          />
        )}
      </div>
    </PlanillasShell>
  );
}
