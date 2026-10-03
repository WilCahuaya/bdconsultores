import type { ReactNode } from "react";
import Link from "next/link";
import { tiposDocumentosAltaRequeridos } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import type { ContratoRow, DocumentoRow, VidaLeyRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import type { VacacionRow } from "@/lib/actions/vacaciones";
import { VerHorario } from "@/components/ficha/VerHorario";
import { documentoCargado, etiquetaEstadoRespaldoContrato, fechaFinUltimoContratoValidado } from "@/lib/flujo-ficha";
import { etiquetaMesAsistencia } from "@/lib/horario-asistencia";
import {
  CLASIFICACION_LABEL,
  JORNADA_LABEL,
  TIPO_DOCUMENTO_LABEL,
  TRAMITE_PENSION_LABEL,
  armarDireccionPersona,
  etiquetaEstadoVidaLey,
  etiquetaTrabajador,
  formatFechaPlanilla,
  formatNumeroTrabajador,
  formatRemuneracion,
  montoAsignacionFamiliar,
} from "@/lib/planillas-labels";
import {
  DIAS_VACACIONES_ANUALES,
  ESTADO_VACACION_LABEL,
  anioActualLima,
  resumenPeriodoVacacion,
} from "@/lib/vacaciones";

type Linea = { texto: string; href?: string; destacada?: boolean };

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

function IconPago() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M16 15h2" />
    </svg>
  );
}

function IconPension() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M12 3v18" />
      <path d="M17 8a5 5 0 0 0-5-2c-2.8 0-5 1.8-5 4s2.2 4 5 4 5 1.8 5 4-2.2 4-5 4a5 5 0 0 1-5-2" />
    </svg>
  );
}

function IconRegistro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

function IconDocumentos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5H8Z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function IconVidaLey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass()} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
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

