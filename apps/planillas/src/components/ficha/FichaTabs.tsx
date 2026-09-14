import Link from "next/link";
import { PASOS_ALTA, type FlujoTab, type PasoAltaId } from "@/lib/flujo-ficha";

const CONTROL = [
  { id: "asistencia", label: "Asistencia" },
  { id: "vacaciones", label: "Vacaciones" },
] as const;

const TRAMITES = [
  { id: "vida-ley", label: "Vida Ley" },
  { id: "t-registro", label: "T-Registro" },
  { id: "pensiones", label: "Sistema de pensión" },
] as const;

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
        const badge = (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              active
                ? "bg-primary text-primary-foreground"
                : done
                  ? "bg-primary/80 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {done && !active ? "✓" : paso.n}
          </span>
        );
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
              href={paso.id === "contratos" ? `/contratos/${relacionId}` : `/trabajadores/${relacionId}?tab=${paso.id}`}
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

function fichaTabClass(active: boolean) {
  return active
    ? "rounded-md px-2 py-1 font-medium text-primary"
    : "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground";
}

export function FichaFlujoNav({
  relacionId,
  tab,
  completados,
  esEstudio,
}: {
  relacionId: string;
  tab: FichaTab;
  completados: Record<PasoAltaId, boolean>;
  esEstudio: boolean;
}) {
  const pasoAlta = PASOS_ALTA.find((paso) => paso.id === tab)?.id;
  return (
    <div className="space-y-4">
      <AltaPasosNav tab={pasoAlta} completados={completados} relacionId={relacionId} />
      <nav className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Control</p>
          <div className="flex flex-wrap gap-1 text-sm">
            {CONTROL.map((item) => (
              <Link
                key={item.id}
                href={`/trabajadores/${relacionId}?tab=${item.id}`}
                aria-current={tab === item.id ? "page" : undefined}
                className={fichaTabClass(tab === item.id)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        {esEstudio ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trámites del estudio</p>
            <div className="flex flex-wrap gap-1 text-sm">
              {TRAMITES.map((item) => (
                <Link
                  key={item.id}
                  href={`/trabajadores/${relacionId}?tab=${item.id}`}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={fichaTabClass(tab === item.id)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </nav>
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
