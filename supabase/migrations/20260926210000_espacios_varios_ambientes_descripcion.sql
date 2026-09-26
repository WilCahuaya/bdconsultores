-- Un espacio puede ser ocupado por varios ambientes activos.
-- Cada espacio guarda una descripción (obligatoria en la aplicación al crear o editar).

ALTER TABLE public.espacios
  ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS public.idx_ambientes_espacio_unico;

COMMENT ON COLUMN public.espacios.descripcion IS
  'Descripción del local físico. La aplicación la exige al crear o editar el espacio.';
