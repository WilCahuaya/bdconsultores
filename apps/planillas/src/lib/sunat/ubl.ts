export interface LineaComprobante {
  cantidad: string;
  unidad: string;
  codigo: string;
  descripcion: string;
  valorUnitario: string;
  descuento: string;
  importe: string;
  icbper: string;
}

export interface TotalesComprobante {
  descuentoAfecta: number;
  descuentoNoAfecta: number;
  gravado: number;
  inafecto: number;
  exonerado: number;
  gratuito: number;
  exportacion: number;
  descuentos: number;
  otrosTributos: number;
  otrosCargos: number;
  isc: number;
  igv: number;
  icbper: number;
  total: number;
}

export interface ComprobanteUbl {
  serieNumero: string;
  fecha: string;
  moneda: string;
  nombreComercial: string;
  emisorNombre: string;
  emisorRuc: string;
  emisorDireccion: string;
  emisorLugar: string;
  clienteNombre: string;
  clienteRuc: string;
  clienteDireccion: string;
  formaPago: string;
  observacion: string;
  lineas: LineaComprobante[];
  totales: TotalesComprobante;
  gravado: string | null;
  igv: string | null;
  total: string | null;
  esResumen: boolean;
}

export function parseUbl(xml: string): ComprobanteUbl | null {
  const source = xml.replace(/^\uFEFF/, "").trim();
  if (!source.includes("<")) return null;
  const esResumen = /<(?:[\w.-]+:)?SummaryDocuments\b/i.test(source);
  const cabeza = source.split(/<(?:[\w.-]+:)?AccountingSupplierParty\b/i)[0] ?? source;
  const emisor = bloque(source, "AccountingSupplierParty");
  const cliente = bloque(source, "AccountingCustomerParty");
  const monetario = bloque(source, "LegalMonetaryTotal");
  const sinLineas = fueraDeLineas(source);
  const domicilioEmisor = domicilio(emisor);
  const totales = totalesDe(sinLineas, monetario);
  const lineas = [
    ...bloques(source, "InvoiceLine"),
    ...bloques(source, "CreditNoteLine"),
    ...bloques(source, "DebitNoteLine"),
  ].map(lineaDe);

  return {
    serieNumero: texto(cabeza, "ID"),
    fecha: texto(cabeza, "IssueDate"),
    moneda: texto(cabeza, "DocumentCurrencyCode") || "PEN",
    nombreComercial: texto(bloque(emisor, "PartyName"), "Name"),
    emisorNombre: texto(emisor, "RegistrationName") || texto(bloque(emisor, "PartyName"), "Name"),
    emisorRuc: documento(emisor),
    emisorDireccion: domicilioEmisor.linea,
    emisorLugar: domicilioEmisor.lugar,
    clienteNombre: texto(cliente, "RegistrationName") || texto(bloque(cliente, "PartyName"), "Name"),
    clienteRuc: documento(cliente),
    clienteDireccion: domicilio(cliente).linea,
    formaPago: formaDePago(sinLineas),
    observacion: notas(cabeza).find((nota) => !/^son\b/i.test(nota) && !esNotaDeSistema(nota)) ?? "",
    lineas: lineas.filter((linea) => linea.descripcion || linea.importe || linea.cantidad),
    totales,
    gravado: texto(monetario, "LineExtensionAmount") || (totales.gravado ? totales.gravado.toFixed(2) : null),
    igv: totales.igv ? totales.igv.toFixed(2) : texto(bloque(sinLineas, "TaxTotal"), "TaxAmount") || null,
    total: texto(monetario, "PayableAmount") || texto(monetario, "TaxInclusiveAmount") || (totales.total ? totales.total.toFixed(2) : null),
    esResumen,
  };
}

function lineaDe(xml: string): LineaComprobante {
  const item = bloque(xml, "Item");
  const precio = bloque(xml, "Price");
  const descripcion = textos(item, "Description").join(" ") || texto(item, "Name");
  return {
    cantidad: texto(xml, "InvoicedQuantity") || texto(xml, "CreditedQuantity") || texto(xml, "DebitedQuantity"),
    unidad: atributo(xml, "InvoicedQuantity", "unitCode") || atributo(xml, "CreditedQuantity", "unitCode") || atributo(xml, "DebitedQuantity", "unitCode"),
    codigo: texto(bloque(item, "SellersItemIdentification"), "ID") || texto(bloque(item, "StandardItemIdentification"), "ID"),
    descripcion,
    valorUnitario: texto(precio, "PriceAmount"),
    descuento: descuentoDe(xml),
    importe: texto(xml, "LineExtensionAmount"),
    icbper: tributoDe(xml, "7152"),
  };
}

function tributoDe(xml: string, codigo: string): string {
  for (const sub of bloques(xml, "TaxSubtotal")) {
    if (texto(bloque(sub, "TaxScheme"), "ID") === codigo) return texto(sub, "TaxAmount") || "0";
  }
  return "0";
}

function formaDePago(xml: string): string {
  for (const terms of bloques(xml, "PaymentTerms")) {
    const id = texto(terms, "ID");
    const medio = texto(terms, "PaymentMeansID");
    if (medio && (!id || /forma/i.test(id))) return presentarPago(medio);
  }
  return "-";
}

function presentarPago(valor: string): string {
  if (/^contado$/i.test(valor)) return "Contado";
  if (/^cr[eé]dito$/i.test(valor)) return "Crédito";
  return valor;
}

