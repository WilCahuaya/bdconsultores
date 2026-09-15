import Link from "next/link";
import {
  PASOS_ALTA,
  PASOS_FICHA,
  hrefFichaTrabajador,
  hrefListaProceso,
  type FlujoTab,
  type PasoAltaId,
  type PasoFichaId,
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
}: {
  tab?: PasoAltaId;
  completados?: Record<PasoAltaId, boolean>;
  relacionId?: string;
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              href={paso.id === "contratos" ? `/contratos/${relacionId}` : hrefFichaTrabajador(relacionId, paso.id)}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {badge}
              <span className="leading-tight">{paso.label}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function FichaDatosNav({
  relacionId,
  tab,
  completados,
}: {
  relacionId: string;
  tab: PasoFichaId;
  completados: Record<PasoAltaId, boolean>;
}) {
  return (
    <nav aria-label="Ficha del trabajador">
      <ol className="grid grid-cols-3 gap-2">
        {PASOS_FICHA.map((paso) => {
          const active = tab === paso.id;
          const done = completados[paso.id];
          return (
            <li key={paso.id}>
              <Link
                href={hrefFichaTrabajador(relacionId, paso.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${clasePaso(active, done, true)}`}
              >
                <PasoBadge active={active} done={done} n={paso.n} />
                <span className="leading-tight">{paso.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
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

const TABS: FichaTab[] = [
  "persona",
  "puesto",
  "documentos",
  "contratos",
  "firma",
  "pensiones",
  "t-registro",
  "vida-ley",
  "asistencia",
  "vacaciones",
];

export function parseFichaTab(value: string | undefined, esEstudio = false): FichaTab {
  if (!value) return "documentos";
  if (value === "datos") return "persona";
  if (value === "firma") return "contratos";
  if (!esEstudio && (value === "pensiones" || value === "t-registro" || value === "vida-ley")) {
    return "documentos";
  }
  return TABS.includes(value as FichaTab) ? (value as FichaTab) : "documentos";
}
