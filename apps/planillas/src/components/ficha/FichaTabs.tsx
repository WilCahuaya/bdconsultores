import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";
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
  alta: false,
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
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
