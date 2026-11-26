import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cargarEnv, crearCliente, entrar, portalDe } from "./estudio-local";

cargarEnv();
const supabase = crearCliente();
const repo = fileURLToPath(new URL("../../../", import.meta.url));

escuchar().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo esperar los pedidos.");
  process.exit(1);
});

async function escuchar(): Promise<void> {
  await entrar(supabase, portalDe());
  await supabase
    .from("sunat_pedidos")
    .update({
      estado: "PEDIDO",
      mensaje: "La PC del estudio volvió a tomar el pedido.",
      updated_at: new Date().toISOString(),
    })
    .eq("estado", "EN_PROCESO");
  console.log("Listo. Deja esta ventana abierta. El contador pide el XML desde Planillas.");
  for (;;) {
    const pedido = await tomarPedido();
    if (!pedido) {
      await esperar(8_000);
      continue;
    }
    console.log(`Bajando ${pedido.ruc} ${pedido.periodo}`);
    const codigo = await correr(pedido.ruc, pedido.periodo);
    const bien = codigo === 0;
    await supabase
      .from("sunat_pedidos")
      .update({
        estado: bien ? "LISTO" : "ERROR",
        mensaje: bien
          ? "XML y CDR guardados. Ya se pueden abrir las facturas."
          : "La bajada se detuvo. En la PC del estudio revisa la ventana de SUNAT.",
        updated_at: new Date().toISOString(),
      })
      .eq("entidad_id", pedido.entidadId)
      .eq("periodo", pedido.periodo);
    console.log(bien ? "Pedido listo." : "Pedido con error.");
  }
}

async function tomarPedido(): Promise<{ entidadId: string; periodo: string; ruc: string } | null> {
  const { data, error } = await supabase
    .from("sunat_pedidos")
    .select("entidad_id, periodo, estado, updated_at")
    .eq("estado", "PEDIDO")
    .order("updated_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const fila = data?.[0];
  if (!fila) return null;
  const { data: tomado, error: tomaError } = await supabase
    .from("sunat_pedidos")
    .update({
      estado: "EN_PROCESO",
      mensaje: "La PC del estudio está bajando el XML.",
      updated_at: new Date().toISOString(),
    })
    .eq("entidad_id", fila.entidad_id)
    .eq("periodo", fila.periodo)
    .eq("estado", fila.estado)
    .select("entidad_id, periodo");
  if (tomaError) throw new Error(tomaError.message);
  if (!tomado?.length) return null;
  const { data: credencial, error: credencialError } = await supabase
    .from("sunat_credenciales")
    .select("ruc")
    .eq("entidad_id", fila.entidad_id)
    .maybeSingle();
  if (credencialError) throw new Error(credencialError.message);
  if (!credencial?.ruc) {
    await supabase
      .from("sunat_pedidos")
      .update({
        estado: "ERROR",
        mensaje: "Esta empresa no tiene la credencial SOL.",
        updated_at: new Date().toISOString(),
      })
      .eq("entidad_id", fila.entidad_id)
      .eq("periodo", fila.periodo);
    return null;
  }
  return { entidadId: fila.entidad_id as string, periodo: fila.periodo as string, ruc: credencial.ruc as string };
}

function correr(ruc: string, periodo: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["sunat:bajar", "--", "--ruc", ruc, "--periodo", periodo], {
      cwd: repo,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", (codigo) => resolve(codigo ?? 1));
  });
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
