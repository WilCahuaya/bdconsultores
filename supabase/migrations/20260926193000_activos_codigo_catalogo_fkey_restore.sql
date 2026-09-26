-- La app publicada aún consulta el catálogo con el enlace codigo_catalogo.
-- Sin esa clave foránea PostgREST no puede armar la relación y la página falla.
-- Todos los bienes actuales tienen un código presente en el catálogo nuevo.

ALTER TABLE public.activos
  DROP CONSTRAINT IF EXISTS activos_codigo_catalogo_fkey;

ALTER TABLE public.activos
  ADD CONSTRAINT activos_codigo_catalogo_fkey
  FOREIGN KEY (codigo_catalogo) REFERENCES public.catalogo_nacional (codigo)
  ON DELETE RESTRICT;

COMMENT ON COLUMN public.activos.codigo_catalogo IS
  'Código de catálogo del bien. Referencia catalogo_nacional para la consulta de la app publicada.';

NOTIFY pgrst, 'reload schema';
