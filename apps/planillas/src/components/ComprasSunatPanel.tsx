"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, useToast } from "@inventario/ui";
import { panelCardClass, PanelSearchInput } from "@inventario/ui/panel";
import { webAppById } from "@bd/config";
import { Field } from "@/components/fields";
import { ComprasDetalleDialog } from "@/components/ComprasDetalleDialog";
import {
  descargarComprasSunat,
  guardarCredencialSunat,
  pedirXmlCompras,
  type CompraSunatFila,
  type CredencialSunatVista,
  type DescargaSunatVista,
  type PedidoXmlVista,
} from "@/lib/actions/compras-sunat";

export function ComprasSunatPanel({
  entidadId,
  credencial,
  periodo,
  compras,
  descarga,
  pedido,
  empresaNombre,
}: {
  entidadId: string;
  credencial: CredencialSunatVista;
  periodo: string;
  compras: CompraSunatFila[];
  descarga: DescargaSunatVista | null;
  pedido: PedidoXmlVista | null;
  empresaNombre: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [guardando, setGuardando] = useState(false);
  const [credencialAbierta, setCredencialAbierta] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const bajando = pedido?.estado === "PEDIDO" || pedido?.estado === "EN_PROCESO";

  useEffect(() => {
    if (!bajando) return;
    const id = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(id);
  }, [bajando, router]);
  const [seleccion, setSeleccion] = useState<CompraSunatFila | null>(null);
  const [consulta, setConsulta] = useState("");
  const mes = `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;
  const api = webAppById("planillas").basePath;
  const visibles = useMemo(() => compras.filter((compra) => coincide(compra, consulta)), [compras, consulta]);
  const buscando = consulta.trim().length > 0;

  function ir(siguiente: string) {
    const params = new URLSearchParams({ entidadId, periodo: siguiente });
    router.push(`/compras?${params.toString()}`);
  }

  async function onGuardar(formData: FormData) {
    setGuardando(true);
    const result = await guardarCredencialSunat(entidadId, formData);
    setGuardando(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Credencial guardada.");
    setCredencialAbierta(false);
    router.refresh();
  }

  async function onDescargar() {
    setDescargando(true);
    const result = await descargarComprasSunat(entidadId, periodo);
    setDescargando(false);
    if (result.error) {
      pushToast(result.error, result.pendiente ? "success" : "error");
      router.refresh();
      return;
    }
    pushToast(
      result.total
        ? `SUNAT devolvió ${result.total} comprobantes.`
        : "SUNAT no tiene facturas, boletas electrónicas ni recibos en ese mes.",
    );
    router.refresh();
  }

  async function onPedirXml() {
    setPidiendo(true);
    const result = await pedirXmlCompras(entidadId, periodo);
    setPidiendo(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Pedido enviado a la PC del estudio.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className={`${panelCardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div>
          <h2 className="text-base font-semibold">Credencial de la API SUNAT</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {credencial.configurada
              ? `Registrada con el usuario SOL ${credencial.usuarioSol}.`
              : "Esta empresa todavía no tiene credencial."}
          </p>
        </div>
        <Button
          type="button"
          variant={credencial.configurada ? "outline" : "default"}
          onClick={() => setCredencialAbierta(true)}
        >
          {credencial.configurada ? "Editar" : "Guardar credencial"}
        </Button>
      </section>
      <Dialog
        open={credencialAbierta}
        onClose={() => {
          if (!guardando) setCredencialAbierta(false);
        }}
        title={credencial.configurada ? "Editar credencial" : "Guardar credencial"}
        style={{
          width: "min(36rem, calc(100vw - 2rem))",
          maxWidth: "36rem",
          height: "auto",
          alignSelf: "center",
        }}
      >
        <form
          key={`${credencial.configurada}-${credencial.usuarioSol}-${credencial.clientId}`}
          action={onGuardar}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Usuario SOL" name="usuarioSol" defaultValue={credencial.usuarioSol} required autoComplete="off" />
          <Field label="Client ID" name="clientId" defaultValue={credencial.clientId} required autoComplete="off" />
          <Field
            label={credencial.configurada ? "Clave SOL (en blanco conserva la actual)" : "Clave SOL"}
            name="claveSol"
            type="password"
            required={!credencial.configurada}
            autoComplete="new-password"
          />
          <Field
            label={credencial.configurada ? "Client secret (en blanco conserva el actual)" : "Client secret"}
            name="clientSecret"
            type="password"
            required={!credencial.configurada}
            autoComplete="new-password"
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : credencial.configurada ? "Guardar cambios" : "Guardar credencial"}
            </Button>
          </div>
        </form>
      </Dialog>

      <section className={`${panelCardClass} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium">Mes</span>
            <input
              type="month"
              value={mes}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d{4}-\d{2}$/.test(value)) ir(value.replace("-", ""));
              }}
            />
          </label>
          <div className="w-full min-w-[16rem] flex-1 sm:max-w-md">
            <PanelSearchInput
              value={consulta}
              onChange={setConsulta}
              placeholder="Buscar RUC, razón social, serie o número…"
            />
          </div>
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {buscando
              ? `${visibles.length} de ${compras.length}`
              : `${compras.length} ${compras.length === 1 ? "comprobante" : "comprobantes"}`}
          </p>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button type="button" onClick={onDescargar} disabled={descargando || !credencial.configurada}>
              {descargando ? "Consultando SUNAT…" : "Descargar mes"}
            </Button>
            <Button type="button" onClick={onPedirXml} disabled={pidiendo || bajando || !credencial.configurada}>
              {bajando ? "Bajando XML…" : pidiendo ? "Enviando pedido…" : "Pedir XML"}
            </Button>
            <a
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              href={`${api}/api/compras/zip?entidadId=${entidadId}&periodo=${periodo}`}
            >
              ZIP de PDF
            </a>
          </div>
        </div>
        {descarga?.mensaje && descarga.estado !== "LISTO" ? (
          <p className="text-sm text-muted-foreground">{descarga.mensaje}</p>
        ) : null}
        {pedido?.mensaje && pedido.estado !== "LISTO" ? (
          <p className="text-sm text-muted-foreground">{pedido.mensaje}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">F. emisión</th>
                <th className="px-2 py-2 font-medium">Nro. RUC</th>
                <th className="px-2 py-2 font-medium">Razón social</th>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Serie</th>
                <th className="px-2 py-2 font-medium">Número</th>
                <th className="px-2 py-2 font-medium">Mon.</th>
                <th className="px-2 py-2 text-right font-medium">Gravada</th>
                <th className="px-2 py-2 text-right font-medium">IGV</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium">XML</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr>
                  <td className="px-2 py-8 text-muted-foreground" colSpan={12}>
                    {compras.length === 0
                      ? "Todavía no hay comprobantes de este mes."
                      : "Ningún comprobante coincide con la búsqueda."}
                  </td>
                </tr>
              ) : (
                visibles.map((compra) => (
                  <tr
                    key={compra.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                    onClick={() => setSeleccion(compra)}
                  >
                    <td className="px-2 py-2 whitespace-nowrap">{fecha(compra.fecha_emision)}</td>
                    <td className="px-2 py-2 font-mono">{compra.ruc_emisor || "—"}</td>
                    <td className="px-2 py-2">{compra.razon_social_emisor || "—"}</td>
                    <td className="px-2 py-2 font-mono">{compra.tipo}</td>
                    <td className="px-2 py-2 font-mono">{compra.serie}</td>
                    <td className="px-2 py-2 font-mono">{compra.numero.padStart(10, "0")}</td>
                    <td className="px-2 py-2">{compra.moneda || "PEN"}</td>
                    <td className="px-2 py-2 text-right font-mono">{importe(compra.base)}</td>
                    <td className="px-2 py-2 text-right font-mono">{importe(compra.igv)}</td>
                    <td className="px-2 py-2 text-right font-mono">{importe(compra.total)}</td>
                    <td className="px-2 py-2">{compra.estado}</td>
                    <td className="px-2 py-2">{etiquetaXml(compra.xml_estado, compra.tipo)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ComprasDetalleDialog
          compra={seleccion}
          empresa={empresaNombre}
          rucEmpresa={credencial.ruc}
          api={api}
          onClose={() => setSeleccion(null)}
        />
      </section>
    </div>
  );
}

const NOMBRE_TIPO: Record<CompraSunatFila["tipo"], string> = {
  "01": "factura",
  "02": "recibo por honorarios",
  "03": "boleta",
};

function textoBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compacto(valor: string): string {
  return textoBusqueda(valor).replace(/[^a-z0-9]/g, "");
}

function coincide(compra: CompraSunatFila, consulta: string): boolean {
  const tokens = consulta.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const numero = compra.numero.replace(/^0+(?=\d)/, "") || "0";
  const numero10 = compra.numero.padStart(10, "0");
  const campos = [
    fecha(compra.fecha_emision),
    compra.fecha_emision,
    compra.ruc_emisor,
    compra.razon_social_emisor,
    compra.tipo,
    NOMBRE_TIPO[compra.tipo],
    compra.serie,
    numero,
    numero10,
    `${compra.serie}-${numero}`,
    `${compra.serie}-${numero10}`,
    compra.moneda,
    compra.estado,
    etiquetaXml(compra.xml_estado, compra.tipo),
    compra.total != null ? importe(compra.total) : null,
  ].filter((campo): campo is string => Boolean(campo));
  const texto = textoBusqueda(campos.join(" "));
  const plano = compacto(campos.join(" "));
  return tokens.every((token) => {
    const normal = textoBusqueda(token);
    const sinSignos = compacto(token);
    return texto.includes(normal) || (sinSignos.length > 0 && plano.includes(sinSignos));
  });
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function importe(total: number | null): string {
  if (total == null) return "—";
  const [entero, decimal] = total.toFixed(2).split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimal}`;
}

function etiquetaXml(estado: string | null, tipo: string): string {
  if (tipo !== "01" && tipo !== "02" && tipo !== "03") return "—";
  if (estado === "LISTO") return "Listo";
  if (estado === "EN_PEDIDO") return "Bajando";
  if (estado === "SIN_XML") return "Sin XML";
  if (estado === "ERROR") return "Error";
  return "Pendiente";
}

