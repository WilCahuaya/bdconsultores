-- Ambiente Faltante por entidad y revisión de cada bien durante la visita de campo.

ALTER TABLE public.ambientes
  ADD COLUMN IF NOT EXISTS es_faltante BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.ensure_ambiente_faltante(p_entidad_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sede_id UUID;
  v_ambiente_id UUID;
BEGIN
  SELECT a.id INTO v_ambiente_id
  FROM public.ambientes a
  INNER JOIN public.sedes s ON s.id = a.sede_id
  WHERE s.entidad_id = p_entidad_id
    AND a.es_faltante = TRUE
    AND a.activo = TRUE
  LIMIT 1;

  IF v_ambiente_id IS NOT NULL THEN
    UPDATE public.ambientes
    SET nombre = 'Faltante', updated_at = NOW()
    WHERE id = v_ambiente_id AND nombre IS DISTINCT FROM 'Faltante';
    RETURN v_ambiente_id;
  END IF;

  v_sede_id := public.ensure_sede_principal_for_entidad(p_entidad_id);
  IF v_sede_id IS NULL THEN
    RAISE EXCEPTION 'La entidad no tiene sede Principal';
  END IF;

  INSERT INTO public.ambientes (sede_id, nombre, es_preregistro, es_faltante, activo)
  VALUES (v_sede_id, 'Faltante', FALSE, TRUE, TRUE)
  RETURNING id INTO v_ambiente_id;

  RETURN v_ambiente_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ambiente_faltante_for_entidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_ambiente_faltante(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entidades_03_create_ambiente_faltante ON public.entidades;
CREATE TRIGGER entidades_03_create_ambiente_faltante
  AFTER INSERT ON public.entidades
  FOR EACH ROW EXECUTE FUNCTION public.create_ambiente_faltante_for_entidad();

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.entidades LOOP
    PERFORM public.ensure_ambiente_faltante(r.id);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.visita_revisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id UUID NOT NULL REFERENCES public.visitas_campo(id) ON DELETE CASCADE,
  activo_id UUID NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
  ambiente_id UUID NOT NULL REFERENCES public.ambientes(id),
  hallado BOOLEAN NOT NULL,
  accion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT visita_revisiones_visita_activo_unique UNIQUE (visita_id, activo_id),
  CONSTRAINT visita_revisiones_accion_check CHECK (accion IS NULL OR accion IN ('BAJA', 'FALTANTE'))
);

CREATE INDEX IF NOT EXISTS idx_visita_revisiones_visita ON public.visita_revisiones (visita_id);
CREATE INDEX IF NOT EXISTS idx_visita_revisiones_ambiente ON public.visita_revisiones (ambiente_id);

DROP TRIGGER IF EXISTS visita_revisiones_updated_at ON public.visita_revisiones;
CREATE TRIGGER visita_revisiones_updated_at
  BEFORE UPDATE ON public.visita_revisiones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.visita_sync_ambiente(p_visita_id UUID, p_ambiente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.activos ac
    WHERE ac.ambiente_id = p_ambiente_id
      AND ac.estado_registro = 'REGISTRADO'
      AND NOT EXISTS (
        SELECT 1
        FROM public.visita_revisiones r
        WHERE r.visita_id = p_visita_id
          AND r.activo_id = ac.id
      )
  ) THEN
    RETURN;
  END IF;

  UPDATE public.visita_ambientes
  SET
    estado = 'CULMINADO',
    culminado_at = now(),
    culminado_por = v_user
  WHERE visita_id = p_visita_id
    AND ambiente_id = p_ambiente_id
    AND estado = 'EN_PROCESO';
END;
$$;

CREATE OR REPLACE FUNCTION public.abrir_visita_campo(
  p_entidad_id UUID,
  p_sede_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visita_id UUID;
  v_numero INTEGER;
  v_user UUID := auth.uid();
  v_ambiente_id UUID;
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede iniciar una visita de campo';
  END IF;

  IF NOT public.can_access_entidad(p_entidad_id) THEN
    RAISE EXCEPTION 'No autorizado para esta entidad';
  END IF;

  PERFORM public.ensure_ambiente_faltante(p_entidad_id);

  IF p_sede_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sedes
      WHERE id = p_sede_id
        AND entidad_id = p_entidad_id
        AND activo = TRUE
    ) THEN
      RAISE EXCEPTION 'La sucursal seleccionada no pertenece a esta entidad';
    END IF;
  END IF;

  IF p_sede_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.visitas_campo
      WHERE entidad_id = p_entidad_id AND estado = 'ABIERTO'
    ) THEN
      RAISE EXCEPTION 'Cierre las visitas abiertas antes de iniciar una en todas las sucursales';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.visitas_campo
      WHERE entidad_id = p_entidad_id AND estado = 'ABIERTO' AND sede_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Ya hay una visita abierta en todas las sucursales';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.visitas_campo
      WHERE entidad_id = p_entidad_id AND estado = 'ABIERTO' AND sede_id = p_sede_id
    ) THEN
      RAISE EXCEPTION 'Ya hay una visita de campo abierta en esta sucursal';
    END IF;
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1
  INTO v_numero
  FROM public.visitas_campo
  WHERE entidad_id = p_entidad_id;

  INSERT INTO public.visitas_campo (entidad_id, numero, estado, abierto_por, sede_id)
  VALUES (p_entidad_id, v_numero, 'ABIERTO', v_user, p_sede_id)
  RETURNING id INTO v_visita_id;

  INSERT INTO public.visita_ambientes (visita_id, ambiente_id, estado)
  SELECT v_visita_id, a.id, 'EN_PROCESO'
  FROM public.ambientes a
  INNER JOIN public.sedes s ON s.id = a.sede_id
  WHERE s.entidad_id = p_entidad_id
    AND a.activo = TRUE
    AND a.es_preregistro = FALSE
    AND a.es_faltante = FALSE
    AND (p_sede_id IS NULL OR a.sede_id = p_sede_id);

  FOR v_ambiente_id IN
    SELECT ambiente_id FROM public.visita_ambientes WHERE visita_id = v_visita_id
  LOOP
    PERFORM public.visita_sync_ambiente(v_visita_id, v_ambiente_id);
  END LOOP;

  RETURN v_visita_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.visita_ambiente_on_ambiente_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entidad_id UUID;
  v_visita_id UUID;
