"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import type { TipoAdendaPlanilla } from "@inventario/types";
import {
  confirmarAdenda,
  eliminarAdenda,
  generarAdenda,
  marcarAdendaRecogida,
  setAdendaArchivo,
  type AdendaRow,
} from "@/lib/actions/adendas";
import type { ContratoRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { DateField, Field, FormSection, SelectField } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { DOCUMENTO_ACCEPT, nombreDescargaDocumento } from "@/lib/documento-storage";
import { descargarAdendaWord } from "@/lib/descargar-adenda-word";
import {
  ESTADO_CONTRATO_LABEL,
  JORNADA_LABEL,
  TIPO_ADENDA_LABEL,
  formatFechaPlanilla,
  formatRemuneracion,
  opcionesCargo,
} from "@/lib/planillas-labels";
import { getSignedDocumentoUrl } from "@/lib/storage-url";
import { uploadDocumentoFile } from "@/lib/upload-documento";

function cerrada(estado: AdendaRow["estado"]): boolean {
  return estado === "RECOGIDO" || estado === "BAJA" || estado === "COMPLETO";
}

export function FichaAdendas({
  relacionId,
  entidadId,
  trabajador,
  contratos,
  adendas,
  canWrite,
  canMarcarRecogido,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  contratos: ContratoRow[];
  adendas: AdendaRow[];
  canWrite: boolean;
  canMarcarRecogido: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const vigente = contratos.find((c) => c.es_vigente && c.datos_confirmados) ?? null;
  const abierto = adendas.find((a) => !cerrada(a.estado)) ?? null;
  const [pending, setPending] = useState<string | null>(null);
  const [mostrarGenerar, setMostrarGenerar] = useState(adendas.length === 0);
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState<AdendaRow | null>(null);

  async function onGenerar(formData: FormData) {
    setPending("generar");
    const result = await generarAdenda(relacionId, formData, editando ? abierto?.id : undefined);
    setPending(null);
    if (result.error || !result.adendaId) {
      pushToast(result.error ?? "No se pudo generar la adenda.", "error");
      return;
    }
    setMostrarGenerar(false);
    setEditando(false);
    pushToast(editando ? "Adenda actualizada." : "Adenda generada.");
    router.refresh();
    const descarga = await descargarAdendaWord(relacionId, result.adendaId);
    if (descarga.error) pushToast(descarga.error, "error");
  }

  async function onDescargar(adendaId: string) {
    setPending(`word-${adendaId}`);
    const descarga = await descargarAdendaWord(relacionId, adendaId);
    setPending(null);
    if (descarga.error) pushToast(descarga.error, "error");
  }

  async function onSubir(adenda: AdendaRow, file: File) {
    setPending(`pdf-${adenda.id}`);
    const upload = await uploadDocumentoFile(entidadId, relacionId, adenda.id, file, adenda.storage_path);
    if (upload.error || !upload.path) {
      setPending(null);
      pushToast(upload.error ?? "No se pudo subir el PDF.", "error");
      return;
    }
    const result = await setAdendaArchivo(relacionId, adenda.id, upload.path);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("PDF firmado guardado.");
    router.refresh();
  }

  async function onVerPdf(adenda: AdendaRow) {
    if (!adenda.storage_path) return;
    setPending(`ver-${adenda.id}`);
    const result = await getSignedDocumentoUrl(adenda.storage_path, {
      download: nombreDescargaDocumento(`Adenda ${adenda.numero}`, adenda.storage_path),
    });
    setPending(null);
    if (result.error || !result.url) {
      pushToast(result.error ?? "No se pudo abrir el PDF.", "error");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function onConfirmar(adendaId: string) {
    setPending("confirmar");
    const result = await confirmarAdenda(relacionId, adendaId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Adenda confirmada. Las condiciones vigentes ya se actualizaron.");
    router.refresh();
  }

  async function onRecoger(adendaId: string) {
    setPending("recogido");
    const result = await marcarAdendaRecogida(relacionId, adendaId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Adenda marcada como recogida.");
    router.refresh();
  }

  async function onEliminar() {
    if (!eliminando) return;
    setPending("eliminar");
    const result = await eliminarAdenda(relacionId, eliminando.id);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setEliminando(null);
    setMostrarGenerar(true);
    pushToast("Adenda eliminada.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        La adenda modifica una sola cláusula del contrato vigente: cargo, sueldo u horario. El contrato original y la
        fecha de ingreso no cambian. Al confirmar el PDF firmado, esa condición pasa a ser la vigente.
      </p>

      {!vigente ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          Confirme el contrato firmado antes de generar una adenda.
        </p>
      ) : null}

      {canWrite && vigente && !abierto ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMostrarGenerar((v) => !v)}>
            {mostrarGenerar ? "Ocultar formulario" : "Generar adenda"}
          </Button>
        </div>
      ) : null}

      {abierto ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending === `word-${abierto.id}`}
            onClick={() => void onDescargar(abierto.id)}
          >
            {pending === `word-${abierto.id}` ? "Descargando…" : "Descargar Word"}
          </Button>
        </div>
      ) : null}

      {canWrite && vigente && ((mostrarGenerar && !abierto) || editando) ? (
        <form action={onGenerar}>
          <FormAdenda
            trabajador={trabajador}
            titulo={editando ? `Editar adenda ${abierto?.numero ?? ""}` : "Generar adenda"}
            adenda={editando ? abierto : null}
            pending={pending === "generar"}
          />
        </form>
      ) : null}

      {abierto && canWrite && !abierto.datos_confirmados ? (
        <section className={`${panelCardClass} space-y-3 p-5`}>
          <h2 className="text-sm font-medium text-foreground">PDF firmado de la adenda {abierto.numero}</h2>
          <p className="text-xs text-muted-foreground">
            Suba el PDF firmado y confirme. Hasta entonces no cambian cargo, sueldo ni horario.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {abierto.storage_path ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void onVerPdf(abierto)}>
                Ver PDF
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">Sin PDF</span>
            )}
            <label className="inline-flex">
              <input
                type="file"
                accept={DOCUMENTO_ACCEPT}
                className="sr-only"
                aria-label="Subir PDF firmado"
                disabled={pending !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void onSubir(abierto, file);
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                {pending === `pdf-${abierto.id}` ? "Subiendo…" : abierto.storage_path ? "Reemplazar PDF" : "Subir PDF"}
              </span>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={!abierto.storage_path || pending !== null}
              onClick={() => void onConfirmar(abierto.id)}
            >
              {pending === "confirmar" ? "Guardando…" : "Confirmar adenda"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
              Editar datos
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEliminando(abierto)}>
              Eliminar
            </Button>
          </div>
        </section>
      ) : null}

      {abierto && abierto.datos_confirmados && abierto.estado === "ELABORADO" && canMarcarRecogido ? (
        <div>
          <Button type="button" disabled={pending !== null} onClick={() => void onRecoger(abierto.id)}>
            {pending === "recogido" ? "Guardando…" : "Marcar adenda recogida"}
          </Button>
        </div>
      ) : null}

      <div className={`${panelCardClass} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">N.º</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Vigencia</th>
              <th className="px-4 py-2 font-medium">Cambio</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {adendas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Aún no hay adendas.
                </td>
              </tr>
            ) : (
              adendas.map((adenda) => (
                <tr key={adenda.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{adenda.numero}</td>
                  <td className="px-4 py-2">{TIPO_ADENDA_LABEL[adenda.tipo]}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(adenda.fecha_vigencia)}</td>
                  <td className="px-4 py-2">{resumenCambio(adenda)}</td>
                  <td className="px-4 py-2">
                    {adenda.datos_confirmados && adenda.estado === "ELABORADO"
                      ? "Confirmada"
                      : ESTADO_CONTRATO_LABEL[adenda.estado]}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending === `word-${adenda.id}`}
                      onClick={() => void onDescargar(adenda.id)}
                    >
                      Word
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={eliminando != null}
        onClose={() => {
          if (pending === "eliminar") return;
          setEliminando(null);
        }}
        title="Eliminar adenda"
        description="Se descarta el Word generado. El contrato vigente no cambia."
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending === "eliminar"}
        onConfirm={() => void onEliminar()}
      />
    </div>
  );
}

function resumenCambio(adenda: AdendaRow): string {
  if (adenda.tipo === "CARGO") return adenda.cargo_nuevo ?? "—";
  if (adenda.tipo === "REMUNERACION") return formatRemuneracion(adenda.remuneracion_nueva);
  if (adenda.jornada_nueva) return JORNADA_LABEL[adenda.jornada_nueva];
  return "Horario";
}

function FormAdenda({
  trabajador,
  titulo,
  adenda,
  pending,
}: {
  trabajador: TrabajadorListItem;
  titulo: string;
  adenda: AdendaRow | null;
  pending: boolean;
}) {
  const [tipo, setTipo] = useState<TipoAdendaPlanilla>(adenda?.tipo ?? "CARGO");
  const [jornada, setJornada] = useState(adenda?.jornada_nueva ?? trabajador.jornada ?? "TIEMPO_PARCIAL");
  const [remuneracion, setRemuneracion] = useState(
    adenda?.remuneracion_nueva != null ? String(adenda.remuneracion_nueva) : "",
  );

  return (
    <FormSection
      title={titulo}
      hint={`Vigente hoy: ${trabajador.cargo ?? "sin cargo"} · sueldo ${formatRemuneracion(trabajador.remuneracion)} · ${
        trabajador.jornada ? JORNADA_LABEL[trabajador.jornada] : "sin jornada"
      }.`}
    >
      <SelectField
        label="Qué modifica"
        name="tipo"
        value={tipo}
        onChange={(event) => setTipo(event.target.value as TipoAdendaPlanilla)}
        options={(Object.keys(TIPO_ADENDA_LABEL) as TipoAdendaPlanilla[]).map((value) => ({
          value,
          label: TIPO_ADENDA_LABEL[value],
        }))}
        required
      />
      <DateField label="Rige desde" name="fecha_vigencia" defaultValue={adenda?.fecha_vigencia ?? ""} required />
      <DateField
        label="Fecha de suscripción"
        name="fecha_suscripcion"
        defaultValue={adenda?.fecha_suscripcion ?? ""}
        required
      />
      {tipo === "CARGO" ? (
        <SelectField
          label="Cargo nuevo"
          name="cargo"
          defaultValue={adenda?.cargo_nuevo ?? ""}
          options={opcionesCargo(adenda?.cargo_nuevo)}
          required
          allowEmpty
        />
      ) : null}
      {tipo === "REMUNERACION" ? (
        <Field
          label="Remuneración mensual nueva"
          name="remuneracion"
          inputMode="numeric"
          value={remuneracion}
          onChange={(event) => setRemuneracion(event.target.value)}
          required
        />
      ) : null}
      {tipo === "HORARIO" ? (
        <>
          <SelectField
            label="Jornada"
            name="jornada"
            value={jornada}
            onChange={(event) => setJornada(event.target.value as keyof typeof JORNADA_LABEL)}
            options={(Object.keys(JORNADA_LABEL) as (keyof typeof JORNADA_LABEL)[]).map((value) => ({
              value,
              label: JORNADA_LABEL[value],
            }))}
            required
          />
          <HorarioLaboralField
            jornada={jornada}
            defaultValue={adenda?.horario_nuevo ?? trabajador.horario}
          />
        </>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Generando…" : "Generar Word"}
      </Button>
    </FormSection>
  );
}
