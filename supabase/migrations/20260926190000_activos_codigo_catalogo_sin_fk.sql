-- El bien guarda el código de catálogo como dato propio.
-- Ya no apunta a catalogo_nacional, así el catálogo se puede reemplazar
-- sin modificar ni bloquear los bienes existentes.

ALTER TABLE public.activos
  DROP CONSTRAINT IF EXISTS activos_codigo_catalogo_fkey;

COMMENT ON COLUMN public.activos.codigo_catalogo IS
  'Código de catálogo copiado al bien (8 dígitos o BD######). No referencia catalogo_nacional.';
