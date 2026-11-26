export interface RutaCompra {
  entidadId: string;
  periodo: string;
  tipo: string;
  serie: string;
  numero: string;
}

export function rutaXml(compra: RutaCompra): string {
  const serie = compra.serie.replace(/[^\w.-]+/g, "_") || "SIN-SERIE";
  const numero = compra.numero.replace(/[^\w.-]+/g, "_");
  return `${compra.entidadId}/${compra.periodo}/xml/${compra.tipo}-${serie}-${numero}.xml`;
}

export function rutaCdr(compra: RutaCompra): string {
  return rutaXml(compra).replace(/\.xml$/, ".cdr");
}
