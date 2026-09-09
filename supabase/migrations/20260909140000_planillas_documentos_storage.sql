-- Fase 3: PDFs e imágenes de la ficha laboral en Storage.
-- Ruta: {entidad_id}/{relacion_id}/{documento_id}.{ext}
-- Lectura: estudio y empresa. Escritura: solo personal del estudio.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-planillas',
  'documentos-planillas',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = FALSE;

DROP POLICY IF EXISTS documentos_planillas_select ON storage.objects;
CREATE POLICY documentos_planillas_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-planillas'
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );

DROP POLICY IF EXISTS documentos_planillas_insert ON storage.objects;
CREATE POLICY documentos_planillas_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-planillas'
    AND public.is_personal_estudio()
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );

DROP POLICY IF EXISTS documentos_planillas_update ON storage.objects;
CREATE POLICY documentos_planillas_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos-planillas'
    AND public.is_personal_estudio()
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  )
  WITH CHECK (
    bucket_id = 'documentos-planillas'
    AND public.is_personal_estudio()
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );

DROP POLICY IF EXISTS documentos_planillas_delete ON storage.objects;
CREATE POLICY documentos_planillas_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-planillas'
    AND public.is_personal_estudio()
    AND public.can_access_entidad_planillas(public.storage_entidad_from_path(name))
  );
