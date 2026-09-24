import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
import {
  PASOS_ALTA,
  hrefAltaTrabajador,
  hrefFichaTrabajador,
  hrefListaProceso,
  type FaltaPaso,
  type FlujoTab,
  type PasoAltaId,
} from "@/lib/flujo-ficha";

export type FichaTab = FlujoTab;

const PASOS_VACIOS: Record<PasoAltaId, boolean> = {
  documentos: false,
  persona: false,
  puesto: false,
  contratos: false,
  alta: false,
};

function clasePaso(active: boolean, done: boolean, clickable: boolean) {
  if (active) return "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 font-medium";
  if (done) return "border-emerald-400 bg-emerald-50 text-emerald-950";
  if (clickable) return "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground";
  return "border-border bg-card text-muted-foreground";
}

function PasoBadge({
  active,
  done,
  n,
}: {
  active: boolean;
  done: boolean;
  n: number;
}) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
        active
          ? "bg-primary-foreground text-primary"
          : done
            ? "bg-emerald-600 text-white"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}

function IconAlerta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9a1 1 0 0 1 1 1v3.5a1 1 0 1 1-2 0V10a1 1 0 0 1 1-1Zm0 8.25a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Z" />
    </svg>
  );
}

function FaltasBadge({ faltas }: { faltas: FaltaPaso[] }) {
  if (faltas.length === 0) return null;
  const n = faltas.length;
  return (
    <span
      title={faltas.map((item) => item.etiqueta).join(", ")}
      className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-950"
      aria-label={`${n} ${n === 1 ? "falta" : "faltas"}`}
    >
      <IconAlerta className="h-3 w-3" />
      {n}
    </span>
  );
}

export function AltaPasosNav({
  tab,
  completados = PASOS_VACIOS,
  faltas,
  relacionId,
}: {
  tab?: PasoAltaId;
  completados?: Record<PasoAltaId, boolean>;
  faltas?: Record<PasoAltaId, FaltaPaso[]>;
  relacionId?: string;
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {PASOS_ALTA.map((paso) => {
        const active = tab === paso.id;
        const pendientes = faltas?.[paso.id] ?? [];
        const done = faltas ? pendientes.length === 0 : completados[paso.id];
        const className = `flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${clasePaso(active, done, Boolean(relacionId))}`;
        const badge = <PasoBadge active={active} done={done} n={paso.n} />;
        const label = (
          <>
            {badge}
            <span className="min-w-0 leading-tight">{paso.label}</span>
            {done ? null : <FaltasBadge faltas={pendientes} />}
          </>
        );
        if (!relacionId) {
          return (
            <li key={paso.id}>
              <span aria-current={active ? "step" : undefined} className={className}>
                {label}
              </span>
            </li>
          );
        }
        return (
          <li key={paso.id}>
            <Link
              href={hrefAltaTrabajador(relacionId, paso.id)}
              aria-current={active ? "page" : undefined}
              aria-label={
                [
                  paso.label,
                  active ? "paso actual" : null,
                  done
                    ? "completo"
                    : pendientes.length > 0
                      ? `${pendientes.length} ${pendientes.length === 1 ? "falta" : "faltas"}`
                      : null,
                ]
                  .filter(Boolean)
                  .join(", ")
              }
              className={className}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

const PROCESO_LABEL: Partial<Record<FlujoTab, string>> = {
  "vida-ley": "Vida Ley",
  asistencia: "Asistencias",
  vacaciones: "Vacaciones",
  pensiones: "Sistema de pensión",
  "t-registro": "T-Registro",
};

export function ProcesoDesdeFichaHeader({
  relacionId,
  entidadId,
  tab,
}: {
  relacionId: string;
  entidadId: string;
  tab: FlujoTab;
}) {
  const lista = hrefListaProceso(tab, entidadId);
  const label = PROCESO_LABEL[tab] ?? "Proceso";
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {lista ? (
        <Link href={lista} className="text-primary hover:underline">
          ← {label}
        </Link>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
      <Link href={hrefFichaTrabajador(relacionId)} className="text-primary hover:underline">
        Ver ficha
      </Link>
    </div>
  );
}

export function AlertaDocumentosAlta({
  relacionId,
  etiqueta,
}: {
  relacionId: string;
  etiqueta: string;
}) {
  return (
    <p className={`${panelCardClass} border-amber-400 bg-amber-50 p-4 text-sm text-amber-950`}>
      {etiqueta}. Puede seguir el contrato; el recuadro del documento queda en alerta hasta que lo suba.{" "}
      <Link href={hrefAltaTrabajador(relacionId, "documentos")} className="font-medium underline">
        Ir a documentos
      </Link>
    </p>
  );
}

const TABS_PROCESO: FichaTab[] = ["vida-ley", "asistencia", "vacaciones"];

export function parseFichaTab(value: string | undefined, esEstudio = false): FichaTab | null {
  if (!value || value === "datos" || value === "persona" || value === "puesto" || value === "documentos") {
    return null;
  }
  if (value === "firma" || value === "contratos") return "contratos";
  if (value === "pensiones" || value === "t-registro" || value === "alta") return "alta";
  if (!esEstudio && value === "vida-ley") {
    return null;
  }
  return TABS_PROCESO.includes(value as FichaTab) ? (value as FichaTab) : null;
}
