import { redirect } from "next/navigation";
import type { EstadoRegistro } from "@inventario/types";
import { InventarioGlobalPanel } from "@/components/panel/InventarioGlobalPanel";
import { listActivos } from "@/lib/actions/activos";
import { listEntidades } from "@/lib/actions/entidades";
import { requireProfile } from "@/lib/auth/profile";

const ESTADOS_VALIDOS: EstadoRegistro[] = ["REGISTRADO", "PREREGISTRADO", "DADO_DE_BAJA"];

export default async function ContadorInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const estadoParam = params.estado?.toUpperCase();
  const initialEstado =
    estadoParam && ESTADOS_VALIDOS.includes(estadoParam as EstadoRegistro)
      ? (estadoParam as EstadoRegistro)
      : "";

  const [entidades, activos] = await Promise.all([listEntidades(), listActivos()]);

  return (
    <InventarioGlobalPanel
      entidades={entidades}
      activos={activos}
      initialEstado={initialEstado}
    />
  );
}
