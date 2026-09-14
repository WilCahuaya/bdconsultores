import Link from "next/link";
import { panelCardClass } from "@inventario/ui/panel";

export function ProcesoResumenCard({
  href,
  titulo,
  cantidad,
  hint,
  active,
}: {
  href: string;
  titulo: string;
  cantidad: number;
  hint?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${panelCardClass} p-4 hover:bg-muted/30 ${active ? "ring-1 ring-primary" : ""}`}
    >
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{cantidad}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

export function SinEmpresasPlanillas({ canCreate }: { canCreate: boolean }) {
  return (
    <div className={`${panelCardClass} space-y-2 p-5 text-sm text-muted-foreground`}>
      <p>No hay empresas con Planillas activas.</p>
      {canCreate ? (
        <Link href="/empresas/nueva" className="font-medium text-primary hover:underline">
          Crear empresa
        </Link>
      ) : (
        <p>Pida al contador que cree la empresa o active Planillas en Inventarios.</p>
      )}
    </div>
  );
}
