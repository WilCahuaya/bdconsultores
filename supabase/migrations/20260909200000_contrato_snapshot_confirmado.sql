-- Foto de cargo/horario/jornada en cada versión de contrato.
-- datos_confirmados: solo true al validar el PDF firmado; hasta entonces no se copia a la ficha.

ALTER TABLE planillas.contratos
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS horario TEXT,
  ADD COLUMN IF NOT EXISTS datos_confirmados BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_contratos_borrador
  ON planillas.contratos (relacion_id)
  WHERE datos_confirmados = FALSE;
