import { redirect } from "next/navigation";
import type { EstadoRegistro } from "@inventario/types";
import { InventarioGlobalPanel } from "@/components/panel/InventarioGlobalPanel";
import { listActivos } from "@/lib/actions/activos";
import { getEntidad } from "@/lib/actions/entidades";
import { requireProfile } from "@/lib/auth/profile";

const ESTADOS_VALIDOS: EstadoRegistro[] = ["REGISTRADO", "PREREGISTRADO", "DADO_DE_BAJA"];

export default async function AdminInventarioGlobalPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  let profile;
  try {
    profile = await requireProfile("ADMIN_ENTIDAD");
  } catch {
    redirect("/login");
  }

  if (!profile.entidad_id) redirect("/login");

  const params = await searchParams;
  const estadoParam = params.estado?.toUpperCase();
  const initialEstado =
    estadoParam && ESTADOS_VALIDOS.includes(estadoParam as EstadoRegistro)
      ? (estadoParam as EstadoRegistro)
      : "";

  const [entidad, activos] = await Promise.all([
    getEntidad(profile.entidad_id),
    listActivos(),
  ]);

  if (!entidad) redirect("/login");

  return (
    <InventarioGlobalPanel
      mode="admin"
      entidades={[entidad]}
      activos={activos}
      initialEstado={initialEstado}
      fixedEntidadId={entidad.id}
      fixedEntidadNombre={entidad.nombre}
    />
  );
}
