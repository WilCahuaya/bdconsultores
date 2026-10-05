-- El comprobante de envío de Vida Ley es uno por empresa y se sustituye
-- cuando hay un alta nueva. La constancia y la factura siguen en el grupo.

CREATE TABLE IF NOT EXISTS planillas.vida_ley_comprobante_empresa (
  entidad_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE RESTRICT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS vida_ley_comprobante_empresa_updated_at ON planillas.vida_ley_comprobante_empresa;
CREATE TRIGGER vida_ley_comprobante_empresa_updated_at
  BEFORE UPDATE ON planillas.vida_ley_comprobante_empresa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.vida_ley_comprobante_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vida_ley_comprobante_empresa_select ON planillas.vida_ley_comprobante_empresa;
CREATE POLICY vida_ley_comprobante_empresa_select ON planillas.vida_ley_comprobante_empresa
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vida_ley_comprobante_empresa_write ON planillas.vida_ley_comprobante_empresa;
CREATE POLICY vida_ley_comprobante_empresa_write ON planillas.vida_ley_comprobante_empresa
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

GRANT SELECT, INSERT, UPDATE, DELETE ON planillas.vida_ley_comprobante_empresa TO authenticated, service_role;

INSERT INTO planillas.vida_ley_comprobante_empresa (entidad_id, storage_path)
SELECT DISTINCT ON (entidad_id) entidad_id, comprobante_storage_path
FROM planillas.vida_ley_lotes
WHERE comprobante_storage_path IS NOT NULL
ORDER BY entidad_id, updated_at DESC
ON CONFLICT (entidad_id) DO NOTHING;
