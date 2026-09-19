-- Número interno manual de cada entidad (archivo del estudio): 7, 11.1, etc.

ALTER TABLE public.entidades
  ADD COLUMN IF NOT EXISTS numero_interno TEXT;

ALTER TABLE public.entidades
  DROP CONSTRAINT IF EXISTS entidades_numero_interno_formato_check;

ALTER TABLE public.entidades
  ADD CONSTRAINT entidades_numero_interno_formato_check
  CHECK (
    numero_interno IS NULL
    OR numero_interno ~ '^[0-9]+(\.[0-9]+)*$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS entidades_numero_interno_unique
  ON public.entidades (numero_interno)
  WHERE numero_interno IS NOT NULL;

COMMENT ON COLUMN public.entidades.numero_interno IS
  'Enumeración manual del estudio (ej. 7, 11.1). Única; no es correlativo automático.';