function valorOSinDato(etiqueta: string, valor: string | null | undefined): string {
  const texto = valor?.trim();
  return texto ? texto : `${etiqueta}: Sin dato`;
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
          <li
            key={`${linea.texto}-${index}`}
            className={
              linea.destacada
                ? "text-sm font-semibold leading-6 text-foreground"
                : "text-sm leading-6 text-muted-foreground"
            }
          >
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
  vidaLey,
  mostrarVidaLey,
  vidaLeyHref,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  contratos: ContratoRow[];
  documentos: DocumentoRow[];
  vacaciones: VacacionRow[];
  vidaLey: VidaLeyRow | null;
  mostrarVidaLey: boolean;
  vidaLeyHref: string;
}) {
  const p = trabajador.persona;
  const ordenados = [...contratos].sort((a, b) => b.version - a.version);
  const ultimo = ordenados[0] ?? null;
  const periodo = anioActualLima();
  const asistencias = documentos
    .filter((d) => d.tipo === "ASISTENCIA")
    .slice()
    .sort((a, b) => String(b.observaciones ?? "").localeCompare(String(a.observaciones ?? "")));
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodo);
  function estadoContrato(item: ContratoRow) {
    const respaldo = trabajador.contratos.find((c) => c.version === item.version);
    return etiquetaEstadoRespaldoContrato(
      {
        estado: item.estado,
        datos_confirmados: item.datos_confirmados,
        documento_id: item.documento_id,
        solicitud_storage_path: respaldo?.solicitud_storage_path ?? null,
      },
      documentos,
    );
  }
  const fechasUltimo = ultimo
    ? ultimo.fecha_inicio || ultimo.fecha_fin
      ? `${formatFechaPlanilla(ultimo.fecha_inicio)} – ${formatFechaPlanilla(ultimo.fecha_fin)}`
      : "Fechas: Sin dato"
    : null;
  const finValidado = fechaFinUltimoContratoValidado(contratos);
  const hrefDocumentos = `/contratos/${relacionId}?paso=documentos`;
  const hrefAlta = `/contratos/${relacionId}?paso=alta`;
  const altaRegistro = trabajador.tRegistro.find((item) => item.tipo === "ALTA");
  const bajaRegistro = trabajador.tRegistro.find((item) => item.tipo === "BAJA");

  const persona: Linea[] = [
    { texto: etiquetaTrabajador(p, trabajador.numero) },
    { texto: valorOSinDato("DNI", p.dni) },
    { texto: p.fecha_nacimiento ? formatFechaPlanilla(p.fecha_nacimiento) : "Nacimiento: Sin dato" },
  ];
  const contacto: Linea[] = [
    { texto: valorOSinDato("Celular", p.celular) },
    { texto: valorOSinDato("Correo", p.correo) },
    {
      texto: valorOSinDato(
        "Dirección",
        armarDireccionPersona({
          tipo_via: p.tipo_via,
          via_nombre: p.via_nombre,
          via_numero: p.via_numero,
          referencia: p.referencia,
          distrito: p.distrito,
          provincia: p.provincia,
          region: p.region,
          direccion: p.direccion,
        }),
      ),
    },
  ];
  const numero = formatNumeroTrabajador(trabajador.numero);
  const puesto: Linea[] = [
    { texto: numero ? `Nº ${numero}` : "Nº: Sin dato" },
    { texto: valorOSinDato("Cargo", trabajador.cargo) },
    { texto: valorOSinDato("Clasificación", trabajador.clasificacion ? CLASIFICACION_LABEL[trabajador.clasificacion] : null) },
    { texto: valorOSinDato("Jornada", trabajador.jornada ? JORNADA_LABEL[trabajador.jornada] : null) },
    {
      texto: trabajador.fecha_ingreso
        ? `Ingreso a la empresa ${formatFechaPlanilla(trabajador.fecha_ingreso)}`
        : "Ingreso: Sin dato",
    },
    { texto: finValidado ? `Cese ${formatFechaPlanilla(finValidado)}` : "Cese: Sin dato" },
    { texto: "Ir a puesto", href: `/contratos/${relacionId}?paso=puesto` },
  ];
  const pago: Linea[] = [
    {
      texto:
        trabajador.remuneracion != null
          ? `S/ ${formatRemuneracion(trabajador.remuneracion)}`
          : "Remuneración: Sin dato",
    },
    {
      texto:
        trabajador.recibe_asignacion_familiar === true
          ? `Asignación familiar S/ ${formatRemuneracion(montoAsignacionFamiliar(true))}`
          : trabajador.recibe_asignacion_familiar === false
            ? "Sin asignación familiar"
            : "Asignación familiar: Sin dato",
    },
  ];
  const pension = trabajador.pension;
  const pensionLineas: Linea[] = pension?.tipo
    ? [
        {
          texto:
            pension.tipo === "ONP"
              ? "ONP"
              : pension.afp_nombre?.trim()
                ? `AFP ${pension.afp_nombre.trim()}`
                : "AFP: Sin dato",
        },
        ...(pension.tipo === "AFP" ? [{ texto: valorOSinDato("CUSPP", pension.cuspp) }] : []),
        {
          texto: pension.tramite_estado ? TRAMITE_PENSION_LABEL[pension.tramite_estado] : "Trámite: Sin dato",
        },
        { texto: "Ir a dar de alta", href: hrefAlta },
      ]
    : [
        { texto: "Pensión: Sin dato" },
        { texto: "Ir a dar de alta", href: hrefAlta },
      ];
  const tRegistroLineas: Linea[] = [
    { texto: altaRegistro?.realizado ? "Alta hecha" : "Alta pendiente" },
    ...(trabajador.estado === "CESADA"
      ? [{ texto: bajaRegistro?.realizado ? "Baja hecha" : "Baja pendiente" }]
      : []),
    { texto: "Ir a dar de alta", href: hrefAlta },
  ];
  const documentosAlta: Linea[] = tiposDocumentosAltaRequeridos(trabajador.recibe_asignacion_familiar).map((tipo) => ({
    texto: `${TIPO_DOCUMENTO_LABEL[tipo]} · ${documentoCargado(documentos, tipo) ? "cargado" : "pendiente"}`,
    href: hrefDocumentos,
  }));
  const contratoLineas: Linea[] = ultimo
    ? [
        {
          texto: `Versión ${ultimo.version}${ultimo.es_vigente ? " vigente" : ""} · ${estadoContrato(ultimo)}`,
          destacada: true,
        },
        ...(fechasUltimo ? [{ texto: fechasUltimo }] : []),
        ...ordenados.slice(1).map((item) => ({
          texto: `Versión ${item.version}${item.es_vigente ? " vigente" : ""} · ${estadoContrato(item)}`,
        })),
        { texto: "Ir al trámite", href: `/contratos/${relacionId}` },
      ]
    : [
        { texto: "Sin contrato", destacada: true },
        { texto: "Ir al trámite", href: `/contratos/${relacionId}` },
      ];
  const vidaLeyFechas =
    vidaLey?.fecha_inicio || vidaLey?.fecha_fin
      ? `${formatFechaPlanilla(vidaLey.fecha_inicio)} – ${formatFechaPlanilla(vidaLey.fecha_fin)}`
      : null;
  const vidaLeyLineas: Linea[] = [
    { texto: vidaLey ? etiquetaEstadoVidaLey(vidaLey.estado) : "Vida Ley: Sin dato", destacada: true },
    ...(vidaLey?.numero_poliza ? [{ texto: `Póliza ${vidaLey.numero_poliza}` }] : []),
    ...(vidaLeyFechas ? [{ texto: vidaLeyFechas }] : []),
    { texto: "Ir al trámite", href: vidaLeyHref },
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
      <Grupo icon={<IconContacto />} title="Contacto" lineas={contacto} />
      <Grupo
        icon={<IconPuesto />}
        title="Puesto"
        lineas={puesto}
        extra={
          trabajador.horario?.trim() ? (
            <VerHorario value={trabajador.horario} />
          ) : (
            <li className="text-sm leading-6 text-muted-foreground">Horario: Sin dato</li>
          )
        }
      />
      <Grupo icon={<IconPago />} title="Pago" lineas={pago} />
      <Grupo icon={<IconContrato />} title="Contrato" lineas={contratoLineas} />
      <Grupo icon={<IconPension />} title="Pensión" lineas={pensionLineas} />
      <Grupo icon={<IconRegistro />} title="T-Registro" lineas={tRegistroLineas} />
      {mostrarVidaLey ? <Grupo icon={<IconVidaLey />} title="Vida Ley" lineas={vidaLeyLineas} /> : null}
      <Grupo icon={<IconAsistencia />} title="Asistencias" lineas={asistenciaLineas} />
      <Grupo icon={<IconVacaciones />} title="Vacaciones" lineas={vacacionLineas} />
      <Grupo icon={<IconDocumentos />} title="Documentos" lineas={documentosAlta} />
    </div>
  );
}
