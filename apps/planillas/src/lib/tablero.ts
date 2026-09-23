import {
  diaDelMesLima,
  diaInicioVentanaMesSiguiente,
  esMesAsistencia,
  fechaEnMes,
  hoyIsoLima,
  timestampEnMesLima,
  ultimoDiaDelMes,
} from "@/lib/horario-asistencia";

export const TABLERO_MARCAS = ["drt", "sunafil_1", "sunafil_16", "planillas"] as const;
export type TableroMarcaClave = (typeof TABLERO_MARCAS)[number];

export type TableroColor = "gris" | "ambar" | "rojo" | "verde";

export type TableroCelda = {
  color: TableroColor;
  texto: string;
  titulo: string;
  href?: string;
  marca?: { clave: TableroMarcaClave; hecho: boolean; label: string };
  marcas?: { clave: TableroMarcaClave; hecho: boolean; label: string }[];
};

export type TableroColumnaId =
  | "venceContrato"
  | "generacion"
  | "drt"
  | "asistencia"
  | "venceVidaLey"
  | "sunafil"
  | "tRegistro"
  | "afp"
  | "vidaLeyTramite"
  | "beneficiario"
  | "planillas";

export const TABLERO_COLUMNAS: { id: TableroColumnaId; etiqueta: string; corto: string }[] = [
  { id: "venceContrato", etiqueta: "Contratos por vencer en el mes", corto: "Vence contrato" },
  { id: "generacion", etiqueta: "Contratos generados en el mes (ámbar hasta firmar)", corto: "Generados" },
  { id: "drt", etiqueta: "Presentación a la Dirección de trabajo (28–30 si se generó contrato)", corto: "DRT" },
  { id: "asistencia", etiqueta: "Excel de asistencia generados en el mes", corto: "Asistencia" },
  { id: "venceVidaLey", etiqueta: "Seguros Vida Ley por vencer en el mes", corto: "Vence Vida Ley" },
  { id: "sunafil", etiqueta: "Buzón Sunafil (días 1 y 16)", corto: "Sunafil" },
  { id: "tRegistro", etiqueta: "Generación T-Registro (si se generó contrato)", corto: "T-Registro" },
  { id: "afp", etiqueta: "Trámite AFP (si no es ONP y se generó contrato)", corto: "AFP" },
  { id: "vidaLeyTramite", etiqueta: "Trámite / registro Vida Ley (si hay contrato firmado nuevo)", corto: "Reg. Vida Ley" },
  { id: "beneficiario", etiqueta: "Declaración de beneficiario (AFP y T-Registro si se subió firmado)", corto: "Beneficiario" },
  { id: "planillas", etiqueta: "Elaboración de planillas (día 18)", corto: "Planillas" },
];

export type TableroCalendario = {
  mes: string;
  dia: number;
  ultimoDia: number;
  ventanaDrt: boolean;
  ultimoDiaMes: boolean;
  ventanaPlanillas: boolean;
  sunafil1: boolean;
  sunafil16: boolean;
};

export function calendarioTablero(mes: string, hoyIso = hoyIsoLima()): TableroCalendario {
  const mesHoy = hoyIso.slice(0, 7);
  const delMes = mesHoy === mes;
  const pasado = mes < mesHoy;
  const dia = delMes ? diaDelMesLima(hoyIso) : pasado ? 99 : 0;
  const ultimoDia = ultimoDiaDelMes(mes);
  const inicioDrt = diaInicioVentanaMesSiguiente(ultimoDia);
  return {
    mes,
    dia,
    ultimoDia,
    ventanaDrt: dia >= inicioDrt,
    ultimoDiaMes: delMes ? diaDelMesLima(hoyIso) === ultimoDia : pasado,
    ventanaPlanillas: dia >= 18,
    sunafil1: dia >= 1,
    sunafil16: dia >= 16,
  };
}

export function contratoFueGenerado(estado: string | null | undefined): boolean {
  return Boolean(estado) && estado !== "PENDIENTE_DOCS" && estado !== "BAJA";
}

function celdaVacia(titulo: string, texto = "—"): TableroCelda {
  return { color: "gris", texto, titulo };
}

function celdaConteoVence(cantidad: number, titulo: string): TableroCelda {
  return {
    color: cantidad > 0 ? "rojo" : "verde",
    texto: String(cantidad),
    titulo,
  };
}

