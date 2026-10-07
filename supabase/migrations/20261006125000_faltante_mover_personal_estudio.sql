-- El contador y el asistente pueden sacar un bien de Faltantes.
-- El administrador de la entidad no.

CREATE OR REPLACE FUNCTION public.can_access_entidad(p_entidad_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_personal_estudio()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND activo = TRUE
        AND rol = 'ADMIN_ENTIDAD'
        AND entidad_id = p_entidad_id
    );
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
  v_visita_id UUID;
BEGIN
  IF NOT public.is_personal_estudio() THEN
    RAISE EXCEPTION 'Solo el contador o el asistente puede mover un bien de Faltantes';
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

    DELETE FROM public.visita_revisiones r
    USING public.visitas_campo v
    WHERE r.activo_id = p_activo_id
      AND r.visita_id = v.id
      AND v.entidad_id = v_entidad_id
      AND v.estado = 'ABIERTO';

    FOR v_visita_id IN
      SELECT v.id
      FROM public.visitas_campo v
      INNER JOIN public.visita_ambientes va
        ON va.visita_id = v.id
       AND va.ambiente_id = p_ambiente_id
      WHERE v.entidad_id = v_entidad_id
        AND v.estado = 'ABIERTO'
    LOOP
      PERFORM public.visita_sync_ambiente(v_visita_id, p_ambiente_id);
    END LOOP;
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
