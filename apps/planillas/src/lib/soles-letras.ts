const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];
const VEINTI: Record<number, string> = {
  1: "veintiuno",
  2: "veintidós",
  3: "veintitrés",
  4: "veinticuatro",
  5: "veinticinco",
  6: "veintiséis",
  7: "veintisiete",
  8: "veintiocho",
  9: "veintinueve",
};

function decena(n: number): string {
  if (n < 10) return UNIDADES[n] ?? "";
  if (n < 20) return DIEZ[n - 10] ?? "";
  if (n < 30) return n === 20 ? "veinte" : (VEINTI[n - 20] ?? `veinti${UNIDADES[n - 20]}`);
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? (DECENAS[d] ?? "") : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function centena(n: number): string {
  if (n < 100) return decena(n);
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cabeza = CENTENAS[c] ?? "";
  return r === 0 ? (c === 1 ? "cien" : cabeza) : `${cabeza} ${decena(r)}`;
}

export function enteroEnLetras(n: number): string {
  const entero = Math.trunc(Math.abs(n));
  if (entero === 0) return "cero";
  if (entero < 1000) return centena(entero);
  const miles = Math.floor(entero / 1000);
  const resto = entero % 1000;
  const prefijo = miles === 1 ? "mil" : `${centena(miles)} mil`;
  return resto === 0 ? prefijo : `${prefijo} ${centena(resto)}`;
}

export function solesEnLetras(monto: number): string {
  const seguro = Number.isFinite(monto) ? Math.round(monto * 100) / 100 : 0;
  const entero = Math.trunc(seguro);
  const centavos = Math.round(Math.abs(seguro - entero) * 100);
  const letras = enteroEnLetras(entero);
  const capitalizado = letras.charAt(0).toUpperCase() + letras.slice(1);
  return `${capitalizado} con ${String(centavos).padStart(2, "0")}/100 soles`;
}