function celdaProgreso(opts: {
  aplica: boolean;
  total: number;
  listos: number;
  vencido: boolean;
  titulo: string;
  href?: string;
  vacio?: string;
}): TableroCelda {
  if (!opts.aplica || opts.total === 0) {
    return celdaVacia(opts.titulo, opts.vacio ?? "—");
  }
  const pendientes = opts.total - opts.listos;
  const texto = `${opts.listos}/${opts.total}`;
  if (pendientes === 0) {
    return { color: "verde", texto, titulo: opts.titulo, href: opts.href };
  }
  return {
    color: opts.vencido ? "rojo" : "ambar",
    texto,
    titulo: opts.titulo,
    href: opts.href,
  };
}

function celdaMarca(opts: {
  aplica: boolean;
  ventana: boolean;
  hecho: boolean;
  clave: TableroMarcaClave;
  titulo: string;
  label: string;
}): TableroCelda {
  if (!opts.aplica) return celdaVacia(opts.titulo);
  const texto = opts.hecho ? "Sí" : "No";
  const marca = { clave: opts.clave, hecho: opts.hecho, label: opts.label };
  if (opts.hecho) {
    return { color: "verde", texto, titulo: opts.titulo, marca };
  }
  if (!opts.ventana) {
    return { color: "gris", texto: "—", titulo: opts.titulo, marca };
  }
  return { color: "ambar", texto, titulo: opts.titulo, marca };
}

export type TableroTrabajadorInput = {
  id: string;
  fechaIngreso: string | null;
  fechaCese: string | null;
  estado: string;
  pensionTipo: string | null;
  tRegistroOk: boolean;
  afpDocOk: boolean;
  vidaLeyComprobanteOk: boolean;
  excelGenerado: boolean;
  vidaLeyFechaFin: string | null;
  contratos: {
    estado: string | null;
    fechaFin: string | null;
    createdAt: string | null;
    firmado: boolean;
    docUpdatedAt: string | null;
    esVigente: boolean;
  }[];
};

export type TableroEntidadInput = {
  id: string;
  trabajadores: TableroTrabajadorInput[];
  marcas: Partial<Record<TableroMarcaClave, boolean>>;
};

export type TableroCeldas = Record<TableroColumnaId, TableroCelda>;

