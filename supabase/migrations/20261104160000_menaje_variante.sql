-- Menaje: la fila se distingue por material, medida, color y características.
-- Estado y observación no forman parte de la variante.

ALTER TABLE public.activos
  ADD COLUMN IF NOT EXISTS material TEXT;

COMMENT ON COLUMN public.activos.material IS
  'Material del menaje (acero, loza, melamina). En activos y cuenta de orden queda vacío.';

DROP INDEX IF EXISTS public.activos_menaje_ambiente_unique;
DROP INDEX IF EXISTS public.activos_menaje_posible_ambiente_unique;

CREATE UNIQUE INDEX activos_menaje_ambiente_unique
  ON public.activos (
    entidad_id,
    ambiente_id,
    codigo_catalogo,
    coalesce(lower(btrim(material)), ''),
    coalesce(lower(btrim(color)), ''),
    coalesce(lower(btrim(medidas)), ''),
    coalesce(lower(btrim(caracteristicas)), '')
  )
  WHERE categoria = 'MENAJE'
    AND estado_registro = 'REGISTRADO'
    AND ambiente_id IS NOT NULL;

CREATE UNIQUE INDEX activos_menaje_posible_ambiente_unique
  ON public.activos (
    entidad_id,
    posible_ambiente_id,
    codigo_catalogo,
    coalesce(lower(btrim(material)), ''),
    coalesce(lower(btrim(color)), ''),
    coalesce(lower(btrim(medidas)), ''),
    coalesce(lower(btrim(caracteristicas)), '')
  )
  WHERE categoria = 'MENAJE'
    AND estado_registro = 'PREREGISTRADO'
    AND posible_ambiente_id IS NOT NULL;
