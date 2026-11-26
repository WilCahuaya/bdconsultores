"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@inventario/ui";
import { prepararPdfCompra } from "@/lib/actions/compras-sunat";
import type { CompraSunatFila } from "@/lib/actions/compras-sunat";
import type { ComprobanteUbl, TotalesComprobante } from "@/lib/sunat/ubl";

const TIPO: Record<CompraSunatFila["tipo"], string> = {
  "01": "FACTURA ELECTRÓNICA",
  "02": "RECIBO POR HONORARIOS",
  "03": "BOLETA DE VENTA ELECTRÓNICA",
};

export function ComprasDetalleDialog({
  compra,
  empresa,
  rucEmpresa,
  api,
  onClose,
}: {
  compra: CompraSunatFila | null;
  empresa: string;
  rucEmpresa: string;
  api: string;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<ComprobanteUbl | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!compra) return;
    let vigente = true;
    setDetalle(null);
    setAviso(null);
    setCargando(true);
    prepararPdfCompra(compra.id)
      .then((resultado) => {
        if (!vigente) return;
        setDetalle(resultado.detalle ?? null);
        setAviso(resultado.aviso ?? null);
      })
      .catch(() => {
        if (vigente) setAviso("No se pudo consultar el detalle en SUNAT.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [compra]);

  const serieNumero = compra ? `${compra.serie}-${compra.numero.replace(/^0+(?=\d)/, "")}` : "";
  const lineas = detalle?.lineas ?? [];
  const gravada = numero(detalle?.gravado) ?? compra?.base ?? null;
  const igv = numero(detalle?.igv) ?? compra?.igv ?? null;
  const total = numero(detalle?.total) ?? compra?.total ?? null;

  return (
    <Dialog open={compra != null} onClose={onClose} title="Detalle del comprobante" className="max-w-5xl">
      {compra ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold tracking-wide text-teal-800">DATOS DEL PROVEEDOR</p>
                <p><span className="font-medium">RUC:</span> {detalle?.emisorRuc || compra.ruc_emisor || "—"}</p>
                <p><span className="font-medium">Razón social:</span> {detalle?.emisorNombre || compra.razon_social_emisor || "—"}</p>
                <p><span className="font-medium">Dirección:</span> {detalle?.emisorDireccion || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-teal-800">DATOS DEL CLIENTE</p>
                <p><span className="font-medium">RUC:</span> {detalle?.clienteRuc || rucEmpresa || "—"}</p>
                <p><span className="font-medium">Razón social:</span> {detalle?.clienteNombre || empresa || "—"}</p>
                <p><span className="font-medium">Observación:</span> {detalle?.observacion || "—"}</p>
              </div>
            </div>
            <div className="space-y-2 rounded-md border border-teal-700 p-3 text-sm">
              <p className="font-semibold text-teal-800">{TIPO[compra.tipo]}</p>
              <p>RUC: {detalle?.emisorRuc || compra.ruc_emisor || "—"}</p>
              <p className="text-base font-semibold">{detalle?.serieNumero || serieNumero}</p>
              <p>Fecha: {fecha(detalle?.fecha || compra.fecha_emision)}</p>
              <p>Moneda: {(detalle?.moneda || compra.moneda || "PEN").toUpperCase()}</p>
              <p>Símbolo: {simbolo(detalle?.moneda || compra.moneda)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs">
                <tr>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 text-center font-medium">Unidad medida</th>
                  <th className="px-2 py-2 text-center font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Descripción</th>
                  <th className="px-2 py-2 text-right font-medium">Valor unitario</th>
                  <th className="px-2 py-2 text-right font-medium">ICBPER</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td className="px-2 py-6 text-muted-foreground" colSpan={6}>Consultando el detalle en SUNAT…</td>
                  </tr>
                ) : lineas.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-muted-foreground" colSpan={6}>
                      {aviso || "SUNAT no entregó las líneas de este comprobante."}
                    </td>
                  </tr>
                ) : (
                  lineas.map((linea, index) => (
                    <tr key={`${linea.codigo}-${linea.descripcion}-${index}`} className="border-b last:border-0">
                      <td className="px-2 py-1.5 text-right font-mono">{decimal(linea.cantidad, 6)}</td>
                      <td className="px-2 py-1.5 text-center">{unidad(linea.unidad)}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{linea.codigo || "—"}</td>
                      <td className="px-2 py-1.5">{linea.descripcion || "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{decimal(linea.valorUnitario, 8)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{monto(linea.icbper || "0")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-md space-y-2 text-sm">
              <p className="font-medium">{total == null ? "" : `SON: ${letras(total, compra.moneda)}`}</p>
              <p className="text-xs text-muted-foreground">* Descuento global que afecta la base imponible</p>
              <p className="text-xs text-muted-foreground">** Descuento global que no afecta la base imponible</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
              {filasTotal(detalle?.totales, gravada, igv, total, simbolo(detalle?.moneda || compra.moneda)).map(([etiqueta, valor, fuerte]) => (
                <div key={etiqueta} className="contents">
                  <dt className={fuerte ? "font-semibold" : undefined}>{etiqueta}</dt>
                  <dd className={`text-right font-mono ${fuerte ? "font-semibold" : ""}`}>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <a className={boton} href={`${api}/api/compras/pdf?id=${compra.id}`}>PDF</a>
            <a className={boton} href={`${api}/api/compras/xml?id=${compra.id}`}>XML</a>
            <a className={boton} href={`${api}/api/compras/cdr?id=${compra.id}`}>CDR</a>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

const boton = "inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent";

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function numero(valor: string | number | null | undefined): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (!valor) return null;
  const amount = Number(valor.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function monto(valor: string | number | null | undefined): string {
  const n = numero(valor);
  if (n == null) return "—";
  const [entero, decimal] = n.toFixed(2).split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimal}`;
}

function decimal(valor: string, max: number): string {
  const n = numero(valor);
  if (n == null) return "—";
  return n.toFixed(max).replace(/\.?0+$/, "");
}

function filasTotal(
  totales: TotalesComprobante | undefined,
  gravada: number | null,
  igv: number | null,
  total: number | null,
  simboloMoneda: string,
): Array<[string, string, boolean]> {
  const dinero = (valor: number | null) => (valor == null ? "—" : `${simboloMoneda} ${valor.toFixed(2)}`);
  if (!totales) {
    return [
      ["Total valor venta gravado", dinero(gravada), false],
      ["Sumatoria IGV", dinero(igv), false],
      ["Importe total", dinero(total), true],
    ];
  }
  const filas: Array<[string, number, boolean]> = [
    ["Descuento global *", totales.descuentoAfecta, false],
    ["Total valor venta gravado", totales.gravado, false],
    ["Total valor venta inafecto", totales.inafecto, false],
    ["Total valor venta exonerado", totales.exonerado, false],
    ["Total valor venta gratuito", totales.gratuito, false],
    ["Total valor venta exportación", totales.exportacion, false],
    ["Descuento global **", totales.descuentoNoAfecta, false],
    ["Total descuentos", totales.descuentos, false],
    ["Sumatoria otros tributos", totales.otrosTributos, false],
    ["Sumatoria otros cargos", totales.otrosCargos, false],
    ["Sumatoria ISC", totales.isc, false],
    ["Sumatoria IGV", totales.igv, false],
    ["Sumatoria ICBPER", totales.icbper, false],
    ["Importe total", totales.total || total || 0, true],
  ];
  return filas.map(([etiqueta, valor, fuerte]) => [etiqueta, dinero(valor), fuerte]);
}

function unidad(codigo: string): string {
  const mapa: Record<string, string> = { NIU: "UNIDAD", ZZ: "UNIDAD", UNI: "UNIDAD", C62: "UNIDAD" };
  return mapa[codigo.trim().toUpperCase()] || codigo || "—";
}

function simbolo(moneda: string | null): string {
  return (moneda || "PEN").toUpperCase() === "USD" ? "US$" : "S/";
}

function letras(total: number, moneda: string | null): string {
  const nombre = (moneda || "PEN").toUpperCase() === "USD" ? "DOLARES AMERICANOS" : "SOLES";
  const entero = Math.floor(Math.abs(total) + 1e-6);
  const centavos = Math.round((Math.abs(total) - entero) * 100);
  return `${enLetras(entero)} Y ${String(centavos).padStart(2, "0")}/100 ${nombre}`;
}

function enLetras(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "UN MILLON" : `${grupo(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? "MIL" : `${grupo(miles)} MIL`);
  if (resto) partes.push(grupo(resto));
  return partes.join(" ").replace(/\bUNO\b/g, "UN");
}

function grupo(n: number): string {
  if (n === 100) return "CIEN";
  const c = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const e = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const d = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const u = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const decena = Math.floor(resto / 10);
  const unidad = resto % 10;
  const partes: string[] = [];
  if (centena) partes.push(c[centena] ?? "");
  if (resto >= 10 && resto <= 19) partes.push(e[resto - 10] ?? "");
  else if (resto >= 21 && resto <= 29) partes.push(unidad === 0 ? "VEINTE" : `VEINTI${u[unidad] ?? ""}`);
  else if (decena) partes.push(unidad ? `${d[decena]} Y ${u[unidad]}` : d[decena] ?? "");
  else if (unidad) partes.push(u[unidad] ?? "");
  return partes.filter(Boolean).join(" ");
}
