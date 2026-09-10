export function extraerDniDeTexto(text: string): string | null {
  const near = text.match(/dni[^0-9]{0,16}(\d{8})/i) ?? text.match(/cui[^0-9]{0,16}(\d{8})/i);
  if (near?.[1]) return near[1];
  const all = [...text.matchAll(/\b(\d{8})\b/g)].map((m) => m[1]);
  const noFecha = all.filter((n) => {
    const dia = Number(n.slice(0, 2));
    const mes = Number(n.slice(2, 4));
    return !(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12);
  });
  return noFecha[0] ?? all[0] ?? null;
}

export function extraerCorreoDeTexto(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

export function extraerCelularDeTexto(text: string): string | null {
  const match = text.match(/\b9\d{8}\b/);
  return match?.[0] ?? null;
}

export function extraerTipoPensionDeTexto(text: string): "AFP" | "ONP" | null {
  const onp = /\bONP\b/.test(text);
  const afp = /\bAFP\b/.test(text);
  if (onp && !afp) return "ONP";
  if (afp && !onp) return "AFP";
  if (onp && afp) return "AFP";
  return null;
}

export function extraerAsignacionFamiliarDeTexto(text: string): boolean | null {
  const bloque = text.match(/asignaci[oó]n\s+familiar[\s\S]{0,80}/i)?.[0] ?? text;
  if (/\bno\s+recibe\b/i.test(bloque) || /\basignaci[oó]n\s+familiar[^.]{0,40}\bno\b/i.test(text)) {
    return false;
  }
  if (/\brecibe\b/i.test(bloque) && /\bs[ií]\b/i.test(bloque)) return true;
  if (/\basignaci[oó]n\s+familiar[^.]{0,40}\bs[ií]\b/i.test(text)) return true;
  return null;
}

export function extraerDireccionDeTexto(text: string): string | null {
  const line = text.match(/(?:direcci[oó]n|domicilio)\s*[:.\-]?\s*([^\n]{8,120})/i);
  const value = line?.[1]?.trim().replace(/\s+/g, " ");
  return value || null;
}
