-- Cada compra de un menaje agrega un comprobante. La fila de existencias sigue siendo una.

CREATE TABLE IF NOT EXISTS public.menaje_comprobantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id UUID NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL,
  precio NUMERIC(14, 2),
  serie TEXT,
  pdf_path TEXT,
  fecha DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menaje_comprobantes_cantidad_check CHECK (cantidad >= 1 AND cantidad <= 999999),
  CONSTRAINT menaje_comprobantes_precio_check CHECK (precio IS NULL OR precio >= 0)
);

COMMENT ON TABLE public.menaje_comprobantes IS
  'Comprobantes de compra de una línea de menaje. Varias compras de la misma variante se acumulan aquí.';

CREATE INDEX IF NOT EXISTS menaje_comprobantes_activo_id_idx
  ON public.menaje_comprobantes (activo_id, created_at);

ALTER TABLE public.menaje_comprobantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menaje_comprobantes_select ON public.menaje_comprobantes;
CREATE POLICY menaje_comprobantes_select ON public.menaje_comprobantes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activos a
      WHERE a.id = activo_id AND public.can_access_entidad(a.entidad_id)
    )
  );

DROP POLICY IF EXISTS menaje_comprobantes_insert ON public.menaje_comprobantes;
CREATE POLICY menaje_comprobantes_insert ON public.menaje_comprobantes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activos a
      WHERE a.id = activo_id AND public.can_access_entidad(a.entidad_id)
    )
  );

DROP POLICY IF EXISTS menaje_comprobantes_update ON public.menaje_comprobantes;
CREATE POLICY menaje_comprobantes_update ON public.menaje_comprobantes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activos a
      WHERE a.id = activo_id AND public.can_access_entidad(a.entidad_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activos a
      WHERE a.id = activo_id AND public.can_access_entidad(a.entidad_id)
    )
  );

DROP POLICY IF EXISTS menaje_comprobantes_delete ON public.menaje_comprobantes;
CREATE POLICY menaje_comprobantes_delete ON public.menaje_comprobantes
  FOR DELETE TO authenticated
  USING (
    public.is_contador()
    AND EXISTS (
      SELECT 1 FROM public.activos a
      WHERE a.id = activo_id AND public.can_access_entidad(a.entidad_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menaje_comprobantes TO authenticated, service_role;
