-- Pedido del contador para bajar el XML y el CDR en la PC del estudio.

CREATE TABLE public.sunat_pedidos (
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL CHECK (periodo ~ '^[0-9]{6}$'),
  estado TEXT NOT NULL CHECK (estado IN ('PEDIDO', 'EN_PROCESO', 'LISTO', 'ERROR')),
  mensaje TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entidad_id, periodo)
);

ALTER TABLE public.sunat_pedidos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sunat_pedidos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sunat_pedidos TO authenticated;

DROP POLICY IF EXISTS sunat_pedidos_estudio ON public.sunat_pedidos;
CREATE POLICY sunat_pedidos_estudio ON public.sunat_pedidos
  FOR ALL TO authenticated
  USING ((SELECT public.is_personal_estudio()))
  WITH CHECK ((SELECT public.is_personal_estudio()));
