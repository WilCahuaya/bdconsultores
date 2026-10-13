import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogoNacional, CategoriaBien } from "@inventario/types";
import type { ActivoEditScope } from "@inventario/ui/panel";
import {
  ACTIVO_COMPROBANTE_ACCEPT,
  ACTIVO_FOTO_ACCEPT,
  CATEGORIA_BIEN_AYUDA,
  CATEGORIA_BIEN_LABELS,
  CATALOGO_CUENTA_ORDEN_CONTABILIDAD,
  activoTieneCuentaContablePropia,
  buildActivoCuentaContablePayload,
  debePersistirCuentaContableEnActivo,
  assessLabelPrintWarnings,
  buildNombreConsolidado,
  calcPeriodoMeses,
  calcValorizacionActivo,
  formatComprobanteSerieInput,
  formatFechaISOToDDMMYYYY,
  formatLabelPrintWarnings,
  resolveFechaInicioDepreciacion,
  syncFechaInicioDepreciacionInput,
  valorActivoEfectivo,
  formatPorcentajeDepreciacion,
  nombreRequiereEtiquetaOverride,
  parseFechaDDMMYYYY,
  parsePorcentajeDepreciacion,
  porcentajeFromVidaUtilMeses,
  resolveNombreEtiqueta,
  suggestNombreEtiqueta,
  validarFechaDDMMYYYY,
  validarFechaInicioDepreciacion,
  validarCuentaContableParaCatalogo,
  vidaUtilMesesFromPorcentaje,
  entidadMuestraSelectorSede,
  isCatalogoPropio,
  sedeIdSinSelector,
  type ActivoAtributoCampo,
  type UpdateActivosSimilaresInput,
} from "@inventario/types";
import {
  ActivoAtributoAutocomplete,
  Button,
  CatalogoAltaPanel,
  CatalogoPicker,
  CategoriaBienSelector,
  ConfirmDialog,
  CuentaContableFields,
  Dialog,
  FechaDdMmYyyyInput,
  FileInput,
  IncrementoMejoraField,
  Input,
  Label,
  LabelPrintTextPreview,
  parseCatalogoNacionalAltaPrefill,
  PorcentajeInput,
  Select,
  Textarea,
} from "@inventario/ui";
import { panelFieldsetClass, panelLegendClass, panelModalClass, fechaAdquisicionToneClass } from "@inventario/ui/panel";
import type { ActivoConUbicacion } from "../lib/activos";
import {
  applyActivosSimilaresPatchLocal,
  createActivo,
  previewCodigoBarras,
  updateActivo,
  updateActivosSimilares,
} from "../lib/activos";
import { createAmbiente, listAmbientes, listAmbientesPorEntidad, listSedes } from "../lib/ubicacion";
import {
  enqueueOfflineCreate,
  enqueueOfflineUpdate,
  fileToBase64,
  upsertCachedActivo,
} from "../lib/offline";
import { enqueueOfflineOp } from "../lib/master-cache";
import { updateActivoPaths, uploadActivoFile } from "../lib/storage";
import { suggestActivoAtributo, upsertLocalAtributosFromActivo } from "../lib/atributo-vocab";
import {
  createCatalogoNacional,
  createCatalogoNacionalExtension,
  deleteCatalogoOpcionPersonalizada,
  getCatalogoByCodigo,
  getNextCodigoCatalogoPropio,
  listCatalogoClases,
  listCatalogoGrupos,
  registerCatalogoOpcionPersonalizada,
  searchCatalogoNacionalOficial,
  searchCatalogoPropio,
  searchCuentasContables,
  suggestCatalogoGrupo,
  upsertCuentaContable,
} from "../lib/catalogo";
import { FotoPreviewDialog } from "./ActivoMediaDialogs";
import { ComprobanteSerieDialog } from "./ComprobanteSerieDialog";
import { getSignedStorageUrl } from "../lib/storage-url";

const fieldsetCompact = `${panelFieldsetClass} lg:col-span-1`;
const fieldsetWide = `${panelFieldsetClass} col-span-1 lg:col-span-2`;
const detalleGridClass = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4";

type CatalogoAltaInline = {
  variant: "nacional" | "propio";
  query: string;
};

