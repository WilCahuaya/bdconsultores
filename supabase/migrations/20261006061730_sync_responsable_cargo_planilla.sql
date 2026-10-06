-- Cuando cambia el cargo de la relación laboral, actualiza el responsable
-- de inventario de la misma empresa y el mismo DNI.

CREATE OR REPLACE FUNCTION planillas.sync_responsable_cargo_desde_relacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
DECLARE
  v_dni TEXT;
  v_cargo TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cargo IS NOT DISTINCT FROM OLD.cargo THEN
    RETURN NEW;
  END IF;

  SELECT regexp_replace(COALESCE(p.dni, ''), '\D', '', 'g')
  INTO v_dni
  FROM planillas.personas p
  WHERE p.id = NEW.persona_id;

  IF v_dni IS NULL OR v_dni = '' THEN
    RETURN NEW;
  END IF;

  v_cargo := NULLIF(btrim(COALESCE(NEW.cargo, '')), '');
  IF v_cargo IS NULL THEN
    v_cargo := 'Responsable';
  END IF;

  UPDATE public.responsables r
  SET cargo = v_cargo
  WHERE r.entidad_id = NEW.entidad_id
    AND regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') = v_dni
    AND r.cargo IS DISTINCT FROM v_cargo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relaciones_sync_responsable_cargo ON planillas.relaciones_laborales;
CREATE TRIGGER relaciones_sync_responsable_cargo
  AFTER INSERT OR UPDATE OF cargo ON planillas.relaciones_laborales
  FOR EACH ROW
  EXECUTE FUNCTION planillas.sync_responsable_cargo_desde_relacion();

-- Alinea los responsables que ya coinciden con un trabajador activo.
UPDATE public.responsables r
SET cargo = COALESCE(NULLIF(btrim(rel.cargo), ''), 'Responsable')
FROM planillas.relaciones_laborales rel
JOIN planillas.personas p ON p.id = rel.persona_id
WHERE r.entidad_id = rel.entidad_id
  AND rel.estado = 'ACTIVA'
  AND rel.fecha_cese IS NULL
  AND regexp_replace(COALESCE(p.dni, ''), '\D', '', 'g') <> ''
  AND regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') = regexp_replace(COALESCE(p.dni, ''), '\D', '', 'g')
  AND r.cargo IS DISTINCT FROM COALESCE(NULLIF(btrim(rel.cargo), ''), 'Responsable');