function totalesDe(xml: string, monetario: string): TotalesComprobante {
  const totales = totalesVacios();
  let huboSubtotal = false;
  for (const tax of bloques(xml, "TaxTotal")) {
    for (const sub of bloques(tax, "TaxSubtotal")) {
      const scheme = texto(bloque(sub, "TaxScheme"), "ID");
      const base = numero(texto(sub, "TaxableAmount"));
      const monto = numero(texto(sub, "TaxAmount"));
      if (!scheme && !base && !monto) continue;
      huboSubtotal = true;
      if (scheme === "1000") {
        totales.gravado += base;
        totales.igv += monto;
      } else if (scheme === "1016") {
        totales.gravado += base;
        totales.igv += monto;
      } else if (scheme === "9995") totales.exportacion += base;
      else if (scheme === "9996") totales.gratuito += base;
      else if (scheme === "9997") totales.exonerado += base;
      else if (scheme === "9998") totales.inafecto += base;
      else if (scheme === "2000") totales.isc += monto;
      else if (scheme === "7152") totales.icbper += monto;
      else totales.otrosTributos += monto;
    }
  }
  for (const cargo of bloques(xml, "AllowanceCharge")) {
    const esCargo = texto(cargo, "ChargeIndicator").toLowerCase() === "true";
    const code = texto(cargo, "AllowanceChargeReasonCode");
    const monto = numero(texto(cargo, "Amount"));
    if (!monto) continue;
    if (esCargo) totales.otrosCargos += monto;
    else if (code === "03" || code === "01") totales.descuentoNoAfecta += monto;
    else totales.descuentoAfecta += monto;
  }
  const descuentos = numero(texto(monetario, "AllowanceTotalAmount"));
  totales.descuentos = descuentos || totales.descuentoAfecta + totales.descuentoNoAfecta;
  const cargos = numero(texto(monetario, "ChargeTotalAmount"));
  if (cargos && !totales.otrosCargos) totales.otrosCargos = cargos;
  if (!huboSubtotal) {
    totales.gravado = numero(texto(monetario, "LineExtensionAmount"));
    totales.igv = numero(texto(bloque(xml, "TaxTotal"), "TaxAmount"));
  }
  totales.total = numero(texto(monetario, "PayableAmount")) || numero(texto(monetario, "TaxInclusiveAmount"));
  return totales;
}

function totalesVacios(): TotalesComprobante {
  return {
    descuentoAfecta: 0,
    descuentoNoAfecta: 0,
    gravado: 0,
    inafecto: 0,
    exonerado: 0,
    gratuito: 0,
    exportacion: 0,
    descuentos: 0,
    otrosTributos: 0,
    otrosCargos: 0,
    isc: 0,
    igv: 0,
    icbper: 0,
    total: 0,
  };
}

function numero(valor: string): number {
  const amount = Number(valor);
  return Number.isFinite(amount) ? amount : 0;
}

function descuentoDe(xml: string): string {
  let total = 0;
  let hubo = false;
  for (const cargo of bloques(xml, "AllowanceCharge")) {
    if (texto(cargo, "ChargeIndicator").toLowerCase() === "true") continue;
    const monto = Number(texto(cargo, "Amount"));
    if (!Number.isFinite(monto)) continue;
    total += monto;
    hubo = true;
  }
  return hubo ? total.toFixed(2) : "0.00";
}

function esNotaDeSistema(nota: string): boolean {
  return /see-?sfs|facturador sunat|elaborado por sistema de emi/i.test(nota);
}

function notas(xml: string): string[] {
  const re = /<(?:[\w.-]+:)?Note\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Note>/gi;
  return [...xml.matchAll(re)].map((match) => limpiarTexto(match[1] ?? "")).filter(Boolean);
}

function documento(party: string): string {
  const re = /<(?:[\w.-]+:)?ID\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?ID>/gi;
  let fallback = "";
  for (const match of party.matchAll(re)) {
    const valor = limpiarTexto(match[2] ?? "");
    if (/schemeID="6"/i.test(match[1] ?? "") && valor) return valor;
    if (!fallback && /^\d{8,11}$/.test(valor)) fallback = valor;
  }
  return fallback;
}

function domicilio(party: string): { linea: string; lugar: string } {
  const dir = bloque(party, "RegistrationAddress") || bloque(party, "PostalAddress");
  const lugar = [texto(dir, "CountrySubentity"), texto(dir, "CityName"), texto(dir, "District")]
    .map((parte) => parte.replace(/\s+/g, " ").trim())
    .filter((parte) => parte && parte !== "-")
    .join("-")
    .toUpperCase();
  return { linea: texto(dir, "Line"), lugar };
}

function fueraDeLineas(xml: string): string {
  return xml.replace(/<(?:[\w.-]+:)?(?:Invoice|CreditNote|DebitNote)Line\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?(?:Invoice|CreditNote|DebitNote)Line>/gi, "");
}

function bloque(xml: string, local: string): string {
  return bloques(xml, local)[0] ?? "";
}

function bloques(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>[\\s\\S]*?</(?:[\\w.-]+:)?${local}>`, "gi");
  return xml.match(re) ?? [];
}

function texto(xml: string, local: string): string {
  return textos(xml, local)[0] ?? "";
}

function textos(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}>`, "gi");
  return [...xml.matchAll(re)].map((match) => limpiarTexto(match[1] ?? "")).filter(Boolean);
}

function limpiarTexto(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  const inner = (cdata?.[1] ?? raw).replace(/<[^>]+>/g, "");
  return decodificar(inner).replace(/\s+/g, " ").trim();
}

function atributo(xml: string, local: string, nombre: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b([^>]*)>`, "i");
  const attrs = re.exec(xml)?.[1] ?? "";
  return attrs.match(new RegExp(`\\b${nombre}="([^"]*)"`, "i"))?.[1] ?? "";
}

function decodificar(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
