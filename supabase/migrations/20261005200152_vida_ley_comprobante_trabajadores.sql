-- Cuántos trabajadores abarca el comprobante de envío de Vida Ley de la empresa.

ALTER TABLE planillas.vida_ley_comprobante_empresa
  ADD COLUMN IF NOT EXISTS cantidad_trabajadores INTEGER;

ALTER TABLE planillas.vida_ley_comprobante_empresa
  DROP CONSTRAINT IF EXISTS vida_ley_comprobante_empresa_cantidad_check;

ALTER TABLE planillas.vida_ley_comprobante_empresa
  ADD CONSTRAINT vida_ley_comprobante_empresa_cantidad_check
  CHECK (
    cantidad_trabajadores IS NULL
    OR (cantidad_trabajadores >= 1 AND cantidad_trabajadores <= 9999)
  );
