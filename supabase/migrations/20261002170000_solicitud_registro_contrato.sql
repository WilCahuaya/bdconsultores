-- Solicitud de registro de contratos de trabajo, compartida por varios trabajadores.

CREATE TABLE IF NOT EXISTS planillas.solicitudes_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  storage_path TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_registro_entidad
  ON planillas.solicitudes_registro (entidad_id);

ALTER TABLE planillas.contratos
  ADD COLUMN IF NOT EXISTS solicitud_registro_id UUID REFERENCES planillas.solicitudes_registro(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_solicitud_registro
  ON planillas.contratos (solicitud_registro_id)
  WHERE solicitud_registro_id IS NOT NULL;

DROP TRIGGER IF EXISTS solicitudes_registro_updated_at ON planillas.solicitudes_registro;
CREATE TRIGGER solicitudes_registro_updated_at
  BEFORE UPDATE ON planillas.solicitudes_registro
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.solicitudes_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitudes_registro_select ON planillas.solicitudes_registro;
CREATE POLICY solicitudes_registro_select ON planillas.solicitudes_registro
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS solicitudes_registro_insert ON planillas.solicitudes_registro;
CREATE POLICY solicitudes_registro_insert ON planillas.solicitudes_registro
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS solicitudes_registro_update ON planillas.solicitudes_registro;
CREATE POLICY solicitudes_registro_update ON planillas.solicitudes_registro
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS solicitudes_registro_delete ON planillas.solicitudes_registro;
CREATE POLICY solicitudes_registro_delete ON planillas.solicitudes_registro
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

GRANT SELECT, INSERT, UPDATE, DELETE ON planillas.solicitudes_registro TO authenticated, service_role;
