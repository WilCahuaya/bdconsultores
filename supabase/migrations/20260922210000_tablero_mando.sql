-- Tablero de mando del estudio: marcas sí/no del mes y registro de Excel de asistencia.

CREATE TABLE IF NOT EXISTS planillas.tablero_marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  clave TEXT NOT NULL,
  hecho BOOLEAN NOT NULL DEFAULT FALSE,
  hecho_en TIMESTAMPTZ,
  hecho_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tablero_marcas_mes_check CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tablero_marcas_clave_check CHECK (clave IN ('drt', 'sunafil_1', 'sunafil_16', 'planillas')),
  CONSTRAINT tablero_marcas_unique UNIQUE (entidad_id, mes, clave)
);

CREATE INDEX IF NOT EXISTS idx_tablero_marcas_entidad_mes
  ON planillas.tablero_marcas (entidad_id, mes);

DROP TRIGGER IF EXISTS tablero_marcas_updated_at ON planillas.tablero_marcas;
CREATE TRIGGER tablero_marcas_updated_at
  BEFORE UPDATE ON planillas.tablero_marcas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS planillas.asistencia_excel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  mes TEXT NOT NULL,
  generado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT asistencia_excel_mes_check CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT asistencia_excel_unique UNIQUE (relacion_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_excel_entidad_mes
  ON planillas.asistencia_excel (entidad_id, mes);

DROP TRIGGER IF EXISTS asistencia_excel_set_entidad ON planillas.asistencia_excel;
CREATE TRIGGER asistencia_excel_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.asistencia_excel
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

ALTER TABLE planillas.tablero_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE planillas.asistencia_excel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tablero_marcas_select ON planillas.tablero_marcas;
CREATE POLICY tablero_marcas_select ON planillas.tablero_marcas
  FOR SELECT TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS tablero_marcas_insert ON planillas.tablero_marcas;
CREATE POLICY tablero_marcas_insert ON planillas.tablero_marcas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS tablero_marcas_update ON planillas.tablero_marcas;
CREATE POLICY tablero_marcas_update ON planillas.tablero_marcas
  FOR UPDATE TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

DROP POLICY IF EXISTS tablero_marcas_delete ON planillas.tablero_marcas;
CREATE POLICY tablero_marcas_delete ON planillas.tablero_marcas
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS asistencia_excel_select ON planillas.asistencia_excel;
CREATE POLICY asistencia_excel_select ON planillas.asistencia_excel
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS asistencia_excel_insert ON planillas.asistencia_excel;
CREATE POLICY asistencia_excel_insert ON planillas.asistencia_excel
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS asistencia_excel_update ON planillas.asistencia_excel;
CREATE POLICY asistencia_excel_update ON planillas.asistencia_excel
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS asistencia_excel_delete ON planillas.asistencia_excel;
CREATE POLICY asistencia_excel_delete ON planillas.asistencia_excel
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());
