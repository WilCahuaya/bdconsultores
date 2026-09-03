import type { FetchAmbientesPorSede } from "@inventario/ui/panel";
import { listAmbientesPorEntidad } from "@/lib/actions/ubicacion";

export const fetchAmbientesPorSedeWeb: FetchAmbientesPorSede = async (entidadId, sedeId) => {
  const list = await listAmbientesPorEntidad(entidadId, sedeId);
  return list.map((a) => ({ id: a.id, nombre: a.nombre }));
};
