import type { SupabaseClient } from "@supabase/supabase-js";
import type { SunatCredencialSecreto } from "../src/lib/sunat/auth";
import { decryptString } from "../src/lib/sunat/crypto";
import { SunatError, SunatTicketPendienteError } from "../src/lib/sunat/errors";
import { guardarPropuesta, marcarArchivo, registrarDescarga, subirCdr, subirXml } from "../src/lib/sunat/persistir";
import { bajarFacturasSol, type FacturaSol, type TipoSol } from "../src/lib/sunat/portal-sol";
import { descargarPropuestaRce } from "../src/lib/sunat/sire";
import { cargarEnv, crearCliente, entrar, portalDe } from "./estudio-local";

cargarEnv();

const args = leerArgs(process.argv.slice(2));
if (args.help || !args.ruc || !args.periodo) {
  console.log(`Baja la lista del SIRE y después el XML y el CDR de facturas, boletas y recibos.

  pnpm sunat:bajar -- --ruc 20609090180 --periodo 202610

  --solo-sire   solo la lista del mes
  --solo-xml    solo el XML, con la lista ya guardada
  --portal URL  portal donde entras con Google. Por defecto, https://www.bdconsultores.org`);
  process.exit(args.help ? 0 : 1);
}

const ruc = typeof args.ruc === "string" ? args.ruc : "";
const periodo = typeof args.periodo === "string" ? args.periodo : "";
if (!/^\d{11}$/.test(ruc) || !/^\d{6}$/.test(periodo)) {
  console.error("El RUC tiene 11 dígitos y el periodo es AAAAMM, por ejemplo 202610.");
  process.exit(1);
}

const portal = portalDe(typeof args.portal === "string" ? args.portal : "");
const supabase = crearCliente();

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo bajar las compras.");
  process.exit(1);
});

async function main(): Promise<void> {
  await entrar(supabase, portal);
  const credencial = await credencialDe(supabase, ruc);
  const secreto = secretoDe(credencial);
  if (!args["solo-xml"]) await bajarSire(supabase, secreto, periodo);
  if (args["solo-sire"]) {
    console.log("Lista guardada. El XML no se pidió.");
    return;
  }
  const facturas = await facturasPendientes(supabase, credencial.entidad_id as string, periodo);
  if (facturas.length === 0) {
    console.log("No hay comprobantes pendientes de XML en ese mes.");
    return;
  }
  console.log(`${facturas.length} comprobantes por bajar. Se abre SUNAT en una ventana.`);
  const clave = decryptString(credencial.clave_sol_cifrada as string, credencial.entidad_id as string);
  await bajarFacturasSol(
    { ruc, usuario: credencial.usuario_sol as string, clave },
    facturas,
    async (factura, archivos) => {
      const compra = {
        entidadId: credencial.entidad_id as string,
        periodo,
        tipo: factura.tipo,
        serie: factura.serie,
        numero: factura.numero,
      };
      if (archivos.xml) await subirXml(supabase, compra, archivos.xml);
      if (archivos.cdr) await subirCdr(supabase, compra, archivos.cdr);
      const sinXml = !archivos.xml && /no tiene el XML|no entregó el XML/i.test(archivos.aviso ?? "");
      await marcarArchivo(supabase, compra, {
        xmlEstado: archivos.xml ? "LISTO" : sinXml ? "SIN_XML" : "ERROR",
        cdrEstado: archivos.cdr ? "LISTO" : "SIN_XML",
        mensaje: archivos.aviso,
      });
      console.log(archivos.xml ? "  XML guardado" : `  ${archivos.aviso ?? "Sin XML"}`);
    },
    (mensaje) => console.log(mensaje),
  );
  console.log("Listo. En Planillas ya se puede abrir el detalle.");
}

