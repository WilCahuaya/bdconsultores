-- Hijos para calcular la asignación familiar. El sustento sigue siendo un solo documento.

CREATE TABLE IF NOT EXISTS planillas.hijos_asignacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  menor BOOLEAN NOT NULL DEFAULT FALSE,
  estudios_superiores BOOLEAN NOT NULL DEFAULT FALSE,
  discapacidad BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hijos_asignacion_nombre_check CHECK (char_length(btrim(nombre)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hijos_asignacion_relacion
  ON planillas.hijos_asignacion (relacion_id);

DROP TRIGGER IF EXISTS hijos_asignacion_set_entidad ON planillas.hijos_asignacion;
CREATE TRIGGER hijos_asignacion_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.hijos_asignacion
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS hijos_asignacion_updated_at ON planillas.hijos_asignacion;
CREATE TRIGGER hijos_asignacion_updated_at
  BEFORE UPDATE ON planillas.hijos_asignacion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.hijos_asignacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hijos_asignacion_select ON planillas.hijos_asignacion;
CREATE POLICY hijos_asignacion_select ON planillas.hijos_asignacion
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS hijos_asignacion_insert ON planillas.hijos_asignacion;
CREATE POLICY hijos_asignacion_insert ON planillas.hijos_asignacion
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS hijos_asignacion_update ON planillas.hijos_asignacion;
CREATE POLICY hijos_asignacion_update ON planillas.hijos_asignacion
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS hijos_asignacion_delete ON planillas.hijos_asignacion;
CREATE POLICY hijos_asignacion_delete ON planillas.hijos_asignacion
  FOR DELETE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON planillas.hijos_asignacion TO authenticated, service_role;
