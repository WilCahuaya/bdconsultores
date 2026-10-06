-- Nombre, DNI, correo, teléfono y cargo del responsable siguen a la ficha de Planillas.

CREATE OR REPLACE FUNCTION planillas.aplicar_responsable_desde_planilla(
  p_entidad_id UUID,
  p_persona_id UUID,
  p_cargo TEXT,
  p_dni_anterior TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
DECLARE
  v_persona planillas.personas%ROWTYPE;
  v_dni TEXT;
  v_dni_anterior TEXT;
  v_nombre TEXT;
  v_email TEXT;
  v_telefono TEXT;
  v_cargo TEXT;
BEGIN
  SELECT * INTO v_persona FROM planillas.personas WHERE id = p_persona_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dni := regexp_replace(COALESCE(v_persona.dni, ''), '\D', '', 'g');
  v_dni_anterior := regexp_replace(COALESCE(p_dni_anterior, ''), '\D', '', 'g');
  IF v_dni = '' AND v_dni_anterior = '' THEN
    RETURN;
  END IF;

  v_nombre := btrim(regexp_replace(
    concat_ws(
      ' ',
      NULLIF(btrim(v_persona.nombres), ''),
      NULLIF(btrim(v_persona.apellido_paterno), ''),
      NULLIF(btrim(v_persona.apellido_materno), '')
    ),
    '\s+',
    ' ',
    'g'
  ));
  IF v_nombre = '' THEN
    RETURN;
  END IF;

  v_email := NULLIF(lower(btrim(COALESCE(v_persona.correo, ''))), '');
  v_telefono := regexp_replace(COALESCE(v_persona.celular, ''), '\D', '', 'g');
  IF length(v_telefono) <> 9 THEN
    v_telefono := NULL;
  END IF;

  v_cargo := NULLIF(btrim(COALESCE(p_cargo, '')), '');
  IF v_cargo IS NULL THEN
    v_cargo := 'Responsable';
  END IF;

  UPDATE public.responsables r
  SET
    nombre = v_nombre,
    dni = NULLIF(v_dni, ''),
    email = v_email,
    telefono = v_telefono,
    cargo = v_cargo
  WHERE r.entidad_id = p_entidad_id
    AND (
      (v_dni <> '' AND regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') = v_dni)
      OR (v_dni_anterior <> '' AND regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') = v_dni_anterior)
    )
    AND (
      r.nombre IS DISTINCT FROM v_nombre
      OR regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') IS DISTINCT FROM v_dni
      OR r.email IS DISTINCT FROM v_email
      OR r.telefono IS DISTINCT FROM v_telefono
      OR r.cargo IS DISTINCT FROM v_cargo
    );
END;
$$;

CREATE OR REPLACE FUNCTION planillas.sync_responsable_desde_relacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cargo IS NOT DISTINCT FROM OLD.cargo AND NEW.persona_id IS NOT DISTINCT FROM OLD.persona_id THEN
    RETURN NEW;
  END IF;

  PERFORM planillas.aplicar_responsable_desde_planilla(
    NEW.entidad_id,
    NEW.persona_id,
    NEW.cargo,
    NULL
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION planillas.sync_responsable_desde_persona()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = planillas, public
AS $$
DECLARE
  rel planillas.relaciones_laborales%ROWTYPE;
BEGIN
  IF NEW.dni IS NOT DISTINCT FROM OLD.dni
     AND NEW.nombres IS NOT DISTINCT FROM OLD.nombres
     AND NEW.apellido_paterno IS NOT DISTINCT FROM OLD.apellido_paterno
     AND NEW.apellido_materno IS NOT DISTINCT FROM OLD.apellido_materno
     AND NEW.celular IS NOT DISTINCT FROM OLD.celular
     AND NEW.correo IS NOT DISTINCT FROM OLD.correo THEN
    RETURN NEW;
  END IF;

  FOR rel IN
    SELECT * FROM planillas.relaciones_laborales WHERE persona_id = NEW.id
  LOOP
    PERFORM planillas.aplicar_responsable_desde_planilla(
      rel.entidad_id,
      NEW.id,
      rel.cargo,
      OLD.dni
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relaciones_sync_responsable_cargo ON planillas.relaciones_laborales;
DROP FUNCTION IF EXISTS planillas.sync_responsable_cargo_desde_relacion();
DROP TRIGGER IF EXISTS relaciones_sync_responsable_datos ON planillas.relaciones_laborales;
CREATE TRIGGER relaciones_sync_responsable_datos
  AFTER INSERT OR UPDATE OF cargo, persona_id ON planillas.relaciones_laborales
  FOR EACH ROW
  EXECUTE FUNCTION planillas.sync_responsable_desde_relacion();

DROP TRIGGER IF EXISTS personas_sync_responsable_datos ON planillas.personas;
CREATE TRIGGER personas_sync_responsable_datos
  AFTER UPDATE OF dni, nombres, apellido_paterno, apellido_materno, celular, correo
  ON planillas.personas
  FOR EACH ROW
  EXECUTE FUNCTION planillas.sync_responsable_desde_persona();

UPDATE public.responsables r
SET
  nombre = datos.nombre,
  dni = NULLIF(datos.dni, ''),
  email = datos.email,
  telefono = datos.telefono,
  cargo = datos.cargo
FROM (
  SELECT
    rel.entidad_id,
    regexp_replace(COALESCE(p.dni, ''), '\D', '', 'g') AS dni,
    btrim(regexp_replace(
      concat_ws(
        ' ',
        NULLIF(btrim(p.nombres), ''),
        NULLIF(btrim(p.apellido_paterno), ''),
        NULLIF(btrim(p.apellido_materno), '')
      ),
      '\s+',
      ' ',
      'g'
    )) AS nombre,
    NULLIF(lower(btrim(COALESCE(p.correo, ''))), '') AS email,
    CASE
      WHEN length(regexp_replace(COALESCE(p.celular, ''), '\D', '', 'g')) = 9
        THEN regexp_replace(COALESCE(p.celular, ''), '\D', '', 'g')
      ELSE NULL
    END AS telefono,
    COALESCE(NULLIF(btrim(rel.cargo), ''), 'Responsable') AS cargo
  FROM planillas.relaciones_laborales rel
  JOIN planillas.personas p ON p.id = rel.persona_id
  WHERE rel.estado = 'ACTIVA'
    AND rel.fecha_cese IS NULL
) datos
WHERE r.entidad_id = datos.entidad_id
  AND datos.dni <> ''
  AND datos.nombre <> ''
  AND regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') = datos.dni
  AND (
    r.nombre IS DISTINCT FROM datos.nombre
    OR regexp_replace(COALESCE(r.dni, ''), '\D', '', 'g') IS DISTINCT FROM datos.dni
    OR r.email IS DISTINCT FROM datos.email
    OR r.telefono IS DISTINCT FROM datos.telefono
    OR r.cargo IS DISTINCT FROM datos.cargo
  );
