import Link from "next/link";
import {
  PASOS_ALTA,
  hrefAltaTrabajador,
  hrefFichaTrabajador,
  hrefListaProceso,
  type FlujoTab,
  type PasoAltaId,
} from "@/lib/flujo-ficha";

export type FichaTab = FlujoTab;

const PASOS_VACIOS: Record<PasoAltaId, boolean> = {
  documentos: false,
  persona: false,
  puesto: false,
  contratos: false,
};

function clasePaso(active: boolean, done: boolean, clickable: boolean) {
  if (active) return "border-primary bg-primary/5 text-primary";
  if (done) return "border-border bg-muted/40 text-foreground";
  if (clickable) return "border-border text-muted-foreground hover:text-foreground";
  return "border-border text-muted-foreground";
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
          ? "bg-primary text-primary-foreground"
          : done
            ? "bg-primary/80 text-primary-foreground"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {done && !active ? "✓" : n}
    </span>
  );
}

export function AltaPasosNav({
  tab,
  completados = PASOS_VACIOS,
  relacionId,
  altaSistemas,
}: {
  tab?: PasoAltaId;
  completados?: Record<PasoAltaId, boolean>;
  relacionId?: string;
  altaSistemas?: { done: boolean; href: string; active?: boolean };
}) {
  return (
    <ol className={`grid grid-cols-2 gap-2 ${altaSistemas ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
      {PASOS_ALTA.map((paso) => {
        const active = tab === paso.id;
        const done = completados[paso.id];
        const className = `flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${clasePaso(active, done, Boolean(relacionId))}`;
        const badge = <PasoBadge active={active} done={done} n={paso.n} />;
        if (!relacionId) {
          return (
            <li key={paso.id}>
              <span aria-current={active ? "step" : undefined} className={className}>
                {badge}
                <span className="leading-tight">{paso.label}</span>
              </span>
            </li>
          );
        }
        return (
          <li key={paso.id}>
            <Link
              href={hrefAltaTrabajador(relacionId, paso.id)}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {badge}
              <span className="leading-tight">{paso.label}</span>
            </Link>
          </li>
        );
      })}
      {altaSistemas ? (
        <li>
          <Link
            href={altaSistemas.href}
            aria-current={altaSistemas.active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${clasePaso(Boolean(altaSistemas.active), altaSistemas.done, true)}`}
          >
            <PasoBadge active={Boolean(altaSistemas.active)} done={altaSistemas.done} n={5} />
            <span className="leading-tight">Dar de alta</span>
          </Link>
        </li>
      ) : null}
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

const TABS_PROCESO: FichaTab[] = ["pensiones", "t-registro", "vida-ley", "asistencia", "vacaciones"];

export function parseFichaTab(value: string | undefined, esEstudio = false): FichaTab | null {
  if (!value || value === "datos" || value === "persona" || value === "puesto" || value === "documentos") {
    return null;
  }
  if (value === "firma" || value === "contratos") return "contratos";
  if (!esEstudio && (value === "pensiones" || value === "t-registro" || value === "vida-ley")) {
    return null;
  }
  return TABS_PROCESO.includes(value as FichaTab) ? (value as FichaTab) : null;
}
