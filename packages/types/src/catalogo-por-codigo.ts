/**
 * El bien guarda `codigo_catalogo` como texto. Grupo, clase y cuenta se
 * consultan aparte cuando el código sigue existiendo en el catálogo.
 */
export async function attachCatalogoNacionalPorCodigo(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => PromiseLike<{
          data: Array<{
            codigo: string;
            cuenta_codigo: string | null;
            contabilidad: string | null;
            grupo: string | null;
            clase: string | null;
          }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  },
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

  const byCodigo = new Map<
    string,
    {
      cuenta_codigo: string | null;
      contabilidad: string | null;
      grupo: string | null;
      clase: string | null;
    }
  >();

  const chunkSize = 150;
  for (let i = 0; i < codigos.length; i += chunkSize) {
    const slice = codigos.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("catalogo_nacional")
      .select("codigo, cuenta_codigo, contabilidad, grupo, clase")
      .in("codigo", slice);
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
