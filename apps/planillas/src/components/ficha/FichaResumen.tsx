import type { ReactNode } from "react";
import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
import type { ContratoRow, DocumentoRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import type { VacacionRow } from "@/lib/actions/vacaciones";
import { VerHorario } from "@/components/ficha/VerHorario";
import { contratoConfirmado, contratoVigente, flujoDesdeTrabajador } from "@/lib/flujo-ficha";
import { etiquetaMesAsistencia, mesActualLima } from "@/lib/horario-asistencia";
import {
  CLASIFICACION_LABEL,
  ESTADO_CONTRATO_LABEL,
  JORNADA_LABEL,
  formatFechaPlanilla,
  formatRemuneracion,
  montoAsignacionFamiliar,
  nombreCompleto,
} from "@/lib/planillas-labels";
import {
  DIAS_VACACIONES_ANUALES,
  ESTADO_VACACION_LABEL,
  anioActualLima,
  resumenPeriodoVacacion,
} from "@/lib/vacaciones";

type Linea = { texto: string; href?: string };

function iconClass() {
  return "h-4 w-4 shrink-0 text-foreground";
}

function IconPersona() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconContacto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconPuesto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function IconContrato() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

function IconAsistencia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconVacaciones() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  );
}

function Grupo({
  icon,
  title,
  lineas,
  extra,
}: {
  icon: ReactNode;
  title: string;
  lineas: Linea[];
  extra?: ReactNode;
}) {
  if (lineas.length === 0 && !extra) return null;
  return (
    <section className={`${panelCardClass} mb-4 break-inside-avoid p-4`}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
        {icon}
        {title}
      </h2>
      <ul className="mt-1 pl-6">
        {lineas.map((linea, index) => (
          <li key={`${linea.texto}-${index}`} className="text-sm leading-6 text-muted-foreground">
            {linea.href ? (
              <Link href={linea.href} className="text-primary hover:underline">
                {linea.texto}
              </Link>
            ) : (
              linea.texto
            )}
          </li>
        ))}
        {extra}
      </ul>
    </section>
  );
}

