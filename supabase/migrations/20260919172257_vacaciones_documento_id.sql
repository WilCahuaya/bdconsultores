ALTER TABLE planillas.vacaciones
  ADD COLUMN IF NOT EXISTS documento_id UUID REFERENCES planillas.documentos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vacaciones_documento_unique
  ON planillas.vacaciones (documento_id)
  WHERE documento_id IS NOT NULL;
