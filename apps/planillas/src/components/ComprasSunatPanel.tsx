"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { webAppById } from "@bd/config";
import { Field } from "@/components/fields";
import {
  descargarComprasSunat,
  guardarCredencialSunat,
  type CompraSunatFila,
  type CredencialSunatVista,
  type DescargaSunatVista,
} from "@/lib/actions/compras-sunat";

const TIPO: Record<CompraSunatFila["tipo"], string> = {
  "01": "Factura",
  "02": "Recibo por honorarios",
  "03": "Boleta electrónica",
};

export function ComprasSunatPanel({
  entidadId,
  credencial,
  periodo,
  compras,
  descarga,
}: {
  entidadId: string;
  credencial: CredencialSunatVista;
  periodo: string;
  compras: CompraSunatFila[];
  descarga: DescargaSunatVista | null;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const mes = `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;
  const api = webAppById("planillas").basePath;

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

  return (
    <div className="space-y-6">
      <section className={`${panelCardClass} space-y-4 p-4`}>
        <div>
          <h2 className="text-base font-semibold">Credencial de la API SUNAT</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada empresa la crea en su SOL: aplicación con la casilla MIGE RCE y RVIE - SIRE y alcance Desktop.
            Aquí van el usuario SOL secundario, la clave SOL, el client id y el client secret de ese RUC.
            La clave y el secret se guardan cifrados.
          </p>
        </div>
        <form action={onGuardar} className="grid gap-4 sm:grid-cols-2">
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
              {guardando ? "Guardando…" : "Guardar credencial"}
            </Button>
          </div>
        </form>
      </section>

      <section className={`${panelCardClass} space-y-4 p-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block space-y-1.5">
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onDescargar} disabled={descargando || !credencial.configurada}>
              {descargando ? "Consultando SUNAT…" : "Descargar mes"}
            </Button>
            <a
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              href={`${api}/api/compras/zip?entidadId=${entidadId}&periodo=${periodo}`}
            >
              ZIP de PDF
            </a>
          </div>
        </div>
        {descarga?.mensaje ? <p className="text-sm text-muted-foreground">{descarga.mensaje}</p> : null}
        <p className="text-sm text-muted-foreground">
          Entran facturas, boletas electrónicas y recibos por honorarios. El PDF es un resumen para la computadora; el XML del emisor no viene en esta descarga.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Serie y número</th>
                <th className="px-2 py-2 font-medium">Emisor</th>
                <th className="px-2 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium text-right">Total</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {compras.length === 0 ? (
                <tr>
                  <td className="px-2 py-8 text-muted-foreground" colSpan={6}>
                    Todavía no hay comprobantes de este mes.
                  </td>
                </tr>
              ) : (
                compras.map((compra) => (
                  <tr key={compra.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{TIPO[compra.tipo]}</td>
                    <td className="px-2 py-2 font-mono">
                      {compra.serie} {compra.numero}
                      {compra.numero_final ? `–${compra.numero_final}` : ""}
                    </td>
                    <td className="px-2 py-2">
                      <div>{compra.razon_social_emisor || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{compra.ruc_emisor}</div>
                    </td>
                    <td className="px-2 py-2">{fecha(compra.fecha_emision)}</td>
                    <td className="px-2 py-2 text-right font-mono">{importe(compra.total, compra.moneda)}</td>
                    <td className="px-2 py-2 text-right">
                      <a className="text-sm font-medium text-primary hover:underline" href={`${api}/api/compras/pdf?id=${compra.id}`}>
                        PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function importe(total: number | null, moneda: string | null): string {
  if (total == null) return "—";
  return `${moneda || "PEN"} ${total.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
