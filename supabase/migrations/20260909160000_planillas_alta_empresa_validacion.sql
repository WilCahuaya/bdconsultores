-- Alta de trabajador: la empresa crea y sube docs; el estudio valida.
-- Escritura de persona/puesto/contrato/documentos: estudio o usuario de la entidad.
-- Pensiones, T-Registro y Vida Ley siguen solo en el estudio.

DO $$ BEGIN
  CREATE TYPE planillas.estado_validacion_alta AS ENUM ('PENDIENTE', 'ACEPTADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE planillas.relaciones_laborales
  ADD COLUMN IF NOT EXISTS validacion planillas.estado_validacion_alta NOT NULL DEFAULT 'ACEPTADA';

CREATE INDEX IF NOT EXISTS idx_relaciones_validacion_pendiente
  ON planillas.relaciones_laborales (entidad_id)
  WHERE validacion = 'PENDIENTE';

CREATE OR REPLACE FUNCTION planillas.enforce_validacion_alta()
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
    NEW.validacion := 'PENDIENTE';
    RETURN NEW;
  END IF;

  IF NEW.validacion IS DISTINCT FROM OLD.validacion THEN
    RAISE EXCEPTION 'Solo el estudio puede validar el alta del trabajador.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relaciones_enforce_validacion ON planillas.relaciones_laborales;
CREATE TRIGGER relaciones_enforce_validacion
  BEFORE INSERT OR UPDATE OF validacion ON planillas.relaciones_laborales
  FOR EACH ROW EXECUTE FUNCTION planillas.enforce_validacion_alta();

-- Personas: la empresa puede crear/editar las de su entidad (alta reutiliza DNI).
DROP POLICY IF EXISTS personas_write ON planillas.personas;
DROP POLICY IF EXISTS personas_insert ON planillas.personas;
DROP POLICY IF EXISTS personas_update ON planillas.personas;
DROP POLICY IF EXISTS personas_delete ON planillas.personas;

CREATE POLICY personas_insert ON planillas.personas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND activo = TRUE
        AND rol IN ('ADMIN_ENTIDAD', 'TESORERO_ENTIDAD', 'SECRETARIO_ENTIDAD')
    )
  );

CREATE POLICY personas_update ON planillas.personas
  FOR UPDATE TO authenticated
  USING (
    public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM planillas.relaciones_laborales r
      WHERE r.persona_id = personas.id
        AND public.can_access_entidad_planillas(r.entidad_id)
    )
  )
  WITH CHECK (
    public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM planillas.relaciones_laborales r
      WHERE r.persona_id = personas.id
        AND public.can_access_entidad_planillas(r.entidad_id)
    )
  );

CREATE POLICY personas_delete ON planillas.personas
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS relaciones_write ON planillas.relaciones_laborales;
DROP POLICY IF EXISTS relaciones_insert ON planillas.relaciones_laborales;
DROP POLICY IF EXISTS relaciones_update ON planillas.relaciones_laborales;
DROP POLICY IF EXISTS relaciones_delete ON planillas.relaciones_laborales;

CREATE POLICY relaciones_insert ON planillas.relaciones_laborales
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY relaciones_update ON planillas.relaciones_laborales
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY relaciones_delete ON planillas.relaciones_laborales
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS contratos_write ON planillas.contratos;
DROP POLICY IF EXISTS contratos_insert ON planillas.contratos;
DROP POLICY IF EXISTS contratos_update ON planillas.contratos;
DROP POLICY IF EXISTS contratos_delete ON planillas.contratos;

CREATE POLICY contratos_insert ON planillas.contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY contratos_update ON planillas.contratos
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY contratos_delete ON planillas.contratos
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS documentos_write ON planillas.documentos;
DROP POLICY IF EXISTS documentos_insert ON planillas.documentos;
DROP POLICY IF EXISTS documentos_update ON planillas.documentos;
DROP POLICY IF EXISTS documentos_delete ON planillas.documentos;

CREATE POLICY documentos_insert ON planillas.documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY documentos_update ON planillas.documentos
  FOR UPDATE TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id))
  WITH CHECK (public.can_access_entidad_planillas(entidad_id));

CREATE POLICY documentos_delete ON planillas.documentos
  FOR DELETE TO authenticated
  USING (public.is_personal_estudio());

DROP POLICY IF EXISTS documentos_planillas_insert ON storage.objects;
CREATE POLICY documentos_planillas_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-planillas'
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );

DROP POLICY IF EXISTS documentos_planillas_update ON storage.objects;
CREATE POLICY documentos_planillas_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos-planillas'
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  )
  WITH CHECK (
    bucket_id = 'documentos-planillas'
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );
