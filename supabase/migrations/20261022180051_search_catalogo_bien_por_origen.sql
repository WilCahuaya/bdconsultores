-- Búsqueda del alta de bienes: una sola consulta.
-- BD… solo origen PROPIO, código numérico solo NACIONAL, texto ambos.
-- El prefijo de código y la denominación van en ramas separadas para poder usar
-- la clave de codigo y el índice trigram de denominacion.

CREATE OR REPLACE FUNCTION public.search_catalogo_bien(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF public.catalogo_nacional
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT := trim(p_query);
  v_up TEXT := upper(v_raw);
  v_origen TEXT;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN;
  END IF;

  IF v_up ~ '^BD' THEN
    v_origen := 'PROPIO';
  ELSIF v_raw ~ '^[0-9]+$' THEN
    v_origen := 'NACIONAL';
  ELSE
    v_origen := NULL;
  END IF;

  RETURN QUERY
  WITH hits AS (
    SELECT
      c.codigo,
      CASE WHEN upper(btrim(c.codigo::text)) = v_up THEN 0 ELSE 1 END AS rank_exact,
      0 AS rank_prefix,
      length(c.denominacion) AS denom_len
    FROM public.catalogo_nacional c
    WHERE (v_origen IS NULL OR c.origen = v_origen)
      AND upper(btrim(c.codigo::text)) LIKE (v_up || '%')

    UNION ALL

    SELECT
      c.codigo,
      1,
      1,
      length(c.denominacion)
    FROM public.catalogo_nacional c
    WHERE (v_origen IS NULL OR c.origen = v_origen)
      AND c.denominacion ILIKE ('%' || v_raw || '%')
      AND upper(btrim(c.codigo::text)) NOT LIKE (v_up || '%')
  )
  SELECT c.*
  FROM public.catalogo_nacional c
  JOIN (
    SELECT
      h.codigo,
      min(h.rank_exact) AS rank_exact,
      min(h.rank_prefix) AS rank_prefix,
      min(h.denom_len) AS denom_len
    FROM hits h
    GROUP BY h.codigo
  ) r ON r.codigo = c.codigo
  ORDER BY r.rank_exact, r.rank_prefix, r.denom_len, c.denominacion
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_catalogo_bien(TEXT, INTEGER) TO authenticated;
