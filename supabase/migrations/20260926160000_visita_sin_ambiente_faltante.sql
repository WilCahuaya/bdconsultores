-- Faltante no participa en la visita: solo conserva los bienes no hallados.

DELETE FROM public.visita_ambientes va
USING public.ambientes a
WHERE va.ambiente_id = a.id
  AND a.es_faltante = TRUE;

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
  FROM public.visita_ambientes va
  INNER JOIN public.ambientes a ON a.id = va.ambiente_id
  WHERE va.visita_id = p_visita_id
    AND va.estado = 'EN_PROCESO'
    AND a.es_faltante = FALSE
    AND a.es_preregistro = FALSE;

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
