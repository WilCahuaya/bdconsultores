DO $$ BEGIN
  CREATE TYPE planillas.estado_vacacion AS ENUM ('PROGRAMADO', 'GOZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS planillas.vacaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  periodo INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias INTEGER NOT NULL,
  estado planillas.estado_vacacion NOT NULL DEFAULT 'PROGRAMADO',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacaciones_fechas_check CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT vacaciones_dias_check CHECK (dias > 0)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_entidad ON planillas.vacaciones (entidad_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_relacion_periodo ON planillas.vacaciones (relacion_id, periodo);

DROP TRIGGER IF EXISTS vacaciones_set_entidad ON planillas.vacaciones;
CREATE TRIGGER vacaciones_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.vacaciones
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS vacaciones_updated_at ON planillas.vacaciones;
CREATE TRIGGER vacaciones_updated_at
  BEFORE UPDATE ON planillas.vacaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.vacaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vacaciones_select ON planillas.vacaciones;
CREATE POLICY vacaciones_select ON planillas.vacaciones
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vacaciones_insert ON planillas.vacaciones;
CREATE POLICY vacaciones_insert ON planillas.vacaciones
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vacaciones_update ON planillas.vacaciones;
CREATE POLICY vacaciones_update ON planillas.vacaciones
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vacaciones_delete ON planillas.vacaciones;
CREATE POLICY vacaciones_delete ON planillas.vacaciones
  FOR DELETE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));
