"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Ambiente, Sede } from "@inventario/types";
import { entidadMuestraSelectorSede, sedeIdSinSelector } from "@inventario/types";
import { MAX_ACTIVOS_SIMILARES_CANTIDAD } from "@inventario/types";
import { ConfirmDialog, Input, Label, Select } from "@inventario/ui";
import {
  createActivosSimilares,
  previewActivosSimilares,
} from "@/lib/actions/activos";
import { listAmbientes, listSedes } from "@/lib/actions/ubicacion";

type DestinoUbicacion = "actual" | "otro";

export type AgregarSimilaresSuccessInfo = {
  creados: number;
  ambienteDestinoId?: string;
};

interface AgregarBienesSimilaresDialogProps {
  open: boolean;
  onClose: () => void;
  activoId: string;
  entidadId: string;
  sedeId: string;
  ambienteId: string;
  sedeNombre?: string;
  ambienteNombre?: string;
  codigoCatalogo: string;
  nombre: string;
  esRegistrado: boolean;
  onSuccess?: (info: AgregarSimilaresSuccessInfo) => void;
}

function ubicacionActualLabel(sedeNombre?: string, ambienteNombre?: string): string {
  if (sedeNombre && ambienteNombre) return `${sedeNombre} · ${ambienteNombre}`;
  if (ambienteNombre) return ambienteNombre;
  return "Ubicación actual del activo";
}

