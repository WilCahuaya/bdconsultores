-- Constancia, factura y comprobante de Vida Ley pertenecen al envío (lote).
-- El certificado sigue en planillas.documentos, uno por trabajador.

CREATE TABLE IF NOT EXISTS planillas.vida_ley_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE RESTRICT,
  constancia_storage_path TEXT,
  factura_storage_path TEXT,
  factura_no_enviada BOOLEAN NOT NULL DEFAULT FALSE,
  comprobante_storage_path TEXT,
  backfill_relacion_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vida_ley_lotes_entidad
  ON planillas.vida_ley_lotes (entidad_id);

DROP TRIGGER IF EXISTS vida_ley_lotes_updated_at ON planillas.vida_ley_lotes;
CREATE TRIGGER vida_ley_lotes_updated_at
  BEFORE UPDATE ON planillas.vida_ley_lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE planillas.vida_ley_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vida_ley_lotes_select ON planillas.vida_ley_lotes;
CREATE POLICY vida_ley_lotes_select ON planillas.vida_ley_lotes
  FOR SELECT TO authenticated
  USING (public.can_access_entidad_planillas(entidad_id));

DROP POLICY IF EXISTS vida_ley_lotes_write ON planillas.vida_ley_lotes;
CREATE POLICY vida_ley_lotes_write ON planillas.vida_ley_lotes
  FOR ALL TO authenticated
  USING (public.is_personal_estudio())
  WITH CHECK (public.is_personal_estudio());

GRANT SELECT, INSERT, UPDATE, DELETE ON planillas.vida_ley_lotes TO authenticated, service_role;

ALTER TABLE planillas.vida_ley
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES planillas.vida_ley_lotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vida_ley_lote
  ON planillas.vida_ley (lote_id);

INSERT INTO planillas.vida_ley_lotes (
  entidad_id,
  backfill_relacion_id,
  constancia_storage_path,
  factura_storage_path,
  factura_no_enviada,
  comprobante_storage_path
)
SELECT
  v.entidad_id,
  v.relacion_id,
  constancia.storage_path,
  factura.storage_path,
  COALESCE(factura.estado = 'NA' AND factura.storage_path IS NULL, FALSE),
  comprobante.storage_path
FROM planillas.vida_ley v
LEFT JOIN LATERAL (
  SELECT d.storage_path
  FROM planillas.documentos d
  WHERE d.relacion_id = v.relacion_id
    AND d.tipo = 'VIDA_LEY_CONSTANCIA'
  ORDER BY d.created_at DESC
  LIMIT 1
) constancia ON TRUE
LEFT JOIN LATERAL (
  SELECT d.storage_path, d.estado
  FROM planillas.documentos d
  WHERE d.relacion_id = v.relacion_id
    AND d.tipo = 'VIDA_LEY_FACTURA'
  ORDER BY d.created_at DESC
  LIMIT 1
) factura ON TRUE
LEFT JOIN LATERAL (
  SELECT d.storage_path
  FROM planillas.documentos d
  WHERE d.relacion_id = v.relacion_id
    AND d.tipo = 'VIDA_LEY_COMPROBANTE'
  ORDER BY d.created_at DESC
  LIMIT 1
) comprobante ON TRUE
WHERE v.lote_id IS NULL;

UPDATE planillas.vida_ley v
SET lote_id = l.id
FROM planillas.vida_ley_lotes l
WHERE l.backfill_relacion_id = v.relacion_id
  AND v.lote_id IS NULL;

ALTER TABLE planillas.vida_ley_lotes
  DROP COLUMN backfill_relacion_id;
