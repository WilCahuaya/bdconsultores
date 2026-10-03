export type RepresentanteLegal = {
  nombre: string | null;
  dni: string | null;
  cargo: string | null;
};

export function representanteDesdeEntidad(entidad: {
  representante_legal_nombre?: string | null;
  representante_legal_dni?: string | null;
  representante_legal_cargo?: string | null;
} | null): RepresentanteLegal {
  return {
    nombre: entidad?.representante_legal_nombre?.trim() || null,
    dni: entidad?.representante_legal_dni?.trim() || null,
    cargo: entidad?.representante_legal_cargo?.trim() || null,
  };
}

export function representanteLegalDelDocumento(
  guardado: RepresentanteLegal & { guardado: boolean },
  vigente: RepresentanteLegal,
): RepresentanteLegal {
  return guardado.guardado ? guardado : vigente;
}

export function textoRepresentanteLegal(rl: RepresentanteLegal): string | null {
  const partes = [rl.nombre, rl.dni ? `DNI ${rl.dni}` : null, rl.cargo].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}
