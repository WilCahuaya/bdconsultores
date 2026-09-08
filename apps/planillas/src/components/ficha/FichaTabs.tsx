import Link from "next/link";

const TABS = [
  { id: "datos", label: "Datos" },
  { id: "contratos", label: "Contratos" },
  { id: "documentos", label: "Documentos" },
  { id: "pensiones", label: "Pensiones" },
  { id: "t-registro", label: "T-Registro" },
  { id: "vida-ley", label: "Vida Ley" },
] as const;

export type FichaTab = (typeof TABS)[number]["id"];

export function FichaTabs({ relacionId, tab }: { relacionId: string; tab: FichaTab }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-px">
      {TABS.map((item) => {
        const active = item.id === tab;
        return (
          <Link
            key={item.id}
            href={`/trabajadores/${relacionId}?tab=${item.id}`}
            className={
              active
                ? "border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function parseFichaTab(value: string | undefined): FichaTab {
  return TABS.some((t) => t.id === value) ? (value as FichaTab) : "datos";
}
