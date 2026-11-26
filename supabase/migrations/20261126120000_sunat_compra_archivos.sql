-- Estado de la bajada del XML y el CDR de cada compra.
-- La clave es el comprobante, no el id de sunat_compras: el mes se vuelve a guardar borrando e insertando filas.

CREATE TABLE public.sunat_compra_archivos (
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL CHECK (periodo ~ '^[0-9]{6}$'),
  tipo TEXT NOT NULL CHECK (tipo IN ('01', '02', '03')),
  serie TEXT NOT NULL DEFAULT '',
  numero TEXT NOT NULL CHECK (char_length(btrim(numero)) > 0),
  xml_estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (xml_estado IN ('PENDIENTE', 'EN_PEDIDO', 'LISTO', 'SIN_XML', 'ERROR')),
  cdr_estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (cdr_estado IN ('PENDIENTE', 'EN_PEDIDO', 'LISTO', 'SIN_XML', 'ERROR')),
  mensaje TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entidad_id, periodo, tipo, serie, numero)
);

ALTER TABLE public.sunat_compra_archivos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sunat_compra_archivos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sunat_compra_archivos TO authenticated;

DROP POLICY IF EXISTS sunat_compra_archivos_estudio ON public.sunat_compra_archivos;
CREATE POLICY sunat_compra_archivos_estudio ON public.sunat_compra_archivos
  FOR ALL TO authenticated
  USING ((SELECT public.is_personal_estudio()))
  WITH CHECK ((SELECT public.is_personal_estudio()));
