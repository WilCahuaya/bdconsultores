export interface LineaComprobante {
  cantidad: string;
  unidad: string;
  descripcion: string;
  valorUnitario: string;
  descuento: string;
  importe: string;
}

export interface ComprobanteUbl {
  serieNumero: string;
  fecha: string;
  moneda: string;
  emisorNombre: string;
  emisorRuc: string;
  emisorDireccion: string;
  clienteNombre: string;
  clienteRuc: string;
  clienteDireccion: string;
  observacion: string;
  lineas: LineaComprobante[];
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
  const antesDeLineas = source.split(/<(?:[\w.-]+:)?(?:Invoice|CreditNote|DebitNote)Line\b/i)[0] ?? source;
  const impuesto = bloque(antesDeLineas, "TaxTotal");
  const lineas = [
    ...bloques(source, "InvoiceLine"),
    ...bloques(source, "CreditNoteLine"),
    ...bloques(source, "DebitNoteLine"),
  ].map(lineaDe);

  return {
    serieNumero: texto(cabeza, "ID"),
    fecha: texto(cabeza, "IssueDate"),
    moneda: texto(cabeza, "DocumentCurrencyCode") || "PEN",
    emisorNombre: texto(emisor, "RegistrationName") || texto(emisor, "Name"),
    emisorRuc: documento(emisor),
    emisorDireccion: direccion(emisor),
    clienteNombre: texto(cliente, "RegistrationName") || texto(cliente, "Name"),
    clienteRuc: documento(cliente),
    clienteDireccion: direccion(cliente),
    observacion: notas(cabeza).find((nota) => !/^son\b/i.test(nota)) ?? "",
    lineas: lineas.filter((linea) => linea.descripcion || linea.importe),
    gravado: texto(monetario, "LineExtensionAmount") || null,
    igv: texto(impuesto, "TaxAmount") || null,
    total: texto(monetario, "PayableAmount") || texto(monetario, "TaxInclusiveAmount") || null,
    esResumen,
  };
}

function lineaDe(xml: string): LineaComprobante {
  const item = bloque(xml, "Item");
  const precio = bloque(xml, "Price");
  return {
    cantidad: texto(xml, "InvoicedQuantity") || texto(xml, "CreditedQuantity") || texto(xml, "DebitedQuantity"),
    unidad: atributo(xml, "InvoicedQuantity", "unitCode") || atributo(xml, "CreditedQuantity", "unitCode"),
    descripcion: texto(item, "Description"),
    valorUnitario: texto(precio, "PriceAmount"),
    descuento: descuentoDe(xml),
    importe: texto(xml, "LineExtensionAmount"),
  };
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

function notas(xml: string): string[] {
  const re = /<(?:[\w.-]+:)?Note\b[^>]*>([^<]*)<\/(?:[\w.-]+:)?Note>/gi;
  return [...xml.matchAll(re)].map((match) => decodificar(match[1] ?? "").trim()).filter(Boolean);
}

function documento(party: string): string {
  const re = /<(?:[\w.-]+:)?ID\b([^>]*)>([^<]*)<\/(?:[\w.-]+:)?ID>/gi;
  let fallback = "";
  for (const match of party.matchAll(re)) {
    const valor = decodificar(match[2] ?? "").trim();
    if (/schemeID="6"/i.test(match[1] ?? "") && valor) return valor;
    if (!fallback && /^\d{8,11}$/.test(valor)) fallback = valor;
  }
  return fallback;
}

function direccion(party: string): string {
  const domicilio = bloque(party, "RegistrationAddress") || bloque(party, "PostalAddress");
  return [
    texto(domicilio, "Line"),
    texto(domicilio, "CitySubdivisionName"),
    texto(domicilio, "District"),
    texto(domicilio, "CityName"),
  ]
    .filter(Boolean)
    .join(" ");
}

function bloque(xml: string, local: string): string {
  return bloques(xml, local)[0] ?? "";
}

function bloques(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>[\\s\\S]*?</(?:[\\w.-]+:)?${local}>`, "gi");
  return xml.match(re) ?? [];
}

function texto(xml: string, local: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${local}>`, "i");
  return decodificar(re.exec(xml)?.[1] ?? "").trim();
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
