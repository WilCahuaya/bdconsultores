-- Foto del representante legal al generar el contrato o la adenda.
-- Los documentos anteriores quedan sin foto y el Word sigue usando el de la empresa.

ALTER TABLE planillas.contratos
  ADD COLUMN IF NOT EXISTS representante_legal_nombre TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_dni TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_cargo TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_guardado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE planillas.adendas
  ADD COLUMN IF NOT EXISTS representante_legal_nombre TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_dni TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_cargo TEXT,
  ADD COLUMN IF NOT EXISTS representante_legal_guardado BOOLEAN NOT NULL DEFAULT FALSE;