export function celdasTableroEntidad(
  input: TableroEntidadInput,
  cal: TableroCalendario,
  hrefs: { contratos: string; asistencias: string; vidaLey: string; alta: string },
  activoEnMes: (t: TableroTrabajadorInput) => boolean,
): TableroCeldas {
  const mes = cal.mes;
  const trabajadores = input.trabajadores;
  const activos = trabajadores.filter(activoEnMes);

  let venceContrato = 0;
  let venceVidaLey = 0;
  let generados = 0;
  let generadosFirmados = 0;
  const idsGenerados = new Set<string>();
  const idsFirmadosMes = new Set<string>();

  for (const t of trabajadores) {
    if (fechaEnMes(t.vidaLeyFechaFin, mes) && t.estado === "ACTIVA") venceVidaLey += 1;
    for (const c of t.contratos) {
      if (c.estado === "BAJA") continue;
      if (t.estado === "ACTIVA" && c.esVigente && fechaEnMes(c.fechaFin, mes)) venceContrato += 1;
      const generadoMes = contratoFueGenerado(c.estado) && timestampEnMesLima(c.createdAt, mes);
      const firmadoMes =
        c.firmado && (generadoMes || timestampEnMesLima(c.docUpdatedAt, mes));
      if (generadoMes) {
        generados += 1;
        idsGenerados.add(t.id);
        if (c.firmado) generadosFirmados += 1;
      }
      if (firmadoMes) idsFirmadosMes.add(t.id);
    }
  }

  const conGenerado = trabajadores.filter((t) => idsGenerados.has(t.id));
  const conFirmadoMes = trabajadores.filter((t) => idsFirmadosMes.has(t.id));
  const afpGenerados = conGenerado.filter((t) => t.pensionTipo === "AFP");
  const tRegListos = conGenerado.filter((t) => t.tRegistroOk).length;
  const afpListos = afpGenerados.filter((t) => t.afpDocOk).length;
  const vidaLeyListos = conFirmadoMes.filter((t) => t.vidaLeyComprobanteOk).length;
  const beneficiarioListos = conFirmadoMes.filter((t) => {
    const tr = t.tRegistroOk;
    if (t.pensionTipo === "ONP") return tr;
    if (t.pensionTipo === "AFP") return tr && t.afpDocOk;
    return tr;
  }).length;

  const excelListos = activos.filter((t) => t.excelGenerado).length;
  const hayGenerados = generados > 0;
  const hayFirmados = idsFirmadosMes.size > 0;

  const generacion: TableroCelda = !hayGenerados
    ? celdaVacia("Sin contratos generados este mes")
    : {
        color: generadosFirmados === generados ? "verde" : "ambar",
        texto: generadosFirmados === generados ? String(generados) : `${generadosFirmados}/${generados}`,
        titulo: "Generados este mes. Verde cuando todos tienen PDF firmado.",
        href: hrefs.contratos,
      };

  const sunafil1 = input.marcas.sunafil_1 === true;
  const sunafil16 = input.marcas.sunafil_16 === true;
  const sunafilPendiente1 = !sunafil1;
  const sunafilPendiente16 = cal.sunafil16 && !sunafil16;
  let colorSunafil: TableroColor = "gris";
  if (!sunafilPendiente1 && !sunafilPendiente16) colorSunafil = "verde";
  else if ((sunafilPendiente1 && cal.dia > 1) || (sunafilPendiente16 && cal.dia > 16)) colorSunafil = "rojo";
  else if (cal.sunafil1) colorSunafil = "ambar";
  const sunafil: TableroCelda = {
    color: colorSunafil,
    texto: `${sunafil1 ? "Sí" : "No"} / ${cal.sunafil16 || sunafil16 ? (sunafil16 ? "Sí" : "No") : "—"}`,
    titulo: "Revisión del buzón Sunafil el 1 y el 16.",
    marcas: [
      { clave: "sunafil_1", hecho: sunafil1, label: "Día 1" },
      { clave: "sunafil_16", hecho: sunafil16, label: "Día 16" },
    ],
  };

  const planillasHecho = input.marcas.planillas === true;
  const planillas: TableroCelda = celdaMarca({
    aplica: true,
    ventana: cal.ventanaPlanillas,
    hecho: planillasHecho,
    clave: "planillas",
    titulo: "Elaboración de planillas el día 18.",
    label: "Hecho",
  });
  if (cal.ventanaPlanillas && !planillasHecho && cal.dia > 18) planillas.color = "rojo";

  const drtHecho = input.marcas.drt === true;
  const drt = celdaMarca({
    aplica: hayGenerados,
    ventana: cal.ventanaDrt,
    hecho: drtHecho,
    clave: "drt",
    titulo: "Marcar si se llevó el contrato a la Dirección de trabajo.",
    label: "Llevado",
  });
  if (hayGenerados && cal.ventanaDrt && !drtHecho && cal.dia === cal.ultimoDia) drt.color = "rojo";

  return {
    venceContrato: {
      ...celdaConteoVence(venceContrato, "Contratos con fecha de fin en este mes."),
      href: hrefs.contratos,
    },
    generacion,
    drt,
    asistencia: celdaProgreso({
      aplica: activos.length > 0,
      total: activos.length,
      listos: excelListos,
      vencido: cal.ventanaDrt,
      titulo: "Excel de asistencia generados / trabajadores activos del mes.",
      href: hrefs.asistencias,
    }),
    venceVidaLey: {
      ...celdaConteoVence(venceVidaLey, "Pólizas Vida Ley con fin en este mes."),
      href: hrefs.vidaLey,
    },
    sunafil,
    tRegistro: celdaProgreso({
      aplica: hayGenerados,
      total: conGenerado.length,
      listos: tRegListos,
      vencido: cal.ultimoDiaMes,
      titulo: "Alta T-Registro de quienes tuvieron contrato generado este mes.",
      href: hrefs.alta,
    }),
    afp: celdaProgreso({
      aplica: afpGenerados.length > 0,
      total: afpGenerados.length,
      listos: afpListos,
      vencido: cal.ultimoDiaMes,
      titulo: "Documento de trámite AFP. ONP no cuenta.",
      href: hrefs.alta,
      vacio: hayGenerados ? "ONP" : "—",
    }),
    vidaLeyTramite: celdaProgreso({
      aplica: hayFirmados,
      total: conFirmadoMes.length,
      listos: vidaLeyListos,
      vencido: cal.ultimoDiaMes,
      titulo: "Comprobante de envío Vida Ley si hay contrato firmado nuevo.",
      href: hrefs.vidaLey,
    }),
    beneficiario: celdaProgreso({
      aplica: hayFirmados,
      total: conFirmadoMes.length,
      listos: beneficiarioListos,
      vencido: cal.ultimoDiaMes,
      titulo: "Documento AFP (si aplica) y T-Registro registrado.",
      href: hrefs.alta,
    }),
    planillas,
  };
}

export function esMarcaTablero(value: string): value is TableroMarcaClave {
  return (TABLERO_MARCAS as readonly string[]).includes(value);
}

export function esMesTablero(value: string): boolean {
  return esMesAsistencia(value);
}
