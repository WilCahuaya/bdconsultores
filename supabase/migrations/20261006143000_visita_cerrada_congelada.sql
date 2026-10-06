-- Una visita cerrada no vuelve a abrirse si después cambia el inventario.

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
    FROM public.visitas_campo
    WHERE id = p_visita_id
      AND estado = 'CERRADO'
  ) THEN
    RETURN;
  END IF;

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
          AND r.ambiente_id = ac.ambiente_id
      )
  ) THEN
    UPDATE public.visita_ambientes
    SET estado = 'EN_PROCESO', culminado_at = NULL, culminado_por = NULL
    WHERE visita_id = p_visita_id
      AND ambiente_id = p_ambiente_id
      AND estado = 'CULMINADO';
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

UPDATE public.visita_ambientes va
SET
  estado = 'CULMINADO',
  culminado_at = COALESCE(va.culminado_at, v.cerrado_at)
FROM public.visitas_campo v
WHERE va.visita_id = v.id
  AND v.estado = 'CERRADO'
  AND va.estado IS DISTINCT FROM 'CULMINADO';
