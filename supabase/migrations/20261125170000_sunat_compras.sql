-- Credenciales SOL por empresa y compras electrónicas del RCE.
-- La clave y el client_secret se guardan cifrados por la app. RLS: solo el estudio.

CREATE TABLE public.sunat_credenciales (
  entidad_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
  ruc TEXT NOT NULL CHECK (ruc ~ '^[0-9]{11}$'),
  usuario_sol TEXT NOT NULL CHECK (char_length(btrim(usuario_sol)) BETWEEN 4 AND 20),
  client_id TEXT NOT NULL CHECK (char_length(btrim(client_id)) BETWEEN 8 AND 80),
  clave_sol_cifrada TEXT NOT NULL,
  client_secret_cifrado TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.sunat_credenciales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sunat_credenciales FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sunat_credenciales TO authenticated;

DROP POLICY IF EXISTS sunat_credenciales_estudio ON public.sunat_credenciales;
CREATE POLICY sunat_credenciales_estudio ON public.sunat_credenciales
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

CREATE TABLE public.sunat_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL CHECK (periodo ~ '^[0-9]{6}$'),
  tipo TEXT NOT NULL CHECK (tipo IN ('01', '02', '03')),
  serie TEXT NOT NULL DEFAULT '',
  numero TEXT NOT NULL CHECK (char_length(btrim(numero)) > 0),
  numero_final TEXT,
  ruc_emisor TEXT,
  razon_social_emisor TEXT,
  fecha_emision DATE,
  moneda TEXT,
  total NUMERIC(14, 2),
  car TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sunat_compras_entidad_periodo
  ON public.sunat_compras (entidad_id, periodo);

ALTER TABLE public.sunat_compras ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sunat_compras FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sunat_compras TO authenticated;

DROP POLICY IF EXISTS sunat_compras_estudio ON public.sunat_compras;
CREATE POLICY sunat_compras_estudio ON public.sunat_compras
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

CREATE TABLE public.sunat_descargas (
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL CHECK (periodo ~ '^[0-9]{6}$'),
  num_ticket TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('SOLICITADO', 'EN_PROCESO', 'LISTO', 'ERROR')),
  mensaje TEXT,
  archivo_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entidad_id, periodo)
);

ALTER TABLE public.sunat_descargas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sunat_descargas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sunat_descargas TO authenticated;

DROP POLICY IF EXISTS sunat_descargas_estudio ON public.sunat_descargas;
CREATE POLICY sunat_descargas_estudio ON public.sunat_descargas
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sunat-compras',
  'sunat-compras',
  FALSE,
  52428800,
  ARRAY['text/plain', 'text/csv', 'application/zip', 'application/octet-stream', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS sunat_compras_storage_select ON storage.objects;
CREATE POLICY sunat_compras_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sunat-compras' AND public.is_personal_estudio());

DROP POLICY IF EXISTS sunat_compras_storage_insert ON storage.objects;
CREATE POLICY sunat_compras_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sunat-compras' AND public.is_personal_estudio());

DROP POLICY IF EXISTS sunat_compras_storage_update ON storage.objects;
CREATE POLICY sunat_compras_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sunat-compras' AND public.is_personal_estudio())
  WITH CHECK (bucket_id = 'sunat-compras' AND public.is_personal_estudio());

DROP POLICY IF EXISTS sunat_compras_storage_delete ON storage.objects;
CREATE POLICY sunat_compras_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sunat-compras' AND public.is_personal_estudio());
