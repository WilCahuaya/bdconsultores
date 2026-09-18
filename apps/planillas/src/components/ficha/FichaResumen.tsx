import type { ReactNode } from "react";
import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
import type { ContratoRow, DocumentoRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import type { VacacionRow } from "@/lib/actions/vacaciones";
import { contratoConfirmado, contratoVigente, flujoDesdeTrabajador } from "@/lib/flujo-ficha";
import { etiquetaMesAsistencia, mesActualLima } from "@/lib/horario-asistencia";
import { formatHorarioContrato } from "@/lib/horario-laboral";
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

function IconPersona() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconContacto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconPuesto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function IconContrato() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

function IconAsistencia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconVacaciones() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0" aria-hidden>
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

function texto(value: ReactNode) {
  if (value == null || value === "") return "—";
  return value;
}

function MenuItem({
  label,
  value,
  href,
}: {
  label: string;
  value?: ReactNode;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="text-muted-foreground">{label}</span>
      {value != null && value !== "" ? <span className="text-foreground"> {texto(value)}</span> : null}
    </>
  );
  if (href) {
    return (
      <li>
        <Link href={href} className="text-sm text-primary hover:underline">
          {contenido}
        </Link>
      </li>
    );
  }
  return <li className="text-sm text-foreground/90">{contenido}</li>;
}

function MenuGrupo({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>
      <ul className="mt-1 space-y-0.5 pl-6">{children}</ul>
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

  return (
    <div className={`${panelCardClass} ficha-menu p-5 sm:p-6`}>
      <div className="ficha-menu-cols">
        <div className="space-y-5">
          <MenuGrupo icon={<IconPersona />} title="Persona">
            <MenuItem label="Nombre" value={nombreCompleto(p)} />
            <MenuItem label="DNI" value={p.dni} />
            <MenuItem label="Nacimiento" value={formatFechaPlanilla(p.fecha_nacimiento)} />
          </MenuGrupo>

          <MenuGrupo icon={<IconContacto />} title="Contacto">
            <MenuItem label="Celular" value={p.celular} />
            <MenuItem label="Correo" value={p.correo} />
            <MenuItem label="Dirección" value={p.direccion} />
          </MenuGrupo>

          <MenuGrupo icon={<IconPuesto />} title="Puesto">
            <MenuItem label="Cargo" value={trabajador.cargo} />
            <MenuItem
              label="Clasificación"
              value={trabajador.clasificacion ? CLASIFICACION_LABEL[trabajador.clasificacion] : null}
            />
            <MenuItem label="Jornada" value={trabajador.jornada ? JORNADA_LABEL[trabajador.jornada] : null} />
            <MenuItem label="Ingreso" value={formatFechaPlanilla(trabajador.fecha_ingreso)} />
            {trabajador.fecha_cese ? (
              <MenuItem label="Cese" value={formatFechaPlanilla(trabajador.fecha_cese)} />
            ) : null}
            <MenuItem label="Horario" value={formatHorarioContrato(trabajador.horario)} />
            <MenuItem
              label="Remuneración"
              value={trabajador.remuneracion != null ? `S/ ${formatRemuneracion(trabajador.remuneracion)}` : null}
            />
            <MenuItem
              label="Asignación familiar"
              value={
                trabajador.recibe_asignacion_familiar === true
                  ? `Sí · S/ ${formatRemuneracion(montoAsignacionFamiliar(true))}`
                  : trabajador.recibe_asignacion_familiar === false
                    ? "No"
                    : null
              }
            />
          </MenuGrupo>
        </div>

        <div className="space-y-5">
          <MenuGrupo icon={<IconContrato />} title="Contrato">
            <MenuItem label="Estado" value={contratoEstado} />
            {contratoFechas ? <MenuItem label="Vigencia" value={contratoFechas} /> : null}
            {contrato?.cargo ? <MenuItem label="Cargo" value={contrato.cargo} /> : null}
            {contrato?.remuneracion != null ? (
              <MenuItem label="Remuneración" value={`S/ ${formatRemuneracion(contrato.remuneracion)}`} />
            ) : null}
            {contratos.length > 1
              ? contratos.map((item) => (
                  <MenuItem
                    key={item.id}
                    label={`Versión ${item.version}${item.es_vigente ? " vigente" : ""}`}
                    value={`${ESTADO_CONTRATO_LABEL[item.estado]} · ${formatFechaPlanilla(item.fecha_inicio)}`}
                  />
                ))
              : null}
            <MenuItem label="Ir al trámite" href={`/contratos/${relacionId}`} />
          </MenuGrupo>

          <MenuGrupo icon={<IconAsistencia />} title="Asistencias">
            {asistencias.length === 0 ? (
              <MenuItem label="Sin PDF cargados" />
            ) : (
              asistencias.map((item) => (
                <MenuItem
                  key={item.id}
                  label={item.observaciones ? etiquetaMesAsistencia(item.observaciones) : "Mes"}
                  value={item.storage_path ? "PDF subido" : "Pendiente"}
                />
              ))
            )}
            <MenuItem label="Ir al trámite" href={`/asistencias?entidadId=${entidadId}`} />
          </MenuGrupo>

          <MenuGrupo icon={<IconVacaciones />} title="Vacaciones">
            <MenuItem
              label={`Periodo ${periodo}`}
              value={
                resumenVac.derecho
                  ? `${resumenVac.diasTomados} de ${DIAS_VACACIONES_ANUALES} días · saldo ${resumenVac.saldo}`
                  : "Aún no genera derecho"
              }
            />
            {resumenVac.registros.map((item) => (
              <MenuItem
                key={item.id}
                label={`${formatFechaPlanilla(item.fecha_inicio)} – ${formatFechaPlanilla(item.fecha_fin)}`}
                value={`${item.dias} día${item.dias === 1 ? "" : "s"} · ${ESTADO_VACACION_LABEL[item.estado]}`}
              />
            ))}
            <MenuItem label="Ir al trámite" href={`/vacaciones?entidadId=${entidadId}&periodo=${periodo}`} />
          </MenuGrupo>
        </div>
      </div>
    </div>
  );
}
