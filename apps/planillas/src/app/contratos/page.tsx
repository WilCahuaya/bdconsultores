import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { ProcesoResumenCard, SinEmpresasPlanillas } from "@/components/ProcesoResumenCard";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import {
  claseBadgePaso,
  contratoConfirmado,
  contratoVigente,
  ETAPA_CONTRATO_FILTRO_LABEL,
  flujoDesdeTrabajador,
  HORIZONTE_VENCIMIENTO_DIAS,
  parseEtapaContratoFiltro,
  resolverEtapaContrato,
  type EtapaContratoId,
} from "@/lib/flujo-ficha";
import { formatFechaPlanilla, nombreCompleto } from "@/lib/planillas-labels";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hrefContratos(entidadId: string, etapa?: string) {
  const query = new URLSearchParams({ entidadId });
  if (etapa && etapa !== "todos") query.set("etapa", etapa);
  return `/contratos?${query.toString()}`;
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; etapa?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const esEstudio = puedeEscribirPlanillas(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const filtro = parseEtapaContratoFiltro(searchParams.etapa);
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = plusDays(hoy, HORIZONTE_VENCIMIENTO_DIAS);
  const trabajadores = selectedId ? await listTrabajadores(selectedId) : [];
  const filas = trabajadores
    .filter((t) => t.estado === "ACTIVA")
    .map((trabajador) => {
      const flujo = flujoDesdeTrabajador(trabajador);
      const vigente = contratoConfirmado(flujo.contratos) ?? contratoVigente(flujo.contratos);
      return {
        trabajador,
        vigente,
        etapa: resolverEtapaContrato(trabajador, esEstudio, { hoy, limite }),
      };
    })
    .sort((a, b) => {
      if (a.etapa.pendiente !== b.etapa.pendiente) return a.etapa.pendiente ? -1 : 1;
      return nombreCompleto(a.trabajador.persona).localeCompare(nombreCompleto(b.trabajador.persona), "es");
    });
  const conteo = filas.reduce(
    (acc, fila) => {
      acc[fila.etapa.id] += 1;
      if (fila.etapa.pendiente) acc.pendientes += 1;
      return acc;
    },
    {
      pendientes: 0,
      alta: 0,
      generar: 0,
      firmar: 0,
      confirmar: 0,
      validar: 0,
      recoger: 0,
      vence: 0,
      revisar: 0,
      listo: 0,
    } as Record<EtapaContratoId | "pendientes", number>,
  );
  const visibles =
    filtro === "todos"
      ? filas
      : filtro === "pendientes"
        ? filas.filter((fila) => fila.etapa.pendiente)
        : filas.filter((fila) => fila.etapa.id === filtro);
  const tarjetas: { id: EtapaContratoId | "pendientes"; hint: string }[] = [
    { id: "pendientes", hint: "Ver proceso" },
    { id: "alta", hint: "Docs, persona o puesto" },
    { id: "generar", hint: "Armar Word" },
    { id: "firmar", hint: "Subir PDF" },
    { id: "confirmar", hint: "Guardar datos" },
    { id: "recoger", hint: esEstudio ? "Marcar recogido" : "Revisión del estudio" },
    { id: "vence", hint: "30 días" },
    { id: "listo", hint: "Vigentes" },
  ];
  if (conteo.validar > 0) {
    tarjetas.splice(5, 0, { id: "validar", hint: esEstudio ? "Aceptar alta" : "En revisión" });
  }
  if (conteo.revisar > 0) {
    tarjetas.splice(-2, 0, { id: "revisar", hint: "Otro estado" });
  }

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Contratos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Proceso por empresa: generar el Word, subir el firmado, confirmar datos y recoger. Entre a la ficha para
            avanzar cada paso.
          </p>
        </div>

        {entidades.length === 0 ? (
          <SinEmpresasPlanillas canCreate={canCreate} />
        ) : (
          <>
            <EntidadSwitcher
              entidades={entidades}
              selectedId={selectedId}
              locked={esUsuarioEntidad(profile.rol)}
              hrefBase="/contratos"
              queryExtra={filtro === "todos" ? undefined : `etapa=${filtro}`}
            />

            {selectedId ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tarjetas.map((tarjeta) => (
                  <ProcesoResumenCard
                    key={tarjeta.id}
                    href={hrefContratos(selectedId, tarjeta.id)}
                    titulo={ETAPA_CONTRATO_FILTRO_LABEL[tarjeta.id]}
                    cantidad={conteo[tarjeta.id]}
                    hint={tarjeta.hint}
                    active={filtro === tarjeta.id}
                  />
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {filtro === "todos" ? "Todos los contratos" : ETAPA_CONTRATO_FILTRO_LABEL[filtro]}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <p className="text-muted-foreground">
                  {visibles.length} de {filas.length}
                </p>
                {filtro !== "todos" ? (
                  <Link href={hrefContratos(selectedId)} className="text-primary hover:underline">
                    Ver todos
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Paso</th>
                    <th className="px-4 py-2 font-medium">Inicio</th>
                    <th className="px-4 py-2 font-medium">Fin</th>
                    <th className="px-4 py-2 font-medium">Guardado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                        {filas.length === 0
                          ? "No hay trabajadores activos en esta empresa."
                          : "No hay contratos en este paso."}
                      </td>
                    </tr>
                  ) : (
                    visibles.map(({ trabajador, vigente, etapa }) => (
                      <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/trabajadores/${trabajador.id}?tab=${etapa.tab}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {nombreCompleto(trabajador.persona)}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${claseBadgePaso(etapa.rol)}`}
                          >
                            {etapa.etiqueta}
                          </span>
                        </td>
                        <td className="px-4 py-2">{formatFechaPlanilla(vigente?.fecha_inicio)}</td>
                        <td className="px-4 py-2">{formatFechaPlanilla(vigente?.fecha_fin)}</td>
                        <td className="px-4 py-2">{vigente?.datos_confirmados ? "Sí" : "No"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
