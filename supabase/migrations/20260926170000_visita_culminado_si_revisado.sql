-- Culminado solo si no quedan bienes registrados sin revisar en ese ambiente.

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
    UPDATE public.visita_ambientes
    SET
      estado = 'EN_PROCESO',
      culminado_at = NULL,
      culminado_por = NULL
    WHERE visita_id = p_visita_id
      AND ambiente_id = p_ambiente_id
      AND estado = 'CULMINADO';
    RETURN;
  END IF;

  UPDATE public.visita_ambientes
  SET
    estado = 'CULMINADO',
    culminado_at = COALESCE(culminado_at, now()),
    culminado_por = COALESCE(culminado_por, v_user)
  WHERE visita_id = p_visita_id
    AND ambiente_id = p_ambiente_id
    AND estado = 'EN_PROCESO';
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT va.visita_id, va.ambiente_id
    FROM public.visita_ambientes va
    INNER JOIN public.visitas_campo v ON v.id = va.visita_id
    WHERE v.estado = 'ABIERTO'
  LOOP
    PERFORM public.visita_sync_ambiente(r.visita_id, r.ambiente_id);
  END LOOP;
END $$;