export function FichaResumen({
  relacionId,
  entidadId,
  trabajador,
  contratos,
  documentos,
  vacaciones,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  contratos: ContratoRow[];
  documentos: DocumentoRow[];
  vacaciones: VacacionRow[];
}) {
  const p = trabajador.persona;
  const flujo = flujoDesdeTrabajador(trabajador);
  const vigente = contratoConfirmado(flujo.contratos) ?? contratoVigente(flujo.contratos);
  const contrato = contratos.find((c) => c.es_vigente) ?? contratos[0] ?? null;
  const mes = mesActualLima();
  const periodo = anioActualLima();
  const asistencias = documentos
    .filter((d) => d.tipo === "ASISTENCIA")
    .slice()
    .sort((a, b) => String(b.observaciones ?? "").localeCompare(String(a.observaciones ?? "")));
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodo);
  const contratoEstado = contrato
    ? ESTADO_CONTRATO_LABEL[contrato.estado]
    : vigente
      ? ESTADO_CONTRATO_LABEL[vigente.estado]
      : "Sin contrato";
  const contratoFechas = contrato
    ? `${formatFechaPlanilla(contrato.fecha_inicio)} – ${formatFechaPlanilla(contrato.fecha_fin)}`
    : vigente
      ? `${formatFechaPlanilla(vigente.fecha_inicio)} – ${formatFechaPlanilla(vigente.fecha_fin)}`
      : null;

  const persona: Linea[] = [
    { texto: nombreCompleto(p) },
    { texto: p.dni },
    ...(p.fecha_nacimiento ? [{ texto: formatFechaPlanilla(p.fecha_nacimiento) }] : []),
  ];
  const contacto: Linea[] = [
    ...(p.celular ? [{ texto: p.celular }] : []),
    ...(p.correo ? [{ texto: p.correo }] : []),
    ...(p.direccion ? [{ texto: p.direccion }] : []),
  ];
  const puesto: Linea[] = [
    ...(trabajador.cargo ? [{ texto: trabajador.cargo }] : []),
    ...(trabajador.clasificacion ? [{ texto: CLASIFICACION_LABEL[trabajador.clasificacion] }] : []),
    ...(trabajador.jornada ? [{ texto: JORNADA_LABEL[trabajador.jornada] }] : []),
    ...(trabajador.fecha_ingreso ? [{ texto: formatFechaPlanilla(trabajador.fecha_ingreso) }] : []),
    ...(trabajador.fecha_cese ? [{ texto: `Cese ${formatFechaPlanilla(trabajador.fecha_cese)}` }] : []),
  ];
  const puestoPago: Linea[] = [
    ...(trabajador.remuneracion != null ? [{ texto: `S/ ${formatRemuneracion(trabajador.remuneracion)}` }] : []),
    ...(trabajador.recibe_asignacion_familiar === true
      ? [{ texto: `Asignación familiar S/ ${formatRemuneracion(montoAsignacionFamiliar(true))}` }]
      : trabajador.recibe_asignacion_familiar === false
        ? [{ texto: "Sin asignación familiar" }]
        : []),
  ];
  const contratoLineas: Linea[] = [
    { texto: contratoEstado },
    ...(contratoFechas ? [{ texto: contratoFechas }] : []),
    ...(contratos.length > 1
      ? contratos.map((item) => ({
          texto: `Versión ${item.version}${item.es_vigente ? " vigente" : ""} · ${ESTADO_CONTRATO_LABEL[item.estado]}`,
        }))
      : []),
    { texto: "Ir al trámite", href: `/contratos/${relacionId}` },
  ];
  const asistenciaLineas: Linea[] =
    asistencias.length === 0
      ? [{ texto: "Sin PDF cargados" }, { texto: "Ir al trámite", href: `/asistencias?entidadId=${entidadId}` }]
      : [
          ...asistencias.map((item) => ({
            texto: `${item.observaciones ? etiquetaMesAsistencia(item.observaciones) : "Mes"} · ${item.storage_path ? "PDF subido" : "Pendiente"}`,
          })),
          { texto: "Ir al trámite", href: `/asistencias?entidadId=${entidadId}` },
        ];
  const vacacionLineas: Linea[] = [
    {
      texto: resumenVac.derecho
        ? `${periodo}: ${resumenVac.diasTomados} de ${DIAS_VACACIONES_ANUALES} días · saldo ${resumenVac.saldo}`
        : `${periodo}: aún no genera derecho`,
    },
    ...resumenVac.registros.map((item) => {
      const conRespaldo = documentos.some((d) => d.id === item.documento_id && Boolean(d.storage_path));
      return {
        texto: `${formatFechaPlanilla(item.fecha_inicio)} – ${formatFechaPlanilla(item.fecha_fin)} · ${item.dias} día${item.dias === 1 ? "" : "s"} · ${ESTADO_VACACION_LABEL[item.estado]}${conRespaldo ? " · respaldo firmado" : " · sin respaldo"}`,
      };
    }),
    { texto: "Ir al trámite", href: `/vacaciones?entidadId=${entidadId}&periodo=${periodo}` },
  ];

  return (
    <div className="columns-1 lg:columns-2 lg:gap-x-6">
      <Grupo icon={<IconPersona />} title="Persona" lineas={persona} />
      <Grupo icon={<IconContacto />} title="Contacto" lineas={contacto.length ? contacto : [{ texto: "Sin datos de contacto" }]} />
      <Grupo
        icon={<IconPuesto />}
        title="Puesto"
        lineas={puesto}
        extra={
          <>
            <VerHorario value={trabajador.horario} />
            {puestoPago.map((linea) => (
              <li key={linea.texto} className="text-sm leading-6 text-muted-foreground">
                {linea.texto}
              </li>
            ))}
          </>
        }
      />
      <Grupo icon={<IconContrato />} title="Contrato" lineas={contratoLineas} />
      <Grupo icon={<IconAsistencia />} title="Asistencias" lineas={asistenciaLineas} />
      <Grupo icon={<IconVacaciones />} title="Vacaciones" lineas={vacacionLineas} />
    </div>
  );
}
