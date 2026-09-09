-- Módulos por entidad: no todas usan Inventarios ni Planillas.
-- Las existentes quedan con ambos activos.

ALTER TABLE public.entidades
  ADD COLUMN IF NOT EXISTS usa_inventarios BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS usa_planillas BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.entidades
  DROP CONSTRAINT IF EXISTS entidades_al_menos_un_modulo;

ALTER TABLE public.entidades
  ADD CONSTRAINT entidades_al_menos_un_modulo
  CHECK (usa_inventarios OR usa_planillas);