function formatSoles(value: number | null) {
  if (value == null) return "—";
  return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ActivoFormDesktopProps {
  entidadId: string;
  entidadNombre: string;
  entidadNombreEtiqueta?: string | null;
  fixedSedeId?: string;
  fixedAmbienteId?: string;
  modoPreregistro?: boolean;
  activo?: ActivoConUbicacion;
  initialCatalogoCodigo?: string;
  editScope?: ActivoEditScope;
  ejemplaresTotal?: number;
  onSuccess: (activo: ActivoConUbicacion) => void;
  onCancel: () => void;
}

export function ActivoFormDesktop({
  entidadId,
  entidadNombre,
  entidadNombreEtiqueta,
  fixedSedeId,
  fixedAmbienteId,
  modoPreregistro = false,
  activo,
  initialCatalogoCodigo,
  editScope = "single",
  ejemplaresTotal = 0,
  onSuccess,
  onCancel,
}: ActivoFormDesktopProps) {
  const isEdit = Boolean(activo);
  const esEdicionMasiva = Boolean(
    isEdit && ejemplaresTotal > 1 && editScope === "bulk",
  );
  const mostrarPosibleAmbiente =
    modoPreregistro || (isEdit && activo?.estado_registro === "PREREGISTRADO");
  const hideUbicacion = mostrarPosibleAmbiente || Boolean(fixedSedeId && fixedAmbienteId);
  const [catalogo, setCatalogo] = useState<CatalogoNacional | null>(null);
  const [catalogoAlta, setCatalogoAlta] = useState<CatalogoAltaInline | null>(null);
  const [nombre, setNombre] = useState(activo?.nombre ?? "");
  const [nombreEtiqueta, setNombreEtiqueta] = useState(activo?.nombre_etiqueta ?? "");
  const [categoria, setCategoria] = useState<CategoriaBien>(activo?.categoria ?? "ACTIVO");
  const [estadoBien, setEstadoBien] = useState<"BUENO" | "REGULAR" | "MALO" | null>(
    activo?.estado_bien ?? null,
  );

  const searchCatalogoByCategoria = useCallback(
    async (query: string, limit?: number) => {
      if (categoria !== "CUENTA_ORDEN") {
        return searchCatalogoNacionalOficial(query, limit);
      }
      const perSide = Math.max(Math.ceil((limit ?? 50) / 2), 15);
      const [nacional, propio] = await Promise.all([
        searchCatalogoNacionalOficial(query, perSide),
        searchCatalogoPropio(query, perSide),
      ]);
      return [...nacional, ...propio];
    },
    [categoria],
  );

  function handleCategoriaChange(next: CategoriaBien) {
    setCategoria(next);
    if (!catalogo || isEdit) return;
    const esPropio = isCatalogoPropio(catalogo);
    if (next === "ACTIVO" && esPropio) {
      setCatalogo(null);
      setNombre("");
      setNombreEtiqueta("");
      setDepreciacion("");
      setVidaUtilMeses("");
      setCuentaCodigo("");
      setCuentaNombre("");
    }
  }
  const [marca, setMarca] = useState(activo?.marca ?? "");
  const [modelo, setModelo] = useState(activo?.modelo ?? "");
  const [serie, setSerie] = useState(activo?.serie ?? "");
  const [color, setColor] = useState(activo?.color ?? "");
  const [medidas, setMedidas] = useState(activo?.medidas ?? "");
  const [detalle, setDetalle] = useState(activo?.caracteristicas ?? "");
  const [depreciacion, setDepreciacion] = useState(activo?.depreciacion ?? "");
  const [vidaUtilMeses, setVidaUtilMeses] = useState(
    activo?.vida_util_meses != null ? String(activo.vida_util_meses) : "",
  );
  const [valor, setValor] = useState(
    activo?.valor_adquisicion != null ? String(activo.valor_adquisicion) : "",
  );
  const [incrementoDetalle, setIncrementoDetalle] = useState(activo?.incremento_detalle ?? "");
  const [valorIncremento, setValorIncremento] = useState(
    activo?.valor_incremento != null ? String(activo.valor_incremento) : "",
  );
  const [valorEsMercado, setValorEsMercado] = useState(activo?.valor_es_mercado ?? false);
  const [fechaAdquisicion, setFechaAdquisicion] = useState(
    formatFechaISOToDDMMYYYY(activo?.fecha_adquisicion),
  );
  const [fechaAdquisicionError, setFechaAdquisicionError] = useState<string | null>(null);
  const [fechaInicioDepreciacion, setFechaInicioDepreciacion] = useState(() => {
    const inicioIso = resolveFechaInicioDepreciacion(
      activo?.fecha_inicio_depreciacion,
      activo?.fecha_adquisicion,
    );
    return inicioIso ? formatFechaISOToDDMMYYYY(inicioIso) : "";
  });
  const [fechaInicioDepreciacionError, setFechaInicioDepreciacionError] = useState<string | null>(
    null,
  );
  const [observacion, setObservacion] = useState(activo?.observacion ?? "");
  const [aplicarObservacionLote, setAplicarObservacionLote] = useState(false);
  const [comprobanteSerie, setComprobanteSerie] = useState(
    activo?.comprobante_serie ? formatComprobanteSerieInput(activo.comprobante_serie) : "",
  );
  const [cuentaCodigo, setCuentaCodigo] = useState(
    activo && activoTieneCuentaContablePropia(activo)
      ? (activo.cuenta_contable_codigo ?? "")
      : "",
  );
  const [cuentaNombre, setCuentaNombre] = useState(
    activo && activoTieneCuentaContablePropia(activo)
      ? (activo.cuenta_contable_nombre ?? "")
      : "",
  );
  const cuentaReferenciaRef = useRef({
    codigo:
      activo && activoTieneCuentaContablePropia(activo)
        ? (activo.cuenta_contable_codigo ?? "")
        : "",
    nombre:
      activo && activoTieneCuentaContablePropia(activo)
        ? (activo.cuenta_contable_nombre ?? "")
        : "",
  });
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [ambientes, setAmbientes] = useState<{ id: string; nombre: string }[]>([]);
  const [sedeId, setSedeId] = useState(fixedSedeId ?? activo?.sede_id ?? "");
  const [ambienteId, setAmbienteId] = useState(fixedAmbienteId ?? activo?.ambiente_id ?? "");
  const [posibleSedeId, setPosibleSedeId] = useState(activo?.posible_sede_id ?? "");
  const [posibleAmbienteId, setPosibleAmbienteId] = useState(activo?.posible_ambiente_id ?? "");
  const [posibleAmbientes, setPosibleAmbientes] = useState<
    Array<{ id: string; nombre: string; sede_id: string; sede_nombre?: string }>
  >([]);
  const [nuevoAmbiente, setNuevoAmbiente] = useState("");
  const [codigoBarrasPreview, setCodigoBarrasPreview] = useState<string | null>(
    activo?.codigo_barras ?? null,
  );
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [pendingComprobanteFile, setPendingComprobanteFile] = useState<File | null>(null);
  const [serieDialogOpen, setSerieDialogOpen] = useState(false);
  const [fotoPreviewOpen, setFotoPreviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [labelWarnOpen, setLabelWarnOpen] = useState(false);
  const [labelWarnText, setLabelWarnText] = useState("");

  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);

  useEffect(() => {
    void listSedes(entidadId).then((data) => {
      setSedes(data);
      if (!fixedSedeId) {
        const implicitId = sedeIdSinSelector(data);
        if (implicitId) setSedeId(implicitId);
      }
      if (!isEdit) {
        const implicitId = sedeIdSinSelector(data);
        if (implicitId) setPosibleSedeId((prev) => prev || implicitId);
      }
    });
  }, [entidadId, fixedSedeId, isEdit]);

  useEffect(() => {
    if (!sedeId) {
      setAmbientes([]);
      return;
    }
    void listAmbientes(sedeId).then(setAmbientes);
  }, [sedeId]);

  useEffect(() => {
    if (!mostrarPosibleAmbiente) {
      setPosibleAmbientes([]);
      return;
    }
    void listAmbientesPorEntidad(entidadId).then((data) => {
      setPosibleAmbientes(
        data
          .filter((a) => !a.es_preregistro)
          .map((a) => ({
            id: a.id,
            nombre: a.nombre,
            sede_id: a.sede_id,
            sede_nombre: a.sede_nombre,
          })),
      );
    });
  }, [mostrarPosibleAmbiente, entidadId]);

  const posibleAmbientesOpciones = useMemo(() => {
    const sedeFiltroValida =
      Boolean(posibleSedeId) && sedes.some((s) => s.id === posibleSedeId);
    const filtrados = sedeFiltroValida
      ? posibleAmbientes.filter((a) => a.sede_id === posibleSedeId)
      : posibleAmbientes;
    const seleccion = posibleAmbienteId
      ? posibleAmbientes.find((a) => a.id === posibleAmbienteId)
      : undefined;
    let lista =
      seleccion && !filtrados.some((a) => a.id === seleccion.id)
        ? [seleccion, ...filtrados]
        : filtrados;
    if (
      posibleAmbienteId &&
      !lista.some((a) => a.id === posibleAmbienteId) &&
      activo?.posible_ambiente_nombre
    ) {
      lista = [
        {
          id: posibleAmbienteId,
          nombre: activo.posible_ambiente_nombre,
          sede_id: posibleSedeId,
          sede_nombre: activo.posible_sede_nombre,
        },
        ...lista,
      ];
    }
    const conSedeEnLabel = sedes.length > 1 && !sedeFiltroValida;
    return [
      { value: "", label: "Sin sugerencia…" },
      ...lista.map((a) => ({
        value: a.id,
        label:
          conSedeEnLabel && a.sede_nombre
            ? `${a.nombre} (${a.sede_nombre})`
            : a.nombre,
      })),
    ];
  }, [posibleAmbientes, posibleSedeId, sedes, posibleAmbienteId, activo]);

  useEffect(() => {
    if (!isEdit || !activo) return;
    setPosibleAmbienteId(activo.posible_ambiente_id ?? "");
    setPosibleSedeId(activo.posible_sede_id ?? "");
  }, [isEdit, activo?.id, activo?.posible_ambiente_id, activo?.posible_sede_id]);

  useEffect(() => {
    if (!mostrarPosibleAmbiente || !posibleAmbienteId || posibleSedeId) return;
    const match = posibleAmbientes.find((a) => a.id === posibleAmbienteId);
    if (match?.sede_id) setPosibleSedeId(match.sede_id);
  }, [mostrarPosibleAmbiente, posibleAmbienteId, posibleAmbientes, posibleSedeId]);

  useEffect(() => {
    if (!activo || !isEdit) return;

    void getCatalogoByCodigo(activo.codigo_catalogo).then((item) => {
      if (item) setCatalogo(item);
    });
  }, [activo, isEdit]);

  const fechaAdquisicionIso = useMemo(
    () => (fechaAdquisicion.trim() ? parseFechaDDMMYYYY(fechaAdquisicion) : null),
    [fechaAdquisicion],
  );
  const fechaInicioDepreciacionIso = useMemo(
    () =>
      resolveFechaInicioDepreciacion(
        fechaInicioDepreciacion.trim() ? parseFechaDDMMYYYY(fechaInicioDepreciacion) : null,
        fechaAdquisicionIso,
      ),
    [fechaInicioDepreciacion, fechaAdquisicionIso],
  );
  const periodoMeses = useMemo(
    () => calcPeriodoMeses(fechaInicioDepreciacionIso),
    [fechaInicioDepreciacionIso],
  );
  const tieneIncremento =
    Boolean(incrementoDetalle.trim()) ||
    (valorIncremento.trim() !== "" && Number(valorIncremento) > 0);
  const valorIncrementoNum = useMemo(() => {
    if (!tieneIncremento || !valorIncremento.trim()) return null;
    const n = Number(valorIncremento);
    return Number.isNaN(n) ? null : n;
  }, [tieneIncremento, valorIncremento]);
  const valorNum = useMemo(
    () =>
      valorActivoEfectivo(
        valor.trim() ? Number(valor) : null,
        valorIncrementoNum,
      ),
    [valor, valorIncrementoNum],
  );
  const vidaUtilNum = vidaUtilMeses ? Number(vidaUtilMeses) : null;
  const { depreciacionAcumulada, valorNeto } = useMemo(
    () =>
      calcValorizacionActivo({
        valor: valorNum,
        vidaUtilMeses: vidaUtilNum,
        periodoMeses,
        categoria,
        estadoBien,
      }),
    [valorNum, vidaUtilNum, periodoMeses, categoria, estadoBien],
  );
  const nombreOficial = nombre.trim() || catalogo?.denominacion || "";
  const mostrarDepreciacion = categoria !== "CUENTA_ORDEN" && !modoPreregistro;
  const mostrarCuentaContable = !modoPreregistro && !esEdicionMasiva;
  const mostrarCuentaContableBulk = esEdicionMasiva;
  const mostrarDepreciacionBulk = esEdicionMasiva && categoria !== "CUENTA_ORDEN";
  const nombreConsolidado = useMemo(
    () => buildNombreConsolidado(nombre, marca, modelo, serie, color, medidas, detalle),
    [nombre, marca, modelo, serie, color, medidas, detalle],
  );
  const nombreEtiquetaSugerido = useMemo(
    () => (nombreOficial ? suggestNombreEtiqueta(nombreOficial) : ""),
    [nombreOficial],
  );
  const mostrarNombreEtiqueta = useMemo(
    () => nombreRequiereEtiquetaOverride(nombreOficial),
    [nombreOficial],
  );
  const nombreEnEtiqueta = useMemo(
    () => resolveNombreEtiqueta(nombreOficial, nombreEtiqueta),
    [nombreOficial, nombreEtiqueta],
  );
  const entidadEnEtiqueta = useMemo(
    () => resolveNombreEtiqueta(entidadNombre, entidadNombreEtiqueta),
    [entidadNombre, entidadNombreEtiqueta],
  );

  useEffect(() => {
    if (categoria === "CUENTA_ORDEN") {
      setDepreciacion("");
      setVidaUtilMeses("");
      if (mostrarCuentaContable || mostrarCuentaContableBulk) {
        setCuentaCodigo(catalogo?.cuenta_codigo?.trim() || CATALOGO_CUENTA_ORDEN_CONTABILIDAD);
        setCuentaNombre(catalogo?.contabilidad?.trim() || "");
      }
    }
  }, [categoria, mostrarCuentaContable, mostrarCuentaContableBulk]);

  useEffect(() => {
    if (!catalogo || isEdit) return;
    if (categoria === "CUENTA_ORDEN") {
      const codigo = catalogo.cuenta_codigo?.trim() || CATALOGO_CUENTA_ORDEN_CONTABILIDAD;
      const nombre = catalogo.contabilidad?.trim() || "";
      setCuentaCodigo(codigo);
      setCuentaNombre(nombre);
      cuentaReferenciaRef.current = { codigo, nombre };
      return;
    }
    const codigo = catalogo.cuenta_codigo ?? "";
    const nombre = catalogo.contabilidad ?? "";
    setCuentaCodigo(codigo);
    setCuentaNombre(nombre);
    cuentaReferenciaRef.current = { codigo, nombre };
  }, [catalogo?.codigo, isEdit, categoria]);

  useEffect(() => {
    if (!isEdit || !activo || !catalogo || activoTieneCuentaContablePropia(activo)) return;
    if (categoria === "CUENTA_ORDEN") {
      const codigo = catalogo.cuenta_codigo?.trim() || CATALOGO_CUENTA_ORDEN_CONTABILIDAD;
      const nombre = catalogo.contabilidad?.trim() || "";
      setCuentaCodigo(codigo);
      setCuentaNombre(nombre);
      cuentaReferenciaRef.current = { codigo, nombre };
      return;
    }
    const codigo = catalogo.cuenta_codigo ?? "";
    const nombre = catalogo.contabilidad ?? "";
    setCuentaCodigo(codigo);
    setCuentaNombre(nombre);
    cuentaReferenciaRef.current = { codigo, nombre };
  }, [isEdit, activo, catalogo?.codigo, categoria]);

  const searchAtributo = useCallback(
    (campo: ActivoAtributoCampo, query: string) => suggestActivoAtributo(campo, query),
    [],
  );

  const handleCatalogoSelect = useCallback(
    (item: CatalogoNacional) => {
      setCatalogo(item);
      setNombre(item.denominacion);
      setCategoria((current) => {
        if (isCatalogoPropio(item)) return "CUENTA_ORDEN";
        if (current === "CUENTA_ORDEN") return "CUENTA_ORDEN";
        return "ACTIVO";
      });
      const quedaCuentaOrden =
        isCatalogoPropio(item) || categoria === "CUENTA_ORDEN";
      if (!quedaCuentaOrden && item.depreciacion) {
        setDepreciacion(item.depreciacion);
        const pct = parsePorcentajeDepreciacion(item.depreciacion);
        if (pct) setVidaUtilMeses(String(vidaUtilMesesFromPorcentaje(pct)));
      } else {
        setDepreciacion("");
        setVidaUtilMeses("");
      }
      if (!isEdit) {
        void previewCodigoBarras(entidadId, item.codigo).then(setCodigoBarrasPreview);
      }
      if (mostrarCuentaContable) {
        const codigo =
          item.cuenta_codigo?.trim() ||
          (quedaCuentaOrden ? CATALOGO_CUENTA_ORDEN_CONTABILIDAD : "");
        const nombre = item.contabilidad?.trim() || "";
        setCuentaCodigo(codigo);
        setCuentaNombre(nombre);
        cuentaReferenciaRef.current = { codigo, nombre };
      }
    },
    [categoria, entidadId, isEdit, mostrarCuentaContable],
  );

  useEffect(() => {
    if (initialCatalogoCodigo && !isEdit) {
      void getCatalogoByCodigo(initialCatalogoCodigo).then((item) => {
        if (item) handleCatalogoSelect(item);
      });
    }
  }, [initialCatalogoCodigo, isEdit, handleCatalogoSelect]);

  function handleCatalogoClear() {
    setCatalogo(null);
    setNombre("");
    setNombreEtiqueta("");
    setDepreciacion("");
    setVidaUtilMeses("");
    setCuentaCodigo("");
    setCuentaNombre("");
    if (!isEdit) setCodigoBarrasPreview(null);
  }

  function handleDepreciacionChange(value: string) {
    setDepreciacion(value);
    const pct = parsePorcentajeDepreciacion(value);
    if (pct) setVidaUtilMeses(String(vidaUtilMesesFromPorcentaje(pct)));
  }

  function handleVidaUtilChange(value: string) {
    setVidaUtilMeses(value);
    const meses = Number(value);
    if (value && !Number.isNaN(meses) && meses > 0) {
      setDepreciacion(formatPorcentajeDepreciacion(porcentajeFromVidaUtilMeses(meses)));
    }
  }

  function handleFechaAdquisicionChange(value: string) {
    setFechaInicioDepreciacion((current) =>
      syncFechaInicioDepreciacionInput(current, fechaAdquisicion, value),
    );
    setFechaAdquisicion(value);
    if (fechaAdquisicionError) setFechaAdquisicionError(null);
  }

  function handleFechaAdquisicionBlur() {
    setFechaAdquisicionError(validarFechaDDMMYYYY(fechaAdquisicion));
    setFechaInicioDepreciacionError(
      validarFechaInicioDepreciacion(fechaInicioDepreciacion, fechaAdquisicion),
    );
  }

  function handleFechaInicioDepreciacionChange(value: string) {
    setFechaInicioDepreciacion(value);
    if (fechaInicioDepreciacionError) setFechaInicioDepreciacionError(null);
  }

  function handleFechaInicioDepreciacionBlur() {
    setFechaInicioDepreciacionError(
      validarFechaInicioDepreciacion(fechaInicioDepreciacion, fechaAdquisicion),
    );
  }

  function handleComprobanteFileSelect(file: File | null) {
    if (!file) {
      setComprobanteFile(null);
      return;
    }
    setPendingComprobanteFile(file);
    setSerieDialogOpen(true);
  }

  function openComprobanteDatosDialog() {
    setSerieDialogOpen(true);
  }

  function confirmComprobanteSerie(datos: {
    serie: string;
    fecha: string;
    monto: string;
  }) {
    setComprobanteSerie(formatComprobanteSerieInput(datos.serie));
    if (datos.fecha.trim()) {
      handleFechaAdquisicionChange(datos.fecha);
      setFechaAdquisicionError(validarFechaDDMMYYYY(datos.fecha));
    }
    if (datos.monto.trim()) {
      setValor(datos.monto.trim());
    }
    if (pendingComprobanteFile) {
      setComprobanteFile(pendingComprobanteFile);
    }
    setPendingComprobanteFile(null);
    setSerieDialogOpen(false);
  }

  function cancelComprobanteSerie() {
    setPendingComprobanteFile(null);
    setSerieDialogOpen(false);
  }

  function handleValorEsMercadoChange(checked: boolean) {
    setValorEsMercado(checked);
    if (checked) {
      setComprobanteSerie("");
      setComprobanteFile(null);
      setPendingComprobanteFile(null);
      setSerieDialogOpen(false);
    }
  }

  async function handleCrearAmbiente() {
    if (!sedeId || !nuevoAmbiente.trim()) return;
    setMessage(null);
    const result = await createAmbiente({ sedeId, nombre: nuevoAmbiente });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setAmbientes((prev) => [...prev, result.data!]);
    setAmbienteId(result.data!.id);
    setNuevoAmbiente("");
    setMessage(`Ambiente «${result.data!.nombre}» creado.`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!catalogo) {
      setMessage(
        categoria === "CUENTA_ORDEN"
          ? "Seleccione un ítem del catálogo nacional o propio."
          : "Seleccione un ítem del catálogo nacional.",
      );
      return;
    }

    const fechaError = validarFechaDDMMYYYY(fechaAdquisicion);
    if (fechaError) {
      setFechaAdquisicionError(fechaError);
      setMessage(fechaError);
      return;
    }
    const fechaInicioError = validarFechaInicioDepreciacion(
      fechaInicioDepreciacion,
      fechaAdquisicion,
    );
    if (fechaInicioError) {
      setFechaInicioDepreciacionError(fechaInicioError);
      setMessage(fechaInicioError);
      return;
    }

    if (!esEdicionMasiva) {
      const labelWarnings = assessLabelPrintWarnings({
        nombreBien: nombreEnEtiqueta,
        entidadNombre: entidadEnEtiqueta,
      });
      if (labelWarnings.length > 0) {
        setLabelWarnText(formatLabelPrintWarnings(labelWarnings));
        setLabelWarnOpen(true);
        return;
      }
    }

    await performSave();
  }

  async function performSave() {
    if (!catalogo) return;

    setPending(true);
    setMessage(null);

    try {
    if (
      mostrarCuentaContable &&
      (cuentaCodigo.trim() || cuentaNombre.trim())
    ) {
      const cuentaError = validarCuentaContableParaCatalogo(cuentaCodigo, cuentaNombre);
      if (cuentaError) {
        setMessage(cuentaError);
        return;
      }
    }

    if (catalogo) {
      if (categoria === "ACTIVO" && isCatalogoPropio(catalogo)) {
        setMessage("Para categoría Activo use un código del catálogo nacional.");
        return;
      }
    }

    const payload = {
      codigo_catalogo: catalogo.codigo,
      nombre: nombre.trim() || catalogo.denominacion,
      nombre_etiqueta: mostrarNombreEtiqueta ? nombreEtiqueta.trim() || null : null,
      categoria,
      estado_bien: estadoBien,
      marca: marca || undefined,
      modelo: modelo || undefined,
      serie: serie || undefined,
      color: color || undefined,
      medidas: medidas || undefined,
      caracteristicas: detalle.trim() || undefined,
      ...(mostrarDepreciacion && {
        depreciacion: depreciacion || undefined,
        vida_util_meses: vidaUtilMeses ? Number(vidaUtilMeses) : undefined,
      }),
      ...(mostrarCuentaContable &&
        debePersistirCuentaContableEnActivo({
          esEdicion: isEdit,
          activoTienePropia: activo ? activoTieneCuentaContablePropia(activo) : false,
          cuentaCodigo,
          cuentaNombre,
          referenciaCodigo: cuentaReferenciaRef.current.codigo,
          referenciaNombre: cuentaReferenciaRef.current.nombre,
        }) &&
        (() => {
          const cuentaPayload = buildActivoCuentaContablePayload(
            cuentaCodigo,
            cuentaNombre,
            categoria,
          );
          return {
            cuenta_contable_codigo: cuentaPayload.cuenta_contable_codigo,
            cuenta_contable_nombre: cuentaPayload.cuenta_contable_nombre,
          };
        })()),
      observacion: observacion || undefined,
      valor_adquisicion: valor ? Number(valor) : undefined,
      valor_es_mercado: valorEsMercado,
      fecha_adquisicion: parseFechaDDMMYYYY(fechaAdquisicion) || undefined,
      fecha_inicio_depreciacion: fechaInicioDepreciacionIso || undefined,
      incremento_detalle: tieneIncremento ? incrementoDetalle.trim() || null : null,
      valor_incremento: tieneIncremento
        ? valorIncremento.trim()
          ? Number(valorIncremento)
          : null
        : null,
      ...(!valorEsMercado && { comprobante_serie: comprobanteSerie.trim() || undefined }),
      ...(mostrarPosibleAmbiente
        ? {
            posible_ambiente_id: posibleAmbienteId || null,
            estado_registro: "PREREGISTRADO" as const,
          }
        : {
            sede_id: (fixedSedeId ?? sedeId) || undefined,
            ambiente_id: (fixedAmbienteId ?? ambienteId) || undefined,
            estado_registro: "REGISTRADO" as const,
          }),
    };

    const resolvedSedeId = (fixedSedeId ?? sedeId) || "";
    const resolvedAmbienteId = (fixedAmbienteId ?? ambienteId) || "";
    const sedeNombre = sedes.find((s) => s.id === resolvedSedeId)?.nombre;
    const ambienteNombre = ambientes.find((a) => a.id === resolvedAmbienteId)?.nombre;
    const online = navigator.onLine;

    if (!online && esEdicionMasiva && activo) {
      const bulkPatch: UpdateActivosSimilaresInput = {
        categoria: payload.categoria,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        color: color.trim() || null,
        medidas: medidas.trim() || null,
        caracteristicas: detalle.trim() || null,
        estado_bien: estadoBien,
        valor_adquisicion: payload.valor_adquisicion ?? null,
        valor_es_mercado: payload.valor_es_mercado,
        fecha_adquisicion: payload.fecha_adquisicion ?? null,
        fecha_inicio_depreciacion: payload.fecha_inicio_depreciacion ?? null,
        incremento_detalle: payload.incremento_detalle ?? null,
        valor_incremento: payload.valor_incremento ?? null,
      };
      if (aplicarObservacionLote) {
        bulkPatch.observacion = observacion.trim() || null;
      }
      if (mostrarPosibleAmbiente) {
        bulkPatch.posible_ambiente_id = posibleAmbienteId || null;
      }
      if (mostrarDepreciacionBulk) {
        bulkPatch.depreciacion = depreciacion.trim() || null;
        bulkPatch.vida_util_meses = vidaUtilMeses ? Number(vidaUtilMeses) : null;
      } else if (categoria === "CUENTA_ORDEN") {
        bulkPatch.depreciacion = null;
        bulkPatch.vida_util_meses = null;
      }
      if (
        mostrarCuentaContableBulk &&
        debePersistirCuentaContableEnActivo({
          esEdicion: true,
          activoTienePropia: activoTieneCuentaContablePropia(activo),
          cuentaCodigo,
          cuentaNombre,
          referenciaCodigo: cuentaReferenciaRef.current.codigo,
          referenciaNombre: cuentaReferenciaRef.current.nombre,
        })
      ) {
        const cuentaPayload = buildActivoCuentaContablePayload(cuentaCodigo, cuentaNombre, categoria);
        bulkPatch.cuenta_contable_codigo = cuentaPayload.cuenta_contable_codigo;
        bulkPatch.cuenta_contable_nombre = cuentaPayload.cuenta_contable_nombre;
      }
      if (valorEsMercado) {
        bulkPatch.comprobante_path = null;
        bulkPatch.comprobante_serie = null;
      } else {
        bulkPatch.comprobante_serie = comprobanteSerie.trim() || null;
      }

      const files: {
        fotoBase64?: string;
        fotoName?: string;
        fotoType?: string;
        comprobanteBase64?: string;
        comprobanteName?: string;
        comprobanteType?: string;
      } = {};
      if (!valorEsMercado && comprobanteFile) {
        files.comprobanteBase64 = await fileToBase64(comprobanteFile);
        files.comprobanteName = comprobanteFile.name;
        files.comprobanteType = comprobanteFile.type;
      }
      if (fotoFile) {
        files.fotoBase64 = await fileToBase64(fotoFile);
        files.fotoName = fotoFile.name;
        files.fotoType = fotoFile.type;
      }

      await enqueueOfflineOp("activos:updateSimilares", entidadId, {
        activoId: activo.id,
        patch: bulkPatch,
        files: Object.keys(files).length > 0 ? files : undefined,
      });
      const actualizados = await applyActivosSimilaresPatchLocal(entidadId, activo, bulkPatch);
      setMessage(
        `${actualizados || ejemplaresTotal} ejemplares actualizados (guardado en cola offline, se sincronizarán al reconectar).`,
      );
      onSuccess(activo);
      return;
    }

    if (!online) {
      const files: {
        fotoBase64?: string;
        fotoName?: string;
        fotoType?: string;
        comprobanteBase64?: string;
        comprobanteName?: string;
        comprobanteType?: string;
      } = {};

      if (!valorEsMercado && comprobanteFile) {
        files.comprobanteBase64 = await fileToBase64(comprobanteFile);
        files.comprobanteName = comprobanteFile.name;
        files.comprobanteType = comprobanteFile.type;
      }
      if (fotoFile) {
        files.fotoBase64 = await fileToBase64(fotoFile);
        files.fotoName = fotoFile.name;
        files.fotoType = fotoFile.type;
      }

      const localActivo: ActivoConUbicacion = {
        ...(activo ?? ({} as ActivoConUbicacion)),
        id: activo?.id ?? `pending-${crypto.randomUUID()}`,
        entidad_id: entidadId,
        sede_id: resolvedSedeId || null,
        ambiente_id: resolvedAmbienteId || null,
        codigo_catalogo: payload.codigo_catalogo,
        correlativo: activo?.correlativo ?? null,
        codigo_barras: activo?.codigo_barras ?? codigoBarrasPreview,
        nombre: payload.nombre,
        nombre_etiqueta: payload.nombre_etiqueta ?? null,
        descripcion: activo?.descripcion ?? null,
        caracteristicas: detalle.trim() || null,
        marca: payload.marca ?? null,
        modelo: payload.modelo ?? null,
        serie: payload.serie ?? null,
        color: payload.color ?? null,
        medidas: payload.medidas ?? null,
        medida_largo: activo?.medida_largo ?? null,
        medida_ancho: activo?.medida_ancho ?? null,
        medida_altura: activo?.medida_altura ?? null,
        depreciacion: payload.depreciacion ?? null,
        observacion: payload.observacion ?? null,
        responsable: activo?.responsable ?? null,
        valor_es_mercado: payload.valor_es_mercado ?? false,
        estado_registro:
          activo?.estado_registro ??
          (mostrarPosibleAmbiente ? "PREREGISTRADO" : "REGISTRADO"),
        estado_bien: payload.estado_bien ?? null,
        categoria: payload.categoria ?? "ACTIVO",
        valor_adquisicion: payload.valor_adquisicion ?? null,
        fecha_adquisicion: payload.fecha_adquisicion ?? null,
        fecha_inicio_depreciacion: payload.fecha_inicio_depreciacion ?? null,
        incremento_detalle: payload.incremento_detalle ?? null,
        valor_incremento: payload.valor_incremento ?? null,
        vida_util_meses: payload.vida_util_meses ?? null,
        foto_path: activo?.foto_path ?? null,
        comprobante_path: valorEsMercado ? null : (activo?.comprobante_path ?? null),
        comprobante_serie: valorEsMercado ? null : (payload.comprobante_serie ?? null),
        cuenta_contable_codigo: payload.cuenta_contable_codigo ?? null,
        cuenta_contable_nombre: payload.cuenta_contable_nombre ?? null,
        cuenta_codigo: payload.cuenta_contable_codigo ?? activo?.cuenta_codigo ?? null,
        contabilidad: payload.cuenta_contable_nombre ?? activo?.contabilidad ?? null,
        motivo_baja: activo?.motivo_baja ?? null,
        created_by: activo?.created_by ?? "",
        updated_by: activo?.updated_by ?? null,
        created_at: activo?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sede_nombre: sedeNombre,
        ambiente_nombre: ambienteNombre,
      };

      const queuePayload = {
        input: payload,
        files: Object.keys(files).length > 0 ? files : undefined,
        localActivo,
      };

      if (isEdit && activo) {
        await enqueueOfflineUpdate(entidadId, activo.id, queuePayload);
      } else {
        await enqueueOfflineCreate(entidadId, queuePayload);
      }

      await upsertCachedActivo(entidadId, localActivo);
      upsertLocalAtributosFromActivo({
        marca: payload.marca,
        modelo: payload.modelo,
        serie: payload.serie,
        color: payload.color,
        medidas: payload.medidas,
        caracteristicas: payload.caracteristicas,
      });
      setMessage("Guardado en cola offline. Se sincronizará al reconectar.");
      onSuccess(localActivo);
      return;
    }

    let bulkPatch: UpdateActivosSimilaresInput | null = null;
    if (isEdit && activo && esEdicionMasiva) {
      bulkPatch = {
        categoria: payload.categoria,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        color: color.trim() || null,
        medidas: medidas.trim() || null,
        caracteristicas: detalle.trim() || null,
        estado_bien: estadoBien,
        valor_adquisicion: payload.valor_adquisicion ?? null,
        valor_es_mercado: payload.valor_es_mercado,
        fecha_adquisicion: payload.fecha_adquisicion ?? null,
        fecha_inicio_depreciacion: payload.fecha_inicio_depreciacion ?? null,
        incremento_detalle: payload.incremento_detalle ?? null,
        valor_incremento: payload.valor_incremento ?? null,
      };
      if (aplicarObservacionLote) {
        bulkPatch.observacion = observacion.trim() || null;
      }
      if (mostrarPosibleAmbiente) {
        bulkPatch.posible_ambiente_id = posibleAmbienteId || null;
      }
      if (mostrarDepreciacionBulk) {
        bulkPatch.depreciacion = depreciacion.trim() || null;
        bulkPatch.vida_util_meses = vidaUtilMeses ? Number(vidaUtilMeses) : null;
      } else if (categoria === "CUENTA_ORDEN") {
        bulkPatch.depreciacion = null;
        bulkPatch.vida_util_meses = null;
      }
      if (
        mostrarCuentaContableBulk &&
        debePersistirCuentaContableEnActivo({
          esEdicion: true,
          activoTienePropia: activoTieneCuentaContablePropia(activo),
          cuentaCodigo,
          cuentaNombre,
          referenciaCodigo: cuentaReferenciaRef.current.codigo,
          referenciaNombre: cuentaReferenciaRef.current.nombre,
        })
      ) {
        const cuentaPayload = buildActivoCuentaContablePayload(cuentaCodigo, cuentaNombre, categoria);
        bulkPatch.cuenta_contable_codigo = cuentaPayload.cuenta_contable_codigo;
        bulkPatch.cuenta_contable_nombre = cuentaPayload.cuenta_contable_nombre;
      }
      if (valorEsMercado) {
        bulkPatch.comprobante_path = null;
        bulkPatch.comprobante_serie = null;
      } else {
        bulkPatch.comprobante_serie = comprobanteSerie.trim() || null;
        if (comprobanteFile) {
          const upload = await uploadActivoFile(
            entidadId,
            activo.id,
            comprobanteFile,
            "comprobante",
            activo.comprobante_path,
          );
          if (upload.path) bulkPatch.comprobante_path = upload.path;
        }
      }
      if (fotoFile) {
        const uploadFoto = await uploadActivoFile(
          entidadId,
          activo.id,
          fotoFile,
          "foto",
          activo.foto_path,
        );
        if (uploadFoto.path) bulkPatch.foto_path = uploadFoto.path;
      }
    }

    const result =
      isEdit && activo
        ? esEdicionMasiva && bulkPatch
          ? await updateActivosSimilares(activo.id, bulkPatch)
          : await updateActivo(activo.id, payload)
        : await createActivo({
            entidad_id: entidadId,
            ...payload,
            estado_registro: mostrarPosibleAmbiente ? "PREREGISTRADO" : "REGISTRADO",
          });

    if (result.error) {
      setMessage(result.error);
      return;
    }

    const activoId =
      isEdit && activo
        ? activo.id
        : result.data && "id" in result.data
          ? result.data.id
          : undefined;

    if (!esEdicionMasiva && activoId) {
      if (valorEsMercado) {
        if (activo?.comprobante_path || activo?.comprobante_serie) {
          await updateActivoPaths(activoId, {
            comprobante_path: null,
            comprobante_serie: null,
          });
        }
      } else if (comprobanteFile) {
        const upload = await uploadActivoFile(
          entidadId,
          activoId,
          comprobanteFile,
          "comprobante",
          activo?.comprobante_path,
        );
        if (upload.path) {
          await updateActivoPaths(activoId, {
            comprobante_path: upload.path,
            comprobante_serie: comprobanteSerie.trim() || null,
          });
        }
      } else if (comprobanteSerie.trim()) {
        await updateActivoPaths(activoId, { comprobante_serie: comprobanteSerie.trim() });
      }

      if (fotoFile) {
        const upload = await uploadActivoFile(
          entidadId,
          activoId,
          fotoFile,
          "foto",
          activo?.foto_path,
        );
        if (upload.path) {
          await updateActivoPaths(activoId, { foto_path: upload.path });
        }
      }
    }

    if (esEdicionMasiva && activo) {
      setMessage(
        `${(result.data as { actualizados?: number })?.actualizados ?? ejemplaresTotal} ejemplares actualizados correctamente.`,
      );
      onSuccess(activo);
      return;
    }

    if (!result.data || !("id" in result.data)) return;

    const saved = result.data;
    const mapped = {
      ...saved,
      sede_nombre: sedeNombre,
      ambiente_nombre: ambienteNombre,
    };
    await upsertCachedActivo(entidadId, mapped);
    upsertLocalAtributosFromActivo({
      marca: payload.marca,
      modelo: payload.modelo,
      serie: payload.serie,
      color: payload.color,
      medidas: payload.medidas,
      caracteristicas: payload.caracteristicas,
    });
    onSuccess(mapped);
    } finally {
      setPending(false);
    }
  }

  const codigoBarrasDisplay =
    activo?.codigo_barras ?? codigoBarrasPreview ?? "Seleccione catálogo…";
  const messageToneClass =
    message &&
    (message.includes("Error") ||
      message.includes("obligator") ||
      message.includes("Seleccione") ||
      message.includes("fecha"))
      ? "text-destructive"
      : "text-primary";
  const formActionButtons = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="submit" disabled={pending}>
        {pending
          ? "Guardando…"
          : isEdit
            ? esEdicionMasiva
              ? `Guardar en ${ejemplaresTotal} ejemplares`
              : "Guardar cambios"
            : "Registrar activo"}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );

  return (
    <>
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2"
    >
      {esEdicionMasiva && (
        <div className="col-span-1 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm text-foreground lg:col-span-2">
          Los cambios se aplicarán a los{" "}
          <strong>{ejemplaresTotal} ejemplares</strong> de este lote de compra. Cada unidad
          conserva su código de barras y serie propios.
        </div>
      )}

      {esEdicionMasiva && activo && (
      <>
      <div className="col-span-1 space-y-1 rounded-lg border border-border/50 bg-muted/20 p-4 lg:col-span-2">
        <p className="font-semibold text-foreground">{activo.nombre}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {activo.codigo_catalogo}
          {activo.codigo_barras ? ` · ${activo.codigo_barras}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {[activo.marca, activo.modelo, activo.color, activo.medidas].filter(Boolean).join(" · ") ||
            "Sin detalle físico adicional"}
        </p>
      </div>

      <div className="col-span-1 grid gap-4 lg:col-span-2 lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          <fieldset className={panelFieldsetClass}>
            <legend className={panelLegendClass}>Categoría</legend>
            <CategoriaBienSelector
              value={categoria}
              onChange={handleCategoriaChange}
              ayuda={CATEGORIA_BIEN_AYUDA}
              opciones={(["ACTIVO", "CUENTA_ORDEN"] as const).map((key) => ({
                key,
                ...CATEGORIA_BIEN_LABELS[key],
              }))}
            />
            {mostrarCuentaContableBulk && (
              <div className="mt-4">
                <CuentaContableFields
                  codigo={cuentaCodigo}
                  nombre={cuentaNombre}
                  onCodigoChange={setCuentaCodigo}
                  onNombreChange={setCuentaNombre}
                  searchCuentas={searchCuentasContables}
                  onCreateCuenta={upsertCuentaContable}
                  disabled={pending}
                  codigoId="activo_cuenta_codigo_bulk"
                  allowCreateNew
                />
              </div>
            )}
          </fieldset>

          <fieldset className={panelFieldsetClass}>
            <legend className={panelLegendClass}>Detalle del bien</legend>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
              <ActivoAtributoAutocomplete
                id="marca_bulk"
                label="Marca"
                campo="marca"
                value={marca}
                onChange={setMarca}
                onSearch={searchAtributo}
              />
              <ActivoAtributoAutocomplete
                id="modelo_bulk"
                label="Modelo"
                campo="modelo"
                value={modelo}
                onChange={setModelo}
                onSearch={searchAtributo}
              />
              <ActivoAtributoAutocomplete
                id="color_bulk"
                label="Color"
                campo="color"
                value={color}
                onChange={setColor}
                onSearch={searchAtributo}
              />
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <ActivoAtributoAutocomplete
                id="medidas_bulk"
                label="Medidas"
                campo="medidas"
                value={medidas}
                onChange={setMedidas}
                onSearch={searchAtributo}
                placeholder='Ej. 65", 120 cm, 2.5 m, 20 L'
              />
              <ActivoAtributoAutocomplete
                id="detalle_bulk"
                label="Características"
                campo="detalle"
                value={detalle}
                onChange={setDetalle}
                onSearch={searchAtributo}
                placeholder="Ej. con respaldo, tapizado en cuero…"
              />
            </div>
          </fieldset>

          <fieldset className={panelFieldsetClass}>
            <legend className={panelLegendClass}>Valoración y documentación</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <IncrementoMejoraField
                idPrefix="incremento_bulk"
                valorId="valor_bulk"
                valorLabel={
                  valorEsMercado ? "Valor de mercado (S/)" : "Precio de adquisición (S/)"
                }
                detalle={incrementoDetalle}
                incremento={valorIncremento}
                valorBase={valor}
                onValorBaseChange={setValor}
                onChange={({ detalle, incremento }) => {
                  setIncrementoDetalle(detalle);
                  setValorIncremento(incremento);
                }}
              />
              <div className="flex flex-col justify-end gap-2 pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={valorEsMercado}
                    onChange={(e) => handleValorEsMercadoChange(e.target.checked)}
                  />
                  Usar valor de mercado (sin factura)
                </label>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha_adquisicion_bulk">Fecha de adquisición</Label>
                <FechaDdMmYyyyInput
                  id="fecha_adquisicion_bulk"
                  value={fechaAdquisicion}
                  onChange={handleFechaAdquisicionChange}
                  onBlur={handleFechaAdquisicionBlur}
                  aria-invalid={Boolean(fechaAdquisicionError)}
                  className={fechaAdquisicion ? fechaAdquisicionToneClass(valorEsMercado) : undefined}
                />
                {fechaAdquisicionError && (
                  <p className="text-xs text-destructive">{fechaAdquisicionError}</p>
                )}
                {!fechaAdquisicionError && fechaAdquisicion && (
                  <p className="text-xs text-muted-foreground">
                    {valorEsMercado
                      ? "Color ámbar: fecha aproximada (valor de mercado)."
                      : "Color azul: fecha segura (precio / factura)."}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio_depreciacion_bulk">Fecha de inicio de depreciación</Label>
                <FechaDdMmYyyyInput
                  id="fecha_inicio_depreciacion_bulk"
                  value={fechaInicioDepreciacion}
                  onChange={handleFechaInicioDepreciacionChange}
                  onBlur={handleFechaInicioDepreciacionBlur}
                  aria-invalid={Boolean(fechaInicioDepreciacionError)}
                />
                {fechaInicioDepreciacionError && (
                  <p className="text-xs text-destructive">{fechaInicioDepreciacionError}</p>
                )}
                {!fechaInicioDepreciacionError && (
                  <p className="text-xs text-muted-foreground">
                    Por defecto: primer día del mes siguiente. Puede editarla.
                  </p>
                )}
              </div>
            </div>
            {!valorEsMercado && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comprobante_serie_bulk">Serie del comprobante</Label>
                  <Input
                    id="comprobante_serie_bulk"
                    spellCheck={false}
                    value={comprobanteSerie}
                    onChange={(e) =>
                      setComprobanteSerie(formatComprobanteSerieInput(e.target.value))
                    }
                    placeholder="Ej. E001 - 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comprobante_bulk">PDF del comprobante</Label>
                  <FileInput
                    id="comprobante_bulk"
                    accept={ACTIVO_COMPROBANTE_ACCEPT}
                    file={comprobanteFile}
                    onFileChange={handleComprobanteFileSelect}
                    buttonLabel="Seleccionar PDF"
                    emptyLabel="Sin archivo adjunto"
                    hint={
                      activo.comprobante_path && !comprobanteFile
                        ? "Ya hay un PDF en el lote"
                        : "Se aplicará a todas las unidades del lote"
                    }
                    canPreview={Boolean(comprobanteFile || activo.comprobante_path)}
                    previewLabel="Previsualizar comprobante"
                    onPreview={openComprobanteDatosDialog}
                  />
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              <Label htmlFor="foto_bulk">Foto del activo</Label>
              <FileInput
                id="foto_bulk"
                accept={ACTIVO_FOTO_ACCEPT}
                file={fotoFile}
                onFileChange={setFotoFile}
                buttonLabel={
                  activo.foto_path && !fotoFile ? "Cambiar foto" : "Seleccionar foto"
                }
                emptyLabel="Sin foto adjunta"
                hint={
                  activo.foto_path && !fotoFile
                    ? "Ya hay una foto en el lote. Puede elegir otra imagen para reemplazarla en todas las unidades."
                    : "Se aplicará a todas las unidades. Formatos: JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF."
                }
                canPreview={Boolean(fotoFile || activo.foto_path)}
                previewLabel="Previsualizar foto"
                onPreview={() => setFotoPreviewOpen(true)}
              />
            </div>
            {mostrarDepreciacionBulk && (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="depreciacion_bulk">Depreciación anual</Label>
                    <PorcentajeInput
                      id="depreciacion_bulk"
                      value={depreciacion}
                      onChange={handleDepreciacionChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vida_util_meses_bulk">Vida útil (meses)</Label>
                    <Input
                      id="vida_util_meses_bulk"
                      type="number"
                      min="1"
                      value={vidaUtilMeses}
                      onChange={(e) => handleVidaUtilChange(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-md bg-muted/50 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Periodo (meses)</p>
                    <p className="font-medium">{fechaInicioDepreciacionIso ? periodoMeses : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Depreciación acumulada</p>
                    <p className="font-medium">{formatSoles(depreciacionAcumulada)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor neto</p>
                    <p className="font-medium">{formatSoles(valorNeto)}</p>
                  </div>
                </div>
              </>
            )}
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <fieldset className={panelFieldsetClass}>
            <legend className={panelLegendClass}>Estado del bien</legend>
            <div className="space-y-2">
              <Label htmlFor="estado_bien_bulk">Estado</Label>
              <Select
                id="estado_bien_bulk"
                value={estadoBien ?? ""}
                onChange={(value) =>
                  setEstadoBien(value === "" ? null : (value as "BUENO" | "REGULAR" | "MALO"))
                }
                options={[
                  { value: "", label: "Sin especificar" },
                  { value: "BUENO", label: "Bueno" },
                  { value: "REGULAR", label: "Regular" },
                  { value: "MALO", label: "Malo" },
                ]}
              />
            </div>
          </fieldset>

          <fieldset className={panelFieldsetClass}>
            <legend className={panelLegendClass}>Observaciones</legend>
            <div className="space-y-2">
              <Textarea
                id="observacion_bulk"
                className="min-h-[120px]"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Notas adicionales, incidencias, condiciones especiales…"
              />
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={aplicarObservacionLote}
                onChange={(e) => setAplicarObservacionLote(e.target.checked)}
              />
              Aplicar observación a todos los ejemplares
            </label>
          </fieldset>

          {mostrarPosibleAmbiente && (
            <fieldset className={panelFieldsetClass}>
              <legend className={panelLegendClass}>Posible ambiente</legend>
              <p className="mb-3 text-sm text-muted-foreground">
                Sugerencia de destino (opcional). Al validar podrá confirmarla o elegir otra.
              </p>
              <div className="space-y-2">
                <Label htmlFor="posible-sede-bulk">Sucursal</Label>
                <Select
                  id="posible-sede-bulk"
                  value={posibleSedeId}
                  onChange={(next) => {
                    setPosibleSedeId(next);
                    setPosibleAmbienteId("");
                  }}
                  options={[
                    { value: "", label: "Todas las sucursales…" },
                    ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                    ...(posibleSedeId &&
                    !sedes.some((s) => s.id === posibleSedeId) &&
                    activo?.posible_sede_nombre
                      ? [{ value: posibleSedeId, label: activo.posible_sede_nombre }]
                      : []),
                  ]}
                />
              </div>
              <div className="mt-3 space-y-2">
                <Label htmlFor="posible-ambiente-bulk">Ambiente</Label>
                <Select
                  id="posible-ambiente-bulk"
                  value={posibleAmbienteId}
                  onChange={(nextAmbienteId) => {
                    setPosibleAmbienteId(nextAmbienteId);
                    if (!nextAmbienteId) return;
                    const match = posibleAmbientes.find((a) => a.id === nextAmbienteId);
                    if (match?.sede_id) setPosibleSedeId(match.sede_id);
                  }}
                  options={posibleAmbientesOpciones}
                />
              </div>
            </fieldset>
          )}
        </div>
      </div>
      </>
      )}

      {!esEdicionMasiva && (
      <>
      <fieldset className={fieldsetCompact}>
        <legend className={panelLegendClass}>Identificación</legend>

        <CategoriaBienSelector
          value={categoria}
          onChange={handleCategoriaChange}
          ayuda={CATEGORIA_BIEN_AYUDA}
          opciones={(["ACTIVO", "CUENTA_ORDEN"] as const).map((key) => ({
            key,
            ...CATEGORIA_BIEN_LABELS[key],
          }))}
        />

        <CatalogoPicker
          variant={categoria === "CUENTA_ORDEN" ? "ambos" : "nacional"}
          searchCatalogo={searchCatalogoByCategoria}
          resolveCodigo={getCatalogoByCodigo}
          onSelect={(item) => {
            setCatalogoAlta(null);
            handleCatalogoSelect(item);
          }}
          onClear={handleCatalogoClear}
          selectedCodigo={catalogo?.codigo ?? activo?.codigo_catalogo}
          selectedDenominacion={catalogo?.denominacion}
          disabled={pending || esEdicionMasiva || Boolean(catalogoAlta)}
          renderAddMissing={(q) => (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {categoria === "ACTIVO" ? (
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setCatalogoAlta({ variant: "nacional", query: q })}
                >
                  Crear en catálogo nacional
                </button>
              ) : (
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setCatalogoAlta({ variant: "propio", query: q })}
                >
                  Crear en catálogo propio
                </button>
              )}
            </div>
          )}
        />

        <div className="space-y-2">
          <Label>Código de barras</Label>
          <Input readOnly value={codigoBarrasDisplay} className="bg-muted font-mono text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre del bien</Label>
          <Input
            id="nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        {mostrarCuentaContable && (
          <CuentaContableFields
            codigo={cuentaCodigo}
            nombre={cuentaNombre}
            onCodigoChange={setCuentaCodigo}
            onNombreChange={setCuentaNombre}
            searchCuentas={searchCuentasContables}
            onCreateCuenta={upsertCuentaContable}
            disabled={pending}
            codigoId="activo_cuenta_codigo"
            allowCreateNew
          />
        )}

        {mostrarNombreEtiqueta && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Label htmlFor="nombre_etiqueta">Nombre en etiqueta</Label>
            {nombreEtiquetaSugerido && nombreEtiquetaSugerido !== nombreOficial.toUpperCase() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNombreEtiqueta(nombreEtiquetaSugerido)}
              >
                Usar sugerencia
              </Button>
            )}
          </div>
          <Input
            id="nombre_etiqueta"
            value={nombreEtiqueta}
            onChange={(e) => setNombreEtiqueta(e.target.value)}
            placeholder={
              nombreEtiquetaSugerido && nombreEtiquetaSugerido !== nombreOficial.toUpperCase()
                ? nombreEtiquetaSugerido
                : "Si está vacío, se usa el nombre del bien"
            }
          />
          <p className="text-xs text-muted-foreground">
            El nombre del bien es largo para la etiqueta 50×25 mm. Indique un texto más corto; si
            queda vacío, se usará el nombre del bien.
          </p>
        </div>
        )}

        {(nombreEnEtiqueta || entidadEnEtiqueta) && (
          <LabelPrintTextPreview
            nombreBien={nombreEnEtiqueta}
            entidadNombre={entidadEnEtiqueta}
          />
        )}
      </fieldset>

      <fieldset className={fieldsetCompact}>
        <legend className={panelLegendClass}>Detalle del bien</legend>
        <div className={detalleGridClass}>
          <ActivoAtributoAutocomplete
            id="marca"
            label="Marca"
            campo="marca"
            value={marca}
            onChange={setMarca}
            onSearch={searchAtributo}
          />
          <ActivoAtributoAutocomplete
            id="modelo"
            label="Modelo"
            campo="modelo"
            value={modelo}
            onChange={setModelo}
            onSearch={searchAtributo}
          />
          {!esEdicionMasiva && (
          <ActivoAtributoAutocomplete
            id="serie"
            label="Serie"
            campo="serie"
            value={serie}
            onChange={setSerie}
            onSearch={searchAtributo}
          />
          )}
          <ActivoAtributoAutocomplete
            id="color"
            label="Color"
            campo="color"
            value={color}
            onChange={setColor}
            onSearch={searchAtributo}
          />
        </div>
        <div className={detalleGridClass}>
          <div className="col-span-2 min-w-0">
            <ActivoAtributoAutocomplete
              id="medidas"
              label="Medidas"
              campo="medidas"
              value={medidas}
              onChange={setMedidas}
              onSearch={searchAtributo}
              placeholder='Ej. 65", 120 cm, 2.5 m, 20 L'
            />
          </div>
          <div className="col-span-2 min-w-0">
            <ActivoAtributoAutocomplete
              id="detalle"
              label="Características"
              campo="detalle"
              value={detalle}
              onChange={setDetalle}
              onSearch={searchAtributo}
              placeholder="Ej. con respaldo, tapizado en cuero…"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado_bien">Estado del bien</Label>
          <Select
            id="estado_bien"
            value={estadoBien ?? ""}
            onChange={(value) =>
              setEstadoBien(value === "" ? null : (value as "BUENO" | "REGULAR" | "MALO"))
            }
            options={[
              { value: "", label: "Sin especificar" },
              { value: "BUENO", label: "Bueno" },
              { value: "REGULAR", label: "Regular" },
              { value: "MALO", label: "Malo" },
            ]}
          />
        </div>
        <div className="space-y-2 border-t border-border/50 pt-4">
          <Label>Nombre consolidado</Label>
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {nombreConsolidado || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Nombre en mayúsculas; marca como se escribe; modelo, serie, color y medidas en
            minúsculas.
          </p>
        </div>
        <div className="space-y-2 border-t border-border/50 pt-4">
          <Label htmlFor="observacion">Observaciones</Label>
          <Textarea
            id="observacion"
            className="min-h-[80px]"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Notas adicionales, incidencias, condiciones especiales…"
          />
        </div>
      </fieldset>

      <fieldset className={fieldsetCompact}>
        <legend className={panelLegendClass}>
          {categoria === "CUENTA_ORDEN" ? "Valoración" : "Valoración y depreciación"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <IncrementoMejoraField
            idPrefix="incremento"
            valorId="valor"
            valorLabel={
              valorEsMercado ? "Valor de mercado (S/)" : "Precio de adquisición (S/)"
            }
            detalle={incrementoDetalle}
            incremento={valorIncremento}
            valorBase={valor}
            onValorBaseChange={setValor}
            onChange={({ detalle, incremento }) => {
              setIncrementoDetalle(detalle);
              setValorIncremento(incremento);
            }}
          />
          <div className="flex flex-col justify-end gap-2 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={valorEsMercado}
                onChange={(e) => handleValorEsMercadoChange(e.target.checked)}
              />
              Usar valor de mercado (sin factura)
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fecha_adquisicion">Fecha de adquisición</Label>
            <FechaDdMmYyyyInput
              id="fecha_adquisicion"
              value={fechaAdquisicion}
              onChange={handleFechaAdquisicionChange}
              onBlur={handleFechaAdquisicionBlur}
              aria-invalid={Boolean(fechaAdquisicionError)}
              className={fechaAdquisicion ? fechaAdquisicionToneClass(valorEsMercado) : undefined}
            />
            {fechaAdquisicionError && (
              <p className="text-xs text-destructive">{fechaAdquisicionError}</p>
            )}
            {!fechaAdquisicionError && fechaAdquisicion && (
              <p className="text-xs text-muted-foreground">
                {valorEsMercado
                  ? "Color ámbar: fecha aproximada (valor de mercado)."
                  : "Color azul: fecha segura (precio / factura)."}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha_inicio_depreciacion">Fecha de inicio de depreciación</Label>
            <FechaDdMmYyyyInput
              id="fecha_inicio_depreciacion"
              value={fechaInicioDepreciacion}
              onChange={handleFechaInicioDepreciacionChange}
              onBlur={handleFechaInicioDepreciacionBlur}
              aria-invalid={Boolean(fechaInicioDepreciacionError)}
            />
            {fechaInicioDepreciacionError && (
              <p className="text-xs text-destructive">{fechaInicioDepreciacionError}</p>
            )}
            {!fechaInicioDepreciacionError && (
              <p className="text-xs text-muted-foreground">
                Por defecto: primer día del mes siguiente. Puede editarla.
              </p>
            )}
          </div>
        </div>
        {!valorEsMercado && !esEdicionMasiva && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comprobante_serie">Serie del comprobante</Label>
              <Input
                id="comprobante_serie"
                spellCheck={false}
                value={comprobanteSerie}
                onChange={(e) => setComprobanteSerie(formatComprobanteSerieInput(e.target.value))}
                placeholder="Ej. E001 - 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comprobante">PDF del comprobante</Label>
              <FileInput
                id="comprobante"
                accept={ACTIVO_COMPROBANTE_ACCEPT}
                file={comprobanteFile}
                onFileChange={handleComprobanteFileSelect}
                buttonLabel="Seleccionar PDF"
                emptyLabel="Sin archivo adjunto"
                hint={
                  isEdit && activo?.comprobante_path && !comprobanteFile
                    ? "Ya hay un PDF adjunto"
                    : undefined
                }
                canPreview={Boolean(comprobanteFile || (isEdit && activo?.comprobante_path))}
                previewLabel="Previsualizar comprobante"
                onPreview={openComprobanteDatosDialog}
              />
            </div>
          </div>
        )}
        {!esEdicionMasiva && (
        <div className="space-y-2">
          <Label htmlFor="foto_activo">Foto del activo</Label>
          <FileInput
            id="foto_activo"
            accept={ACTIVO_FOTO_ACCEPT}
            file={fotoFile}
            onFileChange={setFotoFile}
            buttonLabel={
              isEdit && activo?.foto_path && !fotoFile ? "Cambiar foto" : "Seleccionar foto"
            }
            emptyLabel="Sin foto adjunta"
            hint={
              isEdit && activo?.foto_path && !fotoFile
                ? "Ya hay una foto. Puede elegir otra imagen (JPG, PNG, WebP, GIF, HEIC, etc.) para reemplazarla."
                : "Formatos: JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF."
            }
            canPreview={Boolean(fotoFile || (isEdit && activo?.foto_path))}
            previewLabel="Previsualizar foto"
            onPreview={() => setFotoPreviewOpen(true)}
          />
        </div>
        )}
        {mostrarDepreciacion && (
        <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="depreciacion">Depreciación anual</Label>
            <PorcentajeInput
              id="depreciacion"
              value={depreciacion}
              onChange={handleDepreciacionChange}
            />
            <p className="text-xs text-muted-foreground">
              Al ingresar el % se calcula la vida útil en meses
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vida_util_meses">Vida útil (meses)</Label>
            <Input
              id="vida_util_meses"
              type="number"
              min="1"
              value={vidaUtilMeses}
              onChange={(e) => handleVidaUtilChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Al ingresar meses se calcula el % anual equivalente
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 rounded-md bg-muted/50 p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Periodo (meses)</p>
            <p className="font-medium">{fechaInicioDepreciacionIso ? periodoMeses : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Meses desde la fecha de adquisición</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Depreciación acumulada</p>
            <p className="font-medium">{formatSoles(depreciacionAcumulada)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              (Valor ÷ vida útil) × periodo, sin superar el valor
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor neto</p>
            <p className="font-medium">{formatSoles(valorNeto)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Valor menos depreciación acumulada</p>
          </div>
        </div>
        </>
        )}
      </fieldset>

      {mostrarPosibleAmbiente && (
        <fieldset className={fieldsetWide}>
          <legend className={panelLegendClass}>Posible ambiente</legend>
          <p className="mb-3 text-sm text-muted-foreground">
            Sugerencia de destino (opcional). Al validar podrá confirmarla o elegir otra.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="posible-sede">Sucursal</Label>
              <Select
                id="posible-sede"
                value={posibleSedeId}
                onChange={(next) => {
                  setPosibleSedeId(next);
                  setPosibleAmbienteId("");
                }}
                options={[
                  { value: "", label: "Todas las sucursales…" },
                  ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                  ...(posibleSedeId &&
                  !sedes.some((s) => s.id === posibleSedeId) &&
                  activo?.posible_sede_nombre
                    ? [{ value: posibleSedeId, label: activo.posible_sede_nombre }]
                    : []),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posible-ambiente">Ambiente</Label>
              <Select
                id="posible-ambiente"
                value={posibleAmbienteId}
                onChange={(nextAmbienteId) => {
                  setPosibleAmbienteId(nextAmbienteId);
                  if (!nextAmbienteId) return;
                  const match = posibleAmbientes.find((a) => a.id === nextAmbienteId);
                  if (match?.sede_id) setPosibleSedeId(match.sede_id);
                }}
                options={posibleAmbientesOpciones}
              />
            </div>
          </div>
        </fieldset>
      )}

      {!hideUbicacion && (
      <fieldset className={fieldsetWide}>
        <legend className={panelLegendClass}>Ubicación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {mostrarSelectorSede && (
          <div className="space-y-2">
            <Label htmlFor="sede">Sede</Label>
            <Select
              id="sede"
              value={sedeId}
              onChange={(nextSede) => {
                setSedeId(nextSede);
                setAmbienteId("");
              }}
              options={[
                { value: "", label: "Seleccione…" },
                ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
              ]}
            />
          </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ambiente">Ambiente</Label>
            <Select
              id="ambiente"
              value={ambienteId}
              onChange={setAmbienteId}
              disabled={!sedeId}
              options={[
                { value: "", label: "Seleccione…" },
                ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
              ]}
            />
            {sedeId && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Input
                  placeholder="Nuevo ambiente"
                  value={nuevoAmbiente}
                  onChange={(e) => setNuevoAmbiente(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!nuevoAmbiente.trim()}
                  onClick={() => void handleCrearAmbiente()}
                >
                  Agregar ambiente
                </Button>
              </div>
            )}
          </div>
        </div>
      </fieldset>
      )}
      </>
      )}

      <div className="col-span-1 flex flex-col items-end gap-2 lg:col-start-2">
        {message && <p className={`text-sm ${messageToneClass}`}>{message}</p>}
        {formActionButtons}
      </div>
    </form>

    <Dialog
      open={Boolean(catalogoAlta)}
      onClose={() => setCatalogoAlta(null)}
      title={
        catalogoAlta?.variant === "nacional"
          ? "Nuevo ítem del catálogo nacional"
          : "Nuevo bien de cuenta de orden"
      }
      description={
        catalogoAlta?.variant === "nacional"
          ? "Se agregará al catálogo SBN y quedará seleccionado en este activo."
          : "Se agregará al catálogo propio y quedará seleccionado en este activo."
      }
      className={panelModalClass}
    >
      {catalogoAlta && (
        <CatalogoAltaPanel
          variant={catalogoAlta.variant}
          hideIntro
          initialDenominacion={
            catalogoAlta.variant === "nacional"
              ? parseCatalogoNacionalAltaPrefill(catalogoAlta.query).denominacion ?? ""
              : catalogoAlta.query
          }
          initialCodigo={
            catalogoAlta.variant === "nacional"
              ? parseCatalogoNacionalAltaPrefill(catalogoAlta.query).codigo ?? ""
              : ""
          }
          loadNextCodigo={
            catalogoAlta.variant === "propio" ? getNextCodigoCatalogoPropio : undefined
          }
          loadGrupos={listCatalogoGrupos}
          loadClases={listCatalogoClases}
          searchCuentasContables={searchCuentasContables}
          suggestGrupo={suggestCatalogoGrupo}
          onRegisterOpcionPersonalizada={registerCatalogoOpcionPersonalizada}
          onDeleteOpcionPersonalizada={deleteCatalogoOpcionPersonalizada}
          onSubmit={
            catalogoAlta.variant === "nacional"
              ? createCatalogoNacionalExtension
              : createCatalogoNacional
          }
          onCreateCuentaContable={upsertCuentaContable}
          onItemCreated={(item) => {
            handleCatalogoSelect(item);
            setCatalogoAlta(null);
          }}
        />
      )}
    </Dialog>

    <ConfirmDialog
      open={labelWarnOpen}
      onClose={() => setLabelWarnOpen(false)}
      title="Texto largo para la etiqueta"
      description="El contenido podría verse reducido o truncado al imprimir la etiqueta 50×25 mm."
      confirmLabel="Guardar de todos modos"
      cancelLabel="Volver a editar"
      pending={pending}
      onConfirm={() => {
        setLabelWarnOpen(false);
        void performSave();
      }}
    >
      <p className="whitespace-pre-line text-sm text-muted-foreground">{labelWarnText}</p>
    </ConfirmDialog>

    <FotoPreviewDialog
      open={fotoPreviewOpen}
      onClose={() => setFotoPreviewOpen(false)}
      file={fotoFile}
      path={!fotoFile ? activo?.foto_path : null}
      titulo={nombreConsolidado || "Foto del activo"}
    />

    <ComprobanteSerieDialog
      open={serieDialogOpen}
      file={pendingComprobanteFile ?? comprobanteFile}
      path={
        !pendingComprobanteFile && !comprobanteFile
          ? (activo?.comprobante_path ?? null)
          : null
      }
      fileName={
        pendingComprobanteFile?.name ??
        comprobanteFile?.name ??
        (comprobanteSerie.trim() || undefined)
      }
      initialSerie={comprobanteSerie}
      initialFecha={fechaAdquisicion}
      initialMonto={valor}
      confirmLabel={pendingComprobanteFile ? "Confirmar" : "Guardar"}
      loadPathUrl={(p) => getSignedStorageUrl("comprobantes-activos", p)}
      onConfirm={confirmComprobanteSerie}
      onCancel={cancelComprobanteSerie}
    />
    </>
  );
}
