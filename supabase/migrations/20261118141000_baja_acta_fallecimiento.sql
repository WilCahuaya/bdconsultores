-- Motivo de cese por fallecimiento y el acta que lo sustenta.

ALTER TYPE planillas.tipo_documento ADD VALUE IF NOT EXISTS 'ACTA_FALLECIMIENTO';

ALTER TABLE planillas.relaciones_laborales
  DROP CONSTRAINT IF EXISTS relaciones_tipo_baja_check;

ALTER TABLE planillas.relaciones_laborales
  ADD CONSTRAINT relaciones_tipo_baja_check
  CHECK (tipo_baja IS NULL OR tipo_baja IN ('CARTA_RENUNCIA', 'TERMINO_CONTRATO', 'ACTA_FALLECIMIENTO'));

COMMENT ON COLUMN planillas.relaciones_laborales.tipo_baja IS
  'Motivo del cese: carta de renuncia, término de contrato o acta de fallecimiento.';
