type CatalogoLookupRow = {
  codigo: string;
  cuenta_codigo: string | null;
  contabilidad: string | null;
  grupo: string | null;
  clase: string | null;
};

/**
 * El bien guarda `codigo_catalogo` como texto. Grupo, clase y cuenta se
 * consultan aparte cuando el código sigue existiendo en el catálogo.
 *
 * El cliente va como `any`: contrastarlo con el cliente de Supabase hace que
 * TypeScript entre en una instanciación infinita durante el build.
 */
export async function attachCatalogoNacionalPorCodigo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Record<string, unknown>[] | null,
): Promise<Record<string, unknown>[] | null> {
  if (!rows?.length) return rows;

  const codigos = [
    ...new Set(
      rows
        .map((row) => String(row.codigo_catalogo ?? "").trim())
        .filter((codigo) => codigo.length > 0),
    ),
  ];
  if (codigos.length === 0) return rows;

  const byCodigo = new Map<string, Omit<CatalogoLookupRow, "codigo">>();

  const chunkSize = 150;
  for (let i = 0; i < codigos.length; i += chunkSize) {
    const slice = codigos.slice(i, i + chunkSize);
    const { data, error } = (await supabase
      .from("catalogo_nacional")
      .select("codigo, cuenta_codigo, contabilidad, grupo, clase")
      .in("codigo", slice)) as {
      data: CatalogoLookupRow[] | null;
      error: { message: string } | null;
    };
    if (error || !data) continue;
    for (const item of data) {
      byCodigo.set(String(item.codigo).trim(), {
        cuenta_codigo: item.cuenta_codigo,
        contabilidad: item.contabilidad,
        grupo: item.grupo,
        clase: item.clase,
      });
    }
  }

  return rows.map((row) => {
    const codigo = String(row.codigo_catalogo ?? "").trim();
    return {
      ...row,
      catalogo_nacional: byCodigo.get(codigo) ?? null,
    };
  });
}