BEGIN
  IF NEW.es_preregistro = TRUE OR NEW.es_faltante = TRUE OR NEW.activo = FALSE THEN
    RETURN NEW;
  END IF;

  SELECT entidad_id INTO v_entidad_id
  FROM public.sedes
  WHERE id = NEW.sede_id;

  IF v_entidad_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.id INTO v_visita_id
  FROM public.visitas_campo v
  WHERE v.entidad_id = v_entidad_id
    AND v.estado = 'ABIERTO'
    AND (v.sede_id IS NULL OR v.sede_id = NEW.sede_id)
  ORDER BY CASE WHEN v.sede_id IS NULL THEN 1 ELSE 0 END
  LIMIT 1;

  IF v_visita_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.visita_ambientes (visita_id, ambiente_id, estado)
  VALUES (v_visita_id, NEW.id, 'EN_PROCESO')
  ON CONFLICT (visita_id, ambiente_id) DO NOTHING;

  PERFORM public.visita_sync_ambiente(v_visita_id, NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.culminar_ambiente_visita(p_ambiente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sede_id UUID;
  v_entidad_id UUID;
  v_visita_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede culminar una visita de ambiente';
  END IF;

  SELECT a.sede_id, s.entidad_id
  INTO v_sede_id, v_entidad_id
  FROM public.ambientes a
  INNER JOIN public.sedes s ON s.id = a.sede_id
  WHERE a.id = p_ambiente_id AND a.activo = TRUE;

  IF v_entidad_id IS NULL THEN
    RAISE EXCEPTION 'Ambiente no encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ambientes
    WHERE id = p_ambiente_id AND (es_preregistro = TRUE OR es_faltante = TRUE)
  ) THEN
    RAISE EXCEPTION 'Este ambiente no participa en visitas de campo';
  END IF;

  SELECT v.id INTO v_visita_id
  FROM public.visitas_campo v
  WHERE v.entidad_id = v_entidad_id
    AND v.estado = 'ABIERTO'
    AND (v.sede_id IS NULL OR v.sede_id = v_sede_id)
  ORDER BY CASE WHEN v.sede_id IS NULL THEN 1 ELSE 0 END
  LIMIT 1;

  IF v_visita_id IS NULL THEN
    RAISE EXCEPTION 'No hay una visita de campo abierta para este ambiente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.activos ac
    WHERE ac.ambiente_id = p_ambiente_id
      AND ac.estado_registro = 'REGISTRADO'
      AND NOT EXISTS (
        SELECT 1 FROM public.visita_revisiones r
        WHERE r.visita_id = v_visita_id AND r.activo_id = ac.id
      )
  ) THEN
    RAISE EXCEPTION 'Revise todos los bienes del ambiente (Sí o No) antes de culminarlo';
  END IF;

  UPDATE public.visita_ambientes
  SET
    estado = 'CULMINADO',
    culminado_at = now(),
    culminado_por = v_user
  WHERE visita_id = v_visita_id
    AND ambiente_id = p_ambiente_id
    AND estado = 'EN_PROCESO';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El ambiente no está en proceso en la visita actual';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cerrar_visita_campo(p_visita_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendientes INTEGER;
  v_entidad_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede cerrar una visita de campo';
  END IF;

  SELECT entidad_id INTO v_entidad_id
  FROM public.visitas_campo
  WHERE id = p_visita_id AND estado = 'ABIERTO';

  IF v_entidad_id IS NULL THEN
    RAISE EXCEPTION 'Visita de campo no encontrada o ya cerrada';
  END IF;

  IF NOT public.can_access_entidad(v_entidad_id) THEN
    RAISE EXCEPTION 'No autorizado para esta entidad';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_pendientes
  FROM public.visita_ambientes
  WHERE visita_id = p_visita_id AND estado = 'EN_PROCESO';

  IF v_pendientes > 0 THEN
    RAISE EXCEPTION 'La visita solo termina cuando se revisaron los bienes de cada ambiente (% pendientes)', v_pendientes;
  END IF;

  UPDATE public.visitas_campo
  SET
    estado = 'CERRADO',
    cerrado_at = now(),
    cerrado_por = v_user
  WHERE id = p_visita_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_revision_visita(
  p_activo_id UUID,
  p_hallado BOOLEAN,
  p_estado_bien public.estado_bien DEFAULT NULL,
  p_accion TEXT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_entidad_id UUID;
  v_sede_id UUID;
  v_ambiente_id UUID;
  v_estado public.estado_registro;
  v_visita_id UUID;
  v_faltante_id UUID;
  v_faltante_sede UUID;
  v_motivo TEXT;
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede revisar bienes en una visita';
  END IF;

  SELECT entidad_id, sede_id, ambiente_id, estado_registro
  INTO v_entidad_id, v_sede_id, v_ambiente_id, v_estado
  FROM public.activos
  WHERE id = p_activo_id;

  IF v_entidad_id IS NULL THEN
    RAISE EXCEPTION 'Bien no encontrado';
  END IF;

  IF NOT public.can_access_entidad(v_entidad_id) THEN
    RAISE EXCEPTION 'No autorizado para esta entidad';
  END IF;

  IF v_estado IS DISTINCT FROM 'REGISTRADO' THEN
    RAISE EXCEPTION 'Solo se revisan bienes registrados';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ambientes
    WHERE id = v_ambiente_id AND (es_preregistro = TRUE OR es_faltante = TRUE)
  ) THEN
    RAISE EXCEPTION 'Este bien no se revisa en la ronda del ambiente';
  END IF;

  SELECT v.id INTO v_visita_id
  FROM public.visitas_campo v
  INNER JOIN public.visita_ambientes va ON va.visita_id = v.id AND va.ambiente_id = v_ambiente_id
  WHERE v.entidad_id = v_entidad_id
    AND v.estado = 'ABIERTO'
    AND (v.sede_id IS NULL OR v.sede_id = v_sede_id)
  ORDER BY CASE WHEN v.sede_id IS NULL THEN 1 ELSE 0 END
  LIMIT 1;

  IF v_visita_id IS NULL THEN
    RAISE EXCEPTION 'No hay una visita abierta para este ambiente';
  END IF;

  IF p_hallado THEN
    IF p_estado_bien IS NULL THEN
      RAISE EXCEPTION 'Indique el estado del bien';
    END IF;

    UPDATE public.activos
    SET estado_bien = p_estado_bien, updated_by = v_user, updated_at = now()
    WHERE id = p_activo_id;

    INSERT INTO public.visita_revisiones (visita_id, activo_id, ambiente_id, hallado, accion)
    VALUES (v_visita_id, p_activo_id, v_ambiente_id, TRUE, NULL)
    ON CONFLICT (visita_id, activo_id) DO UPDATE
    SET hallado = TRUE, accion = NULL, ambiente_id = EXCLUDED.ambiente_id, updated_at = now();
  ELSE
    IF p_accion IS DISTINCT FROM 'BAJA' AND p_accion IS DISTINCT FROM 'FALTANTE' THEN
      RAISE EXCEPTION 'Indique si se da de baja o pasa a Faltante';
    END IF;

    IF p_accion = 'BAJA' THEN
      v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
      IF v_motivo IS NULL THEN
        v_motivo := 'Defectuoso en visita de campo';
      END IF;

      UPDATE public.activos
      SET
        estado_registro = 'DADO_DE_BAJA',
        estado_bien = 'MALO',
        motivo_baja = v_motivo,
        updated_by = v_user,
        updated_at = now()
      WHERE id = p_activo_id;
    ELSE
      v_faltante_id := public.ensure_ambiente_faltante(v_entidad_id);
      SELECT sede_id INTO v_faltante_sede FROM public.ambientes WHERE id = v_faltante_id;

      UPDATE public.activos
      SET
        ambiente_id = v_faltante_id,
        sede_id = v_faltante_sede,
        updated_by = v_user,
        updated_at = now()
      WHERE id = p_activo_id;
    END IF;

    INSERT INTO public.visita_revisiones (visita_id, activo_id, ambiente_id, hallado, accion)
    VALUES (v_visita_id, p_activo_id, v_ambiente_id, FALSE, p_accion)
    ON CONFLICT (visita_id, activo_id) DO UPDATE
    SET hallado = FALSE, accion = EXCLUDED.accion, ambiente_id = EXCLUDED.ambiente_id, updated_at = now();
  END IF;

  PERFORM public.visita_sync_ambiente(v_visita_id, v_ambiente_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_bien_faltante(
  p_activo_id UUID,
  p_accion TEXT,
  p_ambiente_id UUID DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_entidad_id UUID;
  v_ambiente_id UUID;
  v_estado public.estado_registro;
  v_estado_bien public.estado_bien;
  v_destino_sede UUID;
  v_destino_entidad UUID;
  v_responsable TEXT;
  v_motivo TEXT;
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede resolver un bien faltante';
  END IF;

  SELECT a.entidad_id, a.ambiente_id, a.estado_registro, a.estado_bien
  INTO v_entidad_id, v_ambiente_id, v_estado, v_estado_bien
  FROM public.activos a
  WHERE a.id = p_activo_id;

  IF v_entidad_id IS NULL THEN
    RAISE EXCEPTION 'Bien no encontrado';
  END IF;

  IF NOT public.can_access_entidad(v_entidad_id) THEN
    RAISE EXCEPTION 'No autorizado para esta entidad';
  END IF;

  IF v_estado IS DISTINCT FROM 'REGISTRADO' THEN
    RAISE EXCEPTION 'El bien no está activo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ambientes WHERE id = v_ambiente_id AND es_faltante = TRUE
  ) THEN
    RAISE EXCEPTION 'El bien no está en el ambiente Faltante';
  END IF;

  IF p_accion = 'MOVER' THEN
    SELECT s.entidad_id, a.sede_id, a.responsable
    INTO v_destino_entidad, v_destino_sede, v_responsable
    FROM public.ambientes a
    INNER JOIN public.sedes s ON s.id = a.sede_id
    WHERE a.id = p_ambiente_id
      AND a.activo = TRUE
      AND a.es_preregistro = FALSE
      AND a.es_faltante = FALSE;

    IF v_destino_entidad IS NULL OR v_destino_entidad <> v_entidad_id THEN
      RAISE EXCEPTION 'Elija un ambiente real de la misma entidad';
    END IF;

    UPDATE public.activos
    SET
      ambiente_id = p_ambiente_id,
      sede_id = v_destino_sede,
      responsable = NULLIF(btrim(COALESCE(v_responsable, '')), ''),
      updated_by = v_user,
      updated_at = now()
    WHERE id = p_activo_id;
  ELSIF p_accion = 'BAJA' THEN
    IF v_estado_bien IS DISTINCT FROM 'MALO' THEN
      RAISE EXCEPTION 'Solo se da de baja desde Faltante si el bien está en estado Malo';
    END IF;

    v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Indique el motivo de baja';
    END IF;

    UPDATE public.activos
    SET
      estado_registro = 'DADO_DE_BAJA',
      motivo_baja = v_motivo,
      updated_by = v_user,
      updated_at = now()
    WHERE id = p_activo_id;
  ELSE
    RAISE EXCEPTION 'Acción no válida';
  END IF;
END;
$$;

ALTER TABLE public.visita_revisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visita_revisiones_select ON public.visita_revisiones;
CREATE POLICY visita_revisiones_select ON public.visita_revisiones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.visitas_campo v
      WHERE v.id = visita_id AND public.can_access_entidad(v.entidad_id)
    )
  );

GRANT SELECT ON public.visita_revisiones TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ambiente_faltante(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_revision_visita(UUID, BOOLEAN, public.estado_bien, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_bien_faltante(UUID, TEXT, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
