-- Número de archivo del trabajador dentro de la empresa: 01, 02, 15.
-- Manual. Único por empresa, incluso si la ficha está de baja.

ALTER TABLE planillas.relaciones_laborales
  ADD COLUMN IF NOT EXISTS numero INTEGER;

ALTER TABLE planillas.relaciones_laborales
  DROP CONSTRAINT IF EXISTS relaciones_numero_positivo_check;

ALTER TABLE planillas.relaciones_laborales
  ADD CONSTRAINT relaciones_numero_positivo_check
  CHECK (numero IS NULL OR numero >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS relaciones_numero_por_entidad_unique
  ON planillas.relaciones_laborales (entidad_id, numero)
  WHERE numero IS NOT NULL;

COMMENT ON COLUMN planillas.relaciones_laborales.numero IS
  'Número de archivo dentro de la empresa (01, 02). Manual; no se reutiliza al cesar.';