export function AgregarBienesSimilaresDialog({
  open,
  onClose,
  activoId,
  entidadId,
  sedeId,
  ambienteId,
  sedeNombre,
  ambienteNombre,
  codigoCatalogo,
  nombre,
  esRegistrado,
  onSuccess,
}: AgregarBienesSimilaresDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [cantidad, setCantidad] = useState("10");
  const [destinoUbicacion, setDestinoUbicacion] = useState<DestinoUbicacion>("actual");
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [otraSedeId, setOtraSedeId] = useState("");
  const [otroAmbienteId, setOtroAmbienteId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const qty = Math.floor(Number(cantidad) || 0);
  const cantidadValida = qty >= 1 && qty <= MAX_ACTIVOS_SIMILARES_CANTIDAD;
  const ubicacionOtroValida = destinoUbicacion === "actual" || Boolean(otraSedeId && otroAmbienteId);
  const puedeConfirmar = cantidadValida && ubicacionOtroValida;

  useEffect(() => {
    if (!open) {
      setCantidad("10");
      setDestinoUbicacion("actual");
      setOtraSedeId("");
      setOtroAmbienteId("");
      setAmbientes([]);
      setError(null);
      setPending(false);
      setPreviewText(null);
      return;
    }

    void listSedes(entidadId).then((data) => {
      setSedes(data);
      const implicitId = sedeIdSinSelector(data);
      if (implicitId) setOtraSedeId(implicitId);
    });
  }, [open, entidadId]);

  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);

  useEffect(() => {
    if (!open || destinoUbicacion !== "otro") {
      if (!open || destinoUbicacion !== "otro") setAmbientes([]);
      return;
    }
    const sedeCarga = otraSedeId || sedeIdSinSelector(sedes);
    if (!sedeCarga) {
      setAmbientes([]);
      return;
    }
    void listAmbientes(sedeCarga).then(setAmbientes);
  }, [open, destinoUbicacion, otraSedeId, sedes]);

  useEffect(() => {
    if (!open) return;

    if (!cantidadValida) {
      setPreviewText(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void previewActivosSimilares(entidadId, codigoCatalogo, qty)
      .then((preview) => {
        if (cancelled) return;
        if (!preview) {
          setPreviewText(null);
          return;
        }
        if (preview.es_registrado && preview.primer_codigo && preview.ultimo_codigo) {
          setPreviewText(
            qty === 1
              ? `Código asignado: ${preview.primer_codigo}`
              : `Códigos: ${preview.primer_codigo} → ${preview.ultimo_codigo}`,
          );
        } else {
          setPreviewText("Quedarán como preregistrados (sin código hasta validación).");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, entidadId, codigoCatalogo, qty, cantidadValida]);

  async function handleConfirm() {
    if (!cantidadValida) {
      setError(`Indique una cantidad entre 1 y ${MAX_ACTIVOS_SIMILARES_CANTIDAD}.`);
      return;
    }
    if (destinoUbicacion === "otro" && (!otraSedeId || !otroAmbienteId)) {
      setError(mostrarSelectorSede ? "Seleccione sede y ambiente de destino." : "Seleccione ambiente de destino.");
      return;
    }

    setPending(true);
    setError(null);
    const ubicacion =
      destinoUbicacion === "otro"
        ? { sedeId: otraSedeId, ambienteId: otroAmbienteId }
        : undefined;
    const result = await createActivosSimilares(activoId, qty, ubicacion);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const creados = result.data?.creados ?? qty;
    const ambienteDestinoId =
      destinoUbicacion === "otro" && otroAmbienteId ? otroAmbienteId : undefined;

    onClose();

    if (ambienteDestinoId) {
      const isAdmin = pathname.startsWith("/admin");
      const href = isAdmin
        ? `/admin/ambientes/${ambienteDestinoId}`
        : `/contador/entidades/${entidadId}/ambientes/${ambienteDestinoId}`;
      router.push(href);
    } else {
      router.refresh();
    }

    onSuccess?.({ creados, ambienteDestinoId });
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Agregar bienes similares"
      description={`Se crearán copias de «${nombre}» con los mismos datos (sin serie, foto ni comprobante). El correlativo se asigna automáticamente.`}
      confirmLabel={cantidadValida ? `Crear ${qty} activo${qty === 1 ? "" : "s"}` : "Crear"}
      pending={pending}
      error={error}
      confirmDisabled={!puedeConfirmar}
      onConfirm={() => void handleConfirm()}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cantidad_similares">Cantidad a registrar</Label>
          <Input
            id="cantidad_similares"
            type="number"
            min={1}
            max={MAX_ACTIVOS_SIMILARES_CANTIDAD}
            value={cantidad}
            onChange={(e) => {
              setCantidad(e.target.value);
              if (error) setError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Máximo {MAX_ACTIVOS_SIMILARES_CANTIDAD} por operación.
            {!esRegistrado && " Como plantilla preregistrada, las copias también serán preregistros."}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Ubicación de los nuevos activos</legend>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 px-3 py-2.5 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="destino_ubicacion_similares"
              className="mt-0.5"
              checked={destinoUbicacion === "actual"}
              onChange={() => {
                setDestinoUbicacion("actual");
                if (error) setError(null);
              }}
            />
            <span className="min-w-0 text-sm">
              <span className="font-medium text-foreground">Este ambiente</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {ubicacionActualLabel(sedeNombre, ambienteNombre)}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 px-3 py-2.5 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="destino_ubicacion_similares"
              className="mt-0.5"
              checked={destinoUbicacion === "otro"}
              onChange={() => {
                setDestinoUbicacion("otro");
                if (error) setError(null);
              }}
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-foreground">Otro ambiente</span>
              {destinoUbicacion === "otro" && (
                <span className="mt-2 block space-y-3" onClick={(e) => e.preventDefault()}>
                  {mostrarSelectorSede && (
                  <div className="space-y-1.5">
                    <Label htmlFor="similares_sede" className="text-xs">
                      Sede
                    </Label>
                    <Select
                      id="similares_sede"
                      value={otraSedeId}
                      onChange={(value) => {
                        setOtraSedeId(value);
                        setOtroAmbienteId("");
                        if (error) setError(null);
                      }}
                      options={[
                        { value: "", label: "Seleccione sede…" },
                        ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                      ]}
                    />
                  </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="similares_ambiente" className="text-xs">
                      Ambiente
                    </Label>
                    <Select
                      id="similares_ambiente"
                      value={otroAmbienteId}
                      disabled={mostrarSelectorSede ? !otraSedeId : false}
                      onChange={(value) => {
                        setOtroAmbienteId(value);
                        if (error) setError(null);
                      }}
                      options={[
                        { value: "", label: "Seleccione ambiente…" },
                        ...ambientes
                          .filter((a) => a.id !== ambienteId || otraSedeId !== sedeId)
                          .map((a) => ({ value: a.id, label: a.nombre })),
                      ]}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No se contarán como ejemplares del ambiente actual del activo plantilla.
                  </p>
                </span>
              )}
            </span>
          </label>
        </fieldset>

        {previewLoading && <p className="text-xs text-muted-foreground">Calculando códigos…</p>}
        {!previewLoading && previewText && (
          <p className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-foreground">
            {previewText}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
