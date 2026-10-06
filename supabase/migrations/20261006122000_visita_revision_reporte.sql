-- Foto de cada revisión para el reporte de la visita.
-- Lo posterior (altas, movimientos, cambios de estado) no reescribe estas filas.

ALTER TABLE public.visita_revisiones
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS nombre TEXT,
  ADD COLUMN IF NOT EXISTS ambiente_nombre TEXT,
  ADD COLUMN IF NOT EXISTS sede_nombre TEXT,
  ADD COLUMN IF NOT EXISTS estado_bien_anterior public.estado_bien,
  ADD COLUMN IF NOT EXISTS estado_bien_nuevo public.estado_bien,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por UUID,
  ADD COLUMN IF NOT EXISTS revisado_por_nombre TEXT;

DO $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT c.conname INTO v_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'visita_revisiones'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%activos%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.visita_revisiones DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.visita_revisiones
  ALTER COLUMN activo_id DROP NOT NULL;

ALTER TABLE public.visita_revisiones
  DROP CONSTRAINT IF EXISTS visita_revisiones_activo_id_fkey;

ALTER TABLE public.visita_revisiones
  ADD CONSTRAINT visita_revisiones_activo_id_fkey
  FOREIGN KEY (activo_id) REFERENCES public.activos(id) ON DELETE SET NULL;

ALTER TABLE public.visita_revisiones
  DROP CONSTRAINT IF EXISTS visita_revisiones_revisado_por_fkey;

ALTER TABLE public.visita_revisiones
  ADD CONSTRAINT visita_revisiones_revisado_por_fkey
  FOREIGN KEY (revisado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Visitas ya cerradas: nombre, código y lugar salen del bien y del ambiente actuales.
-- El estado anterior no se puede reconstruir.
UPDATE public.visita_revisiones r
SET
  codigo_barras = a.codigo_barras,
  nombre = a.nombre,
  ambiente_nombre = amb.nombre,
  sede_nombre = sed.nombre
FROM public.activos a
INNER JOIN public.ambientes amb ON TRUE
LEFT JOIN public.sedes sed ON sed.id = amb.sede_id
WHERE r.activo_id = a.id
  AND amb.id = r.ambiente_id
  AND r.nombre IS NULL;

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
  v_estado_anterior public.estado_bien;
  v_estado_nuevo public.estado_bien;
  v_codigo TEXT;
  v_nombre TEXT;
  v_ambiente_nombre TEXT;
  v_sede_nombre TEXT;
  v_revisor_nombre TEXT;
BEGIN
  IF NOT public.is_contador() THEN
    RAISE EXCEPTION 'Solo el contador puede revisar bienes en una visita';
  END IF;

  SELECT
    a.entidad_id,
    a.sede_id,
    a.ambiente_id,
    a.estado_registro,
    a.estado_bien,
    a.codigo_barras,
    a.nombre,
    amb.nombre,
    sed.nombre
  INTO
    v_entidad_id,
    v_sede_id,
    v_ambiente_id,
    v_estado,
    v_estado_anterior,
    v_codigo,
    v_nombre,
    v_ambiente_nombre,
    v_sede_nombre
  FROM public.activos a
  INNER JOIN public.ambientes amb ON amb.id = a.ambiente_id
  LEFT JOIN public.sedes sed ON sed.id = amb.sede_id
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

  SELECT nombre INTO v_revisor_nombre
  FROM public.profiles
  WHERE id = v_user;

  IF p_hallado THEN
    IF p_estado_bien IS NULL THEN
      RAISE EXCEPTION 'Indique el estado del bien';
    END IF;

    v_estado_nuevo := p_estado_bien;
    v_motivo := NULL;

    UPDATE public.activos
    SET estado_bien = p_estado_bien, updated_by = v_user, updated_at = now()
    WHERE id = p_activo_id;

    INSERT INTO public.visita_revisiones (
      visita_id, activo_id, ambiente_id, hallado, accion,
      codigo_barras, nombre, ambiente_nombre, sede_nombre,
      estado_bien_anterior, estado_bien_nuevo, motivo,
      revisado_por, revisado_por_nombre
    )
    VALUES (
      v_visita_id, p_activo_id, v_ambiente_id, TRUE, NULL,
      v_codigo, v_nombre, v_ambiente_nombre, v_sede_nombre,
      v_estado_anterior, v_estado_nuevo, NULL,
      v_user, v_revisor_nombre
    )
    ON CONFLICT (visita_id, activo_id) DO UPDATE
    SET
      hallado = TRUE,
      accion = NULL,
      ambiente_id = EXCLUDED.ambiente_id,
      codigo_barras = EXCLUDED.codigo_barras,
      nombre = EXCLUDED.nombre,
      ambiente_nombre = EXCLUDED.ambiente_nombre,
      sede_nombre = EXCLUDED.sede_nombre,
      estado_bien_anterior = EXCLUDED.estado_bien_anterior,
      estado_bien_nuevo = EXCLUDED.estado_bien_nuevo,
      motivo = NULL,
      revisado_por = EXCLUDED.revisado_por,
      revisado_por_nombre = EXCLUDED.revisado_por_nombre,
      updated_at = now();
  ELSE
    IF p_accion IS DISTINCT FROM 'BAJA' AND p_accion IS DISTINCT FROM 'FALTANTE' THEN
      RAISE EXCEPTION 'Indique si se da de baja o pasa a Faltante';
    END IF;

    IF p_accion = 'BAJA' THEN
      v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');
      IF v_motivo IS NULL THEN
        v_motivo := 'Defectuoso en visita de campo';
      END IF;
      v_estado_nuevo := 'MALO';

      UPDATE public.activos
      SET
        estado_registro = 'DADO_DE_BAJA',
        estado_bien = 'MALO',
        motivo_baja = v_motivo,
        updated_by = v_user,
        updated_at = now()
      WHERE id = p_activo_id;
    ELSE
      v_motivo := NULL;
      v_estado_nuevo := v_estado_anterior;
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

    INSERT INTO public.visita_revisiones (
      visita_id, activo_id, ambiente_id, hallado, accion,
      codigo_barras, nombre, ambiente_nombre, sede_nombre,
      estado_bien_anterior, estado_bien_nuevo, motivo,
      revisado_por, revisado_por_nombre
    )
    VALUES (
      v_visita_id, p_activo_id, v_ambiente_id, FALSE, p_accion,
      v_codigo, v_nombre, v_ambiente_nombre, v_sede_nombre,
      v_estado_anterior, v_estado_nuevo, v_motivo,
      v_user, v_revisor_nombre
    )
    ON CONFLICT (visita_id, activo_id) DO UPDATE
    SET
      hallado = FALSE,
      accion = EXCLUDED.accion,
      ambiente_id = EXCLUDED.ambiente_id,
      codigo_barras = EXCLUDED.codigo_barras,
      nombre = EXCLUDED.nombre,
      ambiente_nombre = EXCLUDED.ambiente_nombre,
      sede_nombre = EXCLUDED.sede_nombre,
      estado_bien_anterior = EXCLUDED.estado_bien_anterior,
      estado_bien_nuevo = EXCLUDED.estado_bien_nuevo,
      motivo = EXCLUDED.motivo,
      revisado_por = EXCLUDED.revisado_por,
      revisado_por_nombre = EXCLUDED.revisado_por_nombre,
      updated_at = now();
  END IF;

  PERFORM public.visita_sync_ambiente(v_visita_id, v_ambiente_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
