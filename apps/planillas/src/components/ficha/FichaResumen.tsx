import type { ReactNode } from "react";
import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
import type { ContratoRow, DocumentoRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import type { VacacionRow } from "@/lib/actions/vacaciones";
import { HorarioContratoVista } from "@/components/ficha/HorarioContratoVista";
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

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
}

function Grupo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Apartado({
  title,
  resumen,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  resumen: string;
  href: string;
  hrefLabel: string;
  children: ReactNode;
}) {
  return (
    <details className={`${panelCardClass} group p-0`}>
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{resumen}</p>
          </div>
          <span className="text-xs text-muted-foreground group-open:hidden">Ver</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">Ocultar</span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-border px-5 py-4">
        {children}
        <Link href={href} className="inline-block text-sm font-medium text-primary hover:underline">
          {hrefLabel}
        </Link>
      </div>
    </details>
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
  const pdfMes = asistencias.find((d) => d.observaciones === mes && Boolean(d.storage_path));
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodo);
  const contratoResumen = contrato
    ? `${ESTADO_CONTRATO_LABEL[contrato.estado]}${contrato.fecha_inicio ? ` · ${formatFechaPlanilla(contrato.fecha_inicio)}` : ""}${contrato.fecha_fin ? ` – ${formatFechaPlanilla(contrato.fecha_fin)}` : ""}`
    : vigente
      ? `${ESTADO_CONTRATO_LABEL[vigente.estado]}${vigente.fecha_inicio ? ` · ${formatFechaPlanilla(vigente.fecha_inicio)}` : ""}`
      : "Sin contrato generado";
  const asistenciaResumen = pdfMes
    ? `PDF firmado de ${etiquetaMesAsistencia(mes)}`
    : `Falta PDF firmado de ${etiquetaMesAsistencia(mes)}`;
  const vacacionResumen = resumenVac.derecho
    ? `${resumenVac.diasTomados} de ${DIAS_VACACIONES_ANUALES} días en ${periodo} · saldo ${resumenVac.saldo}`
    : `Aún no genera derecho · ${resumenVac.registros.length} registro${resumenVac.registros.length === 1 ? "" : "s"} en ${periodo}`;

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-5 p-5`}>
        <p className="text-sm font-medium text-foreground">Datos generales</p>
        <Grupo title="Persona">
          <div className="sm:col-span-2">
            <Dato label="Nombre completo" value={nombreCompleto(p)} />
          </div>
          <Dato label="DNI" value={<span className="font-mono">{p.dni}</span>} />
          <Dato label="Fecha de nacimiento" value={formatFechaPlanilla(p.fecha_nacimiento)} />
        </Grupo>
        <Grupo title="Contacto">
          <Dato label="Celular" value={p.celular} />
          <Dato label="Correo" value={p.correo} />
          <div className="sm:col-span-2">
            <Dato label="Dirección" value={p.direccion} />
          </div>
        </Grupo>
        <Grupo title="En la empresa">
          <Dato label="Cargo" value={trabajador.cargo} />
          <Dato
            label="Clasificación"
            value={trabajador.clasificacion ? CLASIFICACION_LABEL[trabajador.clasificacion] : null}
          />
          <Dato label="Jornada" value={trabajador.jornada ? JORNADA_LABEL[trabajador.jornada] : null} />
          <Dato label="Fecha de ingreso" value={formatFechaPlanilla(trabajador.fecha_ingreso)} />
          {trabajador.fecha_cese ? (
            <Dato label="Fecha de cese" value={formatFechaPlanilla(trabajador.fecha_cese)} />
          ) : null}
          <div className="sm:col-span-2">
            <Dato label="Horario" value={<HorarioContratoVista value={trabajador.horario} className="text-sm font-medium" />} />
          </div>
          <Dato
            label="Remuneración"
            value={trabajador.remuneracion != null ? `S/ ${formatRemuneracion(trabajador.remuneracion)}` : null}
          />
          <Dato
            label="Asignación familiar"
            value={
              trabajador.recibe_asignacion_familiar === true
                ? `Sí · S/ ${formatRemuneracion(montoAsignacionFamiliar(true))}`
                : trabajador.recibe_asignacion_familiar === false
                  ? "No"
                  : "No indicado"
            }
          />
        </Grupo>
      </section>

      <Apartado
        title="Contrato"
        resumen={contratoResumen}
        href={`/contratos/${relacionId}`}
        hrefLabel="Ir al trámite de contrato"
      >
        {contratos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay un contrato en esta ficha.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {contratos.map((item) => (
              <li key={item.id} className="rounded-md border border-border/70 px-3 py-2">
                <p className="font-medium">
                  Versión {item.version}
                  {item.es_vigente ? " · vigente" : ""}
                </p>
                <p className="text-muted-foreground">
                  {ESTADO_CONTRATO_LABEL[item.estado]} · {formatFechaPlanilla(item.fecha_inicio)} –{" "}
                  {formatFechaPlanilla(item.fecha_fin)}
                </p>
                {item.cargo ? <p className="text-muted-foreground">{item.cargo}</p> : null}
                {item.remuneracion != null ? (
                  <p className="text-muted-foreground">S/ {formatRemuneracion(item.remuneracion)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Apartado>

      <Apartado
        title="Asistencias"
        resumen={asistenciaResumen}
        href={`/asistencias?entidadId=${entidadId}`}
        hrefLabel="Ir a Asistencias"
      >
        {asistencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay PDF de asistencia cargados.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {asistencias.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{item.observaciones ? etiquetaMesAsistencia(item.observaciones) : "Mes"}</span>
                <span className={item.storage_path ? "font-medium text-emerald-700" : "text-amber-800"}>
                  {item.storage_path ? "PDF subido" : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Apartado>

      <Apartado
        title="Vacaciones"
        resumen={vacacionResumen}
        href={`/vacaciones?entidadId=${entidadId}&periodo=${periodo}`}
        hrefLabel="Ir a Vacaciones"
      >
        {resumenVac.registros.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay goce registrado en {periodo}.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {resumenVac.registros.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {formatFechaPlanilla(item.fecha_inicio)} – {formatFechaPlanilla(item.fecha_fin)} · {item.dias} día
                  {item.dias === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground">{ESTADO_VACACION_LABEL[item.estado]}</span>
              </li>
            ))}
          </ul>
        )}
      </Apartado>
    </div>
  );
}
