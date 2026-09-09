import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { FichaTabs, parseFichaTab } from "@/components/ficha/FichaTabs";
import { FichaDatosForm } from "@/components/ficha/FichaDatosForm";
import { FichaContratos } from "@/components/ficha/FichaContratos";
import { FichaDocumentos } from "@/components/ficha/FichaDocumentos";
import { FichaPensiones } from "@/components/ficha/FichaPensiones";
import { FichaTRegistro } from "@/components/ficha/FichaTRegistro";
import { FichaVidaLey } from "@/components/ficha/FichaVidaLey";
import { puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { getPension, getVidaLey, listContratos, listDocumentos, listTRegistro } from "@/lib/actions/ficha";
import { ESTADO_RELACION_LABEL, nombreCompleto } from "@/lib/planillas-labels";

export default async function FichaTrabajadorPage({
  params,
  searchParams,
}: {
  params: { relacionId: string };
  searchParams: { tab?: string };
}) {
  const profile = await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();

  const tab = parseFichaTab(searchParams.tab);
  const canWrite = puedeEscribirPlanillas(profile);
  const [contratos, documentos, pension, vidaLey, tRegistro] = await Promise.all([
    tab === "contratos" ? listContratos(params.relacionId) : Promise.resolve([]),
    tab === "documentos" ? listDocumentos(params.relacionId) : Promise.resolve([]),
    tab === "pensiones" ? getPension(params.relacionId) : Promise.resolve(null),
    tab === "vida-ley" ? getVidaLey(params.relacionId) : Promise.resolve(null),
    tab === "t-registro" ? listTRegistro(params.relacionId) : Promise.resolve([]),
  ]);

  return (
    <PlanillasShell profile={profile} entidadId={trabajador.entidad_id}>
      <div className="space-y-6">
        <div>
          <Link href={`/?entidadId=${trabajador.entidad_id}`} className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">{nombreCompleto(trabajador.persona)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
            {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
          </p>
        </div>
        <FichaTabs relacionId={params.relacionId} tab={tab} />
        {tab === "datos" ? <FichaDatosForm trabajador={trabajador} canWrite={canWrite} /> : null}
        {tab === "contratos" ? (
          <FichaContratos relacionId={params.relacionId} contratos={contratos} canWrite={canWrite} />
        ) : null}
        {tab === "documentos" ? (
          <FichaDocumentos
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            documentos={documentos}
            canWrite={canWrite}
          />
        ) : null}
        {tab === "pensiones" ? (
          <FichaPensiones relacionId={params.relacionId} pension={pension} canWrite={canWrite} />
        ) : null}
        {tab === "t-registro" ? (
          <FichaTRegistro relacionId={params.relacionId} items={tRegistro} canWrite={canWrite} />
        ) : null}
        {tab === "vida-ley" ? (
          <FichaVidaLey relacionId={params.relacionId} vidaLey={vidaLey} canWrite={canWrite} />
        ) : null}
      </div>
    </PlanillasShell>
  );
}