async function bajarSire(supabase: SupabaseClient, secreto: SunatCredencialSecreto, periodo: string): Promise<void> {
  const { data: previa } = await supabase
    .from("sunat_descargas")
    .select("num_ticket, estado")
    .eq("entidad_id", secreto.entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  const ticket = previa?.estado === "EN_PROCESO" && previa.num_ticket ? (previa.num_ticket as string) : undefined;
  console.log(ticket ? "Retomo el ticket del SIRE." : "Pido la lista del mes al SIRE.");
  try {
    const propuesta = await descargarPropuestaRce(secreto, periodo, {
      numTicket: ticket,
      maxIntentos: 40,
      esperaMs: 5_000,
      onEspera: (intento) => console.log(`SUNAT sigue preparando el archivo (${intento}).`),
    });
    const { total } = await guardarPropuesta(supabase, secreto.entidadId, periodo, propuesta);
    console.log(`Lista guardada: ${total} comprobantes.`);
  } catch (error) {
    if (error instanceof SunatTicketPendienteError) {
      await registrarDescarga(supabase, secreto.entidadId, periodo, {
        numTicket: error.numTicket,
        estado: "EN_PROCESO",
        mensaje: error.message,
      });
    } else if (error instanceof SunatError) {
      await registrarDescarga(supabase, secreto.entidadId, periodo, { estado: "ERROR", mensaje: error.message });
    }
    throw error;
  }
}

const TIPOS_XML: TipoSol[] = ["01", "02", "03"];

function esTipoSol(valor: string): valor is TipoSol {
  return valor === "01" || valor === "02" || valor === "03";
}

async function facturasPendientes(supabase: SupabaseClient, entidadId: string, periodo: string): Promise<FacturaSol[]> {
  const { data, error } = await supabase
    .from("sunat_compras")
    .select("tipo, serie, numero, ruc_emisor")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .in("tipo", TIPOS_XML)
    .order("tipo", { ascending: true })
    .order("fecha_emision", { ascending: true });
  if (error) throw new Error(error.message);
  const { data: estados } = await supabase
    .from("sunat_compra_archivos")
    .select("tipo, serie, numero, xml_estado")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .in("tipo", TIPOS_XML);
  const listos = new Set(
    (estados ?? [])
      .filter((fila) => fila.xml_estado === "LISTO" || fila.xml_estado === "SIN_XML")
      .map((fila) => `${fila.tipo}|${fila.serie}|${fila.numero}`),
  );
  const pendientes: FacturaSol[] = [];
  for (const fila of data ?? []) {
    const tipo = String(fila.tipo ?? "");
    if (!esTipoSol(tipo)) continue;
    if (listos.has(`${tipo}|${fila.serie}|${fila.numero}`)) continue;
    if (!/^\d{11}$/.test(String(fila.ruc_emisor ?? ""))) {
      await marcarArchivo(
        supabase,
        { entidadId, periodo, tipo, serie: fila.serie as string, numero: fila.numero as string },
        { xmlEstado: "ERROR", mensaje: "El registro no trae el RUC del proveedor." },
      );
      continue;
    }
    pendientes.push({
      tipo,
      rucEmisor: fila.ruc_emisor as string,
      serie: fila.serie as string,
      numero: fila.numero as string,
    });
  }
  return pendientes;
}

async function credencialDe(supabase: SupabaseClient, ruc: string) {
  const { data, error } = await supabase
    .from("sunat_credenciales")
    .select("entidad_id, ruc, usuario_sol, client_id, clave_sol_cifrada, client_secret_cifrado")
    .eq("ruc", ruc)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No hay credencial para ese RUC, o esta cuenta no es del estudio.");
  return data;
}

function secretoDe(credencial: { entidad_id: string; ruc: string; usuario_sol: string; client_id: string; clave_sol_cifrada: string; client_secret_cifrado: string }): SunatCredencialSecreto {
  return {
    entidadId: credencial.entidad_id,
    ruc: credencial.ruc,
    usuarioSol: credencial.usuario_sol,
    clientId: credencial.client_id,
    claveSolCifrada: credencial.clave_sol_cifrada,
    clientSecretCifrado: credencial.client_secret_cifrado,
  };
}

function leerArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
