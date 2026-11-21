-- Catálogo de menajes del estudio (origen MENAJE, códigos MJ######).
-- Los bienes ya categorizados como MENAJE pasan a un ítem MJ por denominación.

ALTER TABLE public.catalogo_nacional
  DROP CONSTRAINT IF EXISTS catalogo_nacional_origen_check;

ALTER TABLE public.catalogo_nacional
  ADD CONSTRAINT catalogo_nacional_origen_check
  CHECK (origen IN ('NACIONAL', 'PROPIO', 'MENAJE'));

COMMENT ON COLUMN public.catalogo_nacional.origen IS
  'NACIONAL = catálogo oficial SBN; PROPIO = cuenta de orden; MENAJE = catálogo de menajes del estudio';

DROP POLICY IF EXISTS catalogo_insert_contador ON public.catalogo_nacional;
CREATE POLICY catalogo_insert_contador ON public.catalogo_nacional
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_contador()
    AND origen IN ('PROPIO', 'NACIONAL', 'MENAJE')
  );

DROP POLICY IF EXISTS catalogo_update_propio ON public.catalogo_nacional;
CREATE POLICY catalogo_update_propio ON public.catalogo_nacional
  FOR UPDATE TO authenticated
  USING (public.is_contador() AND origen IN ('PROPIO', 'MENAJE'))
  WITH CHECK (public.is_contador() AND origen IN ('PROPIO', 'MENAJE'));

DROP POLICY IF EXISTS catalogo_delete_propio ON public.catalogo_nacional;
CREATE POLICY catalogo_delete_propio ON public.catalogo_nacional
  FOR DELETE TO authenticated
  USING (public.is_contador() AND origen IN ('PROPIO', 'MENAJE'));

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

  IF v_up ~ '^MJ' THEN
    v_origen := 'MENAJE';
  ELSIF v_up ~ '^BD' THEN
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
    WHERE (
        (v_origen IS NULL AND c.origen IS DISTINCT FROM 'MENAJE')
        OR c.origen = v_origen
      )
      AND upper(btrim(c.codigo::text)) LIKE (v_up || '%')

    UNION ALL

    SELECT
      c.codigo,
      1,
      1,
      length(c.denominacion)
    FROM public.catalogo_nacional c
    WHERE (
        (v_origen IS NULL AND c.origen IS DISTINCT FROM 'MENAJE')
        OR c.origen = v_origen
      )
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

WITH nombres AS (
  SELECT DISTINCT upper(trim(regexp_replace(
    coalesce(nullif(trim(c.denominacion), ''), nullif(trim(a.nombre), '')),
    '\s+', ' ', 'g'
  ))) AS denominacion
  FROM public.activos a
  LEFT JOIN public.catalogo_nacional c
    ON btrim(c.codigo::text) = btrim(a.codigo_catalogo)
  WHERE a.categoria = 'MENAJE'
),
faltantes AS (
  SELECT n.denominacion
  FROM nombres n
  WHERE n.denominacion <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalogo_nacional c
      WHERE c.origen = 'MENAJE'
        AND upper(trim(c.denominacion)) = n.denominacion
    )
),
numerados AS (
  SELECT
    f.denominacion,
    (
      SELECT COALESCE(MAX(substring(btrim(codigo::text) FROM 3)::int), 0)
      FROM public.catalogo_nacional
      WHERE origen = 'MENAJE'
        AND btrim(codigo::text) ~ '^MJ[0-9]{6}$'
    ) + row_number() OVER (ORDER BY f.denominacion) AS n
  FROM faltantes f
)
INSERT INTO public.catalogo_nacional (codigo, denominacion, origen, estado)
SELECT 'MJ' || lpad(n::text, 6, '0'), denominacion, 'MENAJE', 'ACTIVO'
FROM numerados;

-- El historial exige auth.uid(); esta reasignación corre sin sesión de usuario.
ALTER TABLE public.activos DISABLE TRIGGER activos_historial;

UPDATE public.activos a
SET codigo_catalogo = mj.codigo
FROM public.catalogo_nacional actual
JOIN public.catalogo_nacional mj
  ON mj.origen = 'MENAJE'
 AND upper(trim(mj.denominacion)) = upper(trim(actual.denominacion))
WHERE a.categoria = 'MENAJE'
  AND btrim(actual.codigo::text) = btrim(a.codigo_catalogo)
  AND actual.origen IS DISTINCT FROM 'MENAJE';

ALTER TABLE public.activos ENABLE TRIGGER activos_historial;
