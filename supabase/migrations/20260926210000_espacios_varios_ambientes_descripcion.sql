-- Un espacio puede ser ocupado por varios ambientes activos.
-- Cada espacio puede guardar una descripción opcional.

ALTER TABLE public.espacios
  ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS public.idx_ambientes_espacio_unico;

COMMENT ON COLUMN public.espacios.descripcion IS
  'Descripción opcional del local físico.';
