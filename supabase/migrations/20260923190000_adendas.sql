-- Adenda: modifica una cláusula del contrato vigente (cargo, sueldo u horario).
-- El contrato original no se reescribe. El PDF firmado vive en la propia adenda.

DO $$ BEGIN
  CREATE TYPE planillas.tipo_adenda AS ENUM ('CARGO', 'REMUNERACION', 'HORARIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS planillas.adendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relacion_id UUID NOT NULL REFERENCES planillas.relaciones_laborales(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES planillas.contratos(id) ON DELETE RESTRICT,
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  numero INTEGER NOT NULL,
  tipo planillas.tipo_adenda NOT NULL,
  fecha_vigencia DATE NOT NULL,
  fecha_suscripcion DATE NOT NULL,
  cargo_anterior TEXT,
  cargo_nuevo TEXT,
  remuneracion_anterior NUMERIC(12, 2),
  remuneracion_nueva NUMERIC(12, 2),
  horario_anterior TEXT,
  horario_nuevo TEXT,
  jornada_anterior planillas.jornada_laboral,
  jornada_nueva planillas.jornada_laboral,
  estado planillas.estado_contrato NOT NULL DEFAULT 'PENDIENTE_DOCS',
  datos_confirmados BOOLEAN NOT NULL DEFAULT FALSE,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT adendas_numero_positivo CHECK (numero > 0),
  CONSTRAINT adendas_numero_unico UNIQUE (relacion_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_adendas_relacion ON planillas.adendas (relacion_id);
CREATE INDEX IF NOT EXISTS idx_adendas_abierta
  ON planillas.adendas (relacion_id)
  WHERE datos_confirmados = FALSE;

CREATE OR REPLACE FUNCTION planillas.enforce_estado_adenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_personal_estudio() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'PENDIENTE_DOCS';
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'PENDIENTE_DOCS' AND NEW.estado = 'ELABORADO' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo el estudio puede marcar la adenda como recogida.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adendas_enforce_estado ON planillas.adendas;
CREATE TRIGGER adendas_enforce_estado
  BEFORE INSERT OR UPDATE OF estado ON planillas.adendas
  FOR EACH ROW EXECUTE FUNCTION planillas.enforce_estado_adenda();

DROP TRIGGER IF EXISTS adendas_set_entidad ON planillas.adendas;
CREATE TRIGGER adendas_set_entidad
  BEFORE INSERT OR UPDATE OF relacion_id ON planillas.adendas
  FOR EACH ROW EXECUTE FUNCTION planillas.set_entidad_from_relacion();

DROP TRIGGER IF EXISTS adendas_updated_at ON planillas.adendas;
CREATE TRIGGER adendas_updated_at
  BEFORE UPDATE ON planillas.adendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.adendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adendas_select ON planillas.adendas;
CREATE POLICY adendas_select ON planillas.adendas
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS adendas_insert ON planillas.adendas;
CREATE POLICY adendas_insert ON planillas.adendas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS adendas_update ON planillas.adendas;
CREATE POLICY adendas_update ON planillas.adendas
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS adendas_delete ON planillas.adendas;
CREATE POLICY adendas_delete ON planillas.adendas
  FOR DELETE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));
