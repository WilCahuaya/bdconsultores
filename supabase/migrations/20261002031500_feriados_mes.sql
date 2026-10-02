-- Feriados elegidos por empresa y mes para el Excel de asistencia.

CREATE TABLE IF NOT EXISTS planillas.feriados_mes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  fechas DATE[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feriados_mes_mes_check CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT feriados_mes_unique UNIQUE (entidad_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_feriados_mes_entidad_mes
  ON planillas.feriados_mes (entidad_id, mes);

DROP TRIGGER IF EXISTS feriados_mes_updated_at ON planillas.feriados_mes;
CREATE TRIGGER feriados_mes_updated_at
  BEFORE UPDATE ON planillas.feriados_mes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.feriados_mes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feriados_mes_select ON planillas.feriados_mes;
CREATE POLICY feriados_mes_select ON planillas.feriados_mes
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS feriados_mes_insert ON planillas.feriados_mes;
CREATE POLICY feriados_mes_insert ON planillas.feriados_mes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS feriados_mes_update ON planillas.feriados_mes;
CREATE POLICY feriados_mes_update ON planillas.feriados_mes
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS feriados_mes_delete ON planillas.feriados_mes;
CREATE POLICY feriados_mes_delete ON planillas.feriados_mes
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

GRANT SELECT, INSERT, UPDATE, DELETE ON planillas.feriados_mes TO authenticated, service_role;
