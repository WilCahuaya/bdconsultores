import { redirect } from "next/navigation";
import { contadorPortalHomePath } from "@inventario/types";

/** Ruta legada: redirige al portal del contador. */
export default function ContadorEntidadPortalRedirectPage() {
  redirect(contadorPortalHomePath());
}
