-- Permite desmarcar un "Sí" en visita de campo (borra la revisión hallada).

CREATE OR REPLACE FUNCTION public.anular_revision_visita_si(p_activo_id UUID)
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
  v_revision_id UUID;
  v_estado_anterior public.estado_bien;
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede revisar bienes en una visita';
  END IF;

  SELECT a.entidad_id, a.sede_id, a.ambiente_id, a.estado_registro
  INTO v_entidad_id, v_sede_id, v_ambiente_id, v_estado
  FROM public.activos a
  WHERE a.id = p_activo_id;

  IF v_entidad_id IS NULL THEN
    RAISE EXCEPTION 'Bien no encontrado';
  END IF;

  IF NOT public.can_access_entidad(v_entidad_id) THEN
    RAISE EXCEPTION 'No autorizado para esta entidad';
  END IF;

  IF v_estado IS DISTINCT FROM 'REGISTRADO' THEN
    RAISE EXCEPTION 'Solo se revisan bienes registrados';
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

  SELECT r.id, r.estado_bien_anterior
  INTO v_revision_id, v_estado_anterior
  FROM public.visita_revisiones r
  WHERE r.visita_id = v_visita_id
    AND r.activo_id = p_activo_id
    AND r.hallado = TRUE;

  IF v_revision_id IS NULL THEN
    RAISE EXCEPTION 'Este bien no tiene un Sí marcado en la visita';
  END IF;

  IF v_estado_anterior IS NOT NULL THEN
    UPDATE public.activos
    SET
      estado_bien = v_estado_anterior,
      updated_by = v_user,
      updated_at = now()
    WHERE id = p_activo_id;
  END IF;

  DELETE FROM public.visita_revisiones
  WHERE id = v_revision_id;

  PERFORM public.visita_sync_ambiente(v_visita_id, v_ambiente_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.anular_revision_visita_si(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
